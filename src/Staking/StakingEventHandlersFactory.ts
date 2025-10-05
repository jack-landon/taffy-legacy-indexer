import { TaffyStakingRewardsFactory } from "generated";
import { STAKING_FACTORY_ADDRESS, ZERO_BI } from "../utils/constants";

TaffyStakingRewardsFactory.DistributionCreated.contractRegister(
  ({ event, context }) => {
    context.addTaffyStakingRewards(event.params.deployedAt);
  }
);

TaffyStakingRewardsFactory.DistributionCreated.handler(
  async ({ event, context }) => {
    let factory = await context.StakeFactory.get(STAKING_FACTORY_ADDRESS);

    if (!factory) {
      factory = {
        id: STAKING_FACTORY_ADDRESS,
        poolCount: 0,
        txCount: ZERO_BI,
      };
    }

    factory = {
      ...factory,
      poolCount: factory.poolCount + 1,
      txCount: factory.txCount + BigInt(1),
    };

    context.StakeFactory.set(factory);
  }
);
