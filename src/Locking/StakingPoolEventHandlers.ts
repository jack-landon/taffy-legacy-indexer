import { Reward, TaffyStakingPool, TaffyStakingPoolFactory } from "generated";

TaffyStakingPoolFactory.StakingPoolDeployed.contractRegister(
  ({ event, context }) => {
    context.addTaffyStakingPool(event.params.poolAddress);
  }
);

TaffyStakingPoolFactory.StakingPoolDeployed.handler(
  async ({ event, context }) => {
    context.StakingPool.set({
      id: event.params.poolAddress,
      stakingToken: event.params.stakingToken,
      creator: event.params.creator,
      amountStaked: BigInt(0),
    });
  }
);

TaffyStakingPool.RewardTokenRegistered.handler(async ({ event, context }) => {
  const reward: Reward = {
    id: `${event.srcAddress}-${event.params.rewardToken}`,
    distributor: event.params.rewardsDistributor,
    stakingPool_id: event.srcAddress,
    token: event.params.rewardToken,
    amount: BigInt(0),
    endTimestamp: BigInt(0),
    rewardRate: BigInt(0),
  };

  context.Reward.set(reward);
});

TaffyStakingPool.RewardAmountAdded.handler(async ({ event, context }) => {
  let reward = await context.Reward.get(
    `${event.srcAddress}-${event.params.rewardToken}`
  );

  if (!reward) return;

  reward = {
    ...reward,
    amount: event.params.newTotalAmount,
    endTimestamp: event.params.newPeriodFinish,
    rewardRate: event.params.newRewardRate,
  };

  context.Reward.set(reward);
});

TaffyStakingPool.Staked.handler(async ({ event, context }) => {
  let [stakingPool, stake] = await Promise.all([
    context.StakingPool.get(event.srcAddress),
    context.Stake.get(`${event.srcAddress}-${event.params.account}`),
  ]);

  if (!stake) {
    stake = {
      id: `${event.srcAddress}-${event.params.account}`,
      stakingPool_id: event.srcAddress,
      user_id: event.params.account,
      amount: BigInt(0),
    };
  }

  stake = {
    ...stake,
    amount: stake.amount + event.params.amount,
  };

  context.Stake.set(stake);
  context.Deposit.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    stakingPool_id: event.srcAddress,
    user_id: event.params.account,
    amount: event.params.amount,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });

  if (!stakingPool) return;

  stakingPool = {
    ...stakingPool,
    amountStaked: stakingPool.amountStaked + event.params.amount,
  };

  context.StakingPool.set(stakingPool);
});

TaffyStakingPool.Withdrawn.handler(async ({ event, context }) => {
  let [stakingPool, stake] = await Promise.all([
    context.StakingPool.get(event.srcAddress),
    context.Stake.get(`${event.srcAddress}-${event.params.account}`),
  ]);

  if (!stake) return;

  stake = {
    ...stake,
    amount: stake.amount - event.params.amount,
  };

  context.Stake.set(stake);
  context.Withdrawal.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    stakingPool_id: event.srcAddress,
    user_id: event.params.account,
    amount: event.params.amount,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });

  if (!stakingPool) return;

  stakingPool = {
    ...stakingPool,
    amountStaked: stakingPool.amountStaked - event.params.amount,
  };

  context.StakingPool.set(stakingPool);
});

TaffyStakingPool.RewardPaid.handler(async ({ event, context }) => {
  context.Claim.set({
    id: `${event.transaction.hash}-${event.logIndex}`,
    stakingPool_id: event.srcAddress,
    user_id: event.params.account,
    amount: event.params.reward,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
    reward_id: `${event.srcAddress}-${event.params.rewardsToken}`,
    token: event.params.rewardsToken,
  });
});
