import { TaffyVoting } from "generated";
import { ONE_BI, ZERO_BI } from "./helpers/constants";
import { addUser, createEpoch, createLockingSystem } from "./helpers/utils";

TaffyVoting.VoteConfigCreated.handler(async ({ event, context }) => {
  context.VoteConfig.set({
    id: event.params.voteConfigId.toString(),
    locks: event.params.lockIds,
  });

  for (let i = 0; i < event.params.pools.length; i++) {
    context.VotePoolAllocation.set({
      id: `${event.params.voteConfigId}-${event.params.pools[i]}`,
      voteConfig_id: event.params.voteConfigId.toString(),
      pool_id: event.params.pools[i],
      allocatedVotingPower: event.params.allocatedVotingPowers[i],
    });
  }
});

TaffyVoting.VoteCast.handler(async ({ event, context }) => {
  let voteAllocations =
    await context.VotePoolAllocation.getWhere.voteConfig_id.eq(
      event.params.voteConfigId.toString()
    );

  let epoch = await context.Epoch.get(event.params.epoch.toString());

  // Increase the voting power of the epoch
  if (!epoch) {
    epoch = createEpoch(event.params.epoch.toString(), context);
  }

  epoch = {
    ...epoch,
    totalVotingPower: epoch.totalVotingPower + event.params.votingPower,
  };

  // Increase the voting power of the poolEpochs
  for (const allocation of voteAllocations) {
    let poolEpoch = await context.PoolEpoch.get(
      `${allocation.pool_id}-${event.params.epoch}`
    );

    if (!poolEpoch) {
      poolEpoch = {
        id: `${allocation.pool_id}-${epoch.id}`,
        epoch_id: epoch.id,
        emissionAllocation: ZERO_BI,
        stakingPool_id: allocation.pool_id,
        votingPower: ZERO_BI,
      };
    }

    poolEpoch = {
      ...poolEpoch,
      votingPower: poolEpoch.votingPower + allocation.allocatedVotingPower,
    };

    context.PoolEpoch.set(poolEpoch);
  }

  context.Epoch.set(epoch);
  context.Vote.set({
    id: event.params.voteId.toString(),
    epoch_id: event.params.epoch.toString(),
    voter_id: event.params.voter,
    voteConfig_id: event.params.voteConfigId.toString(),
    votingPower: event.params.votingPower,
    isClaimed: false,
    claimAmount: undefined,
    claimTxHash: undefined,
  });
});

TaffyVoting.VoteDeleted.handler(async ({ event, context }) => {
  let vote = await context.Vote.get(event.params.voteId.toString());
  let epoch = await context.Epoch.get(event.params.epoch.toString());

  let voteAllocations =
    await context.VotePoolAllocation.getWhere.voteConfig_id.eq(
      event.params.existingVoteConfigId.toString()
    );

  if (!epoch) {
    epoch = createEpoch(event.params.epoch.toString(), context);
  }

  // Adjust the Epoch Total Voting Power
  epoch = {
    ...epoch,
    totalVotingPower: epoch.totalVotingPower - (vote?.votingPower ?? BigInt(0)),
  };

  // Adjust the PoolEpochs Voting Power
  for (const voteAllocation of voteAllocations) {
    let poolEpoch = await context.PoolEpoch.get(
      `${voteAllocation.pool_id}-${event.params.epoch}`
    );

    if (!poolEpoch) continue;
    poolEpoch = {
      ...poolEpoch,
      votingPower: poolEpoch.votingPower - voteAllocation.allocatedVotingPower,
    };
    context.PoolEpoch.set(poolEpoch);
  }

  context.Epoch.set(epoch);

  context.Vote.set({
    id: event.params.voteId.toString(),
    epoch_id: event.params.epoch.toString(),
    voter_id: event.params.voter,
    voteConfig_id: undefined,
    votingPower: ZERO_BI,
    isClaimed: false,
    claimAmount: undefined,
    claimTxHash: undefined,
  });
});

TaffyVoting.WhitelistedPoolsUpdated.handler(async ({ event, context }) => {
  let [epoch, existingPools] = await Promise.all([
    context.Epoch.get(event.params.epoch.toString()),
    context.PoolEpoch.getWhere.epoch_id.eq(event.params.epoch.toString()),
  ]);

  // If the epoch doesnt exist, create it
  if (!epoch) {
    createEpoch(event.params.epoch.toString(), context);
  }

  for (const poolAddress of event.params.newWhitelistedPools) {
    // If the pool doesnt exist in existingPools, create it
    if (
      !existingPools.find(
        (existingPool) => existingPool.stakingPool_id === poolAddress
      )
    ) {
      context.PoolEpoch.set({
        id: `${poolAddress}-${event.params.epoch.toString()}`,
        epoch_id: event.params.epoch.toString(),
        stakingPool_id: poolAddress,
        votingPower: ZERO_BI,
        emissionAllocation: ZERO_BI,
      });
    }
  }
});

TaffyVoting.NextEpochSet.handler(async ({ event, context }) => {
  let [lockingSystem, epoch] = await Promise.all([
    context.LockingSystem.get("1"),
    context.Epoch.get(event.params.nextEpoch.toString()),
  ]);

  if (!epoch) {
    epoch = createEpoch(event.params.nextEpoch.toString(), context);
  }

  epoch = {
    ...epoch,
    epochEmission: event.params.nextEpochEmissions,
  };

  context.Epoch.set(epoch);

  if (!lockingSystem) {
    lockingSystem = createLockingSystem(context);
  }
  lockingSystem = {
    ...lockingSystem,
    currentEpoch: event.params.nextEpoch - ONE_BI,
  };

  context.LockingSystem.set(lockingSystem);
});

TaffyVoting.MultipliersUpdated.handler(async ({ event, context }) => {
  let users = await Promise.all(
    event.params.voters.map((voter) => context.User.get(voter))
  );
  for (let i = 0; i < event.params.voters.length; i++) {
    let user = users[i];

    if (!user) {
      user = addUser(event.params.voters[i], context);
    }

    user = {
      ...user,
      multiplier: event.params.multipliers[i],
    };

    context.User.set(user);
  }
});
