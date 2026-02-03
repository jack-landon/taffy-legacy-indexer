import { TaffyDistributor } from "generated";

TaffyDistributor.EpochEmissionToPools.handler(async ({ event, context }) => {
  let epoch = await context.Epoch.get(event.params.epoch.toString());

  for (let i = 0; i < event.params.pools.length; i++) {
    context.PoolEpoch.set({
      id: `${event.params.pools[i]}-${event.params.epoch.toString()}`,
      emissionAllocation: event.params.poolEmission[i],
      epoch_id: event.params.epoch.toString(),
      votingPower: event.params.poolVotingPower[i],
      stakingPool_id: event.params.pools[i],
    });
  }

  if (!epoch) return;

  epoch = {
    ...epoch,
    isSettled: true,
  };

  context.Epoch.set(epoch);
});
