import { BigDecimal, StakeReward, TaffyStakingRewards, Token } from "generated";
import {
  STAKING_FACTORY_ADDRESS,
  ONE_BI,
  SKIP_TOTAL_SUPPLY,
  ZERO_BI,
  ZERO_BD,
} from "../utils/constants";
import { getErc20, isAddress } from "../utils/helpers";
import { convertTokenToDecimal } from "../utils/helpers";

TaffyStakingRewards.Initialized.handler(async ({ event, context }) => {
  let [stakingToken, rewardTokens] = await Promise.all([
    context.Token.get(event.params.stakableTokenAddress),
    Promise.all(
      event.params.rewardsTokenAddresses.map((rewardToken) =>
        context.Token.get(rewardToken)
      )
    ),
  ]);

  // fetch info if null
  if (!stakingToken) {
    if (!isAddress(event.params.stakableTokenAddress)) return;
    const erc20 = await getErc20(event.params.stakableTokenAddress);
    if (!erc20.decimals && erc20.decimals !== BigInt(0)) {
      return context.log.warn("The decimal on token 0 was null");
    }

    stakingToken = {
      id: event.params.stakableTokenAddress,
      symbol: erc20.symbol,
      name: erc20.name,
      totalSupply: SKIP_TOTAL_SUPPLY.includes(event.params.stakableTokenAddress)
        ? BigInt("0")
        : erc20.totalSupply,
      decimals: erc20.decimals,
      txCount: ZERO_BI,
      isLpToken:
        erc20.lpTokenAddresses[0] && erc20.lpTokenAddresses[1] ? true : false,
      pairTokenAddress0: erc20.lpTokenAddresses[0],
      pairTokenAddress1: erc20.lpTokenAddresses[1],
      // INITIALIZE DEX DATA
      derivedETH: ZERO_BD,
      totalLiquidity: ZERO_BD,
      tradeVolume: ZERO_BD,
      tradeVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
    };

    context.Token.set(stakingToken);
  }

  let rewardTokensFull: Token[] = [];

  for (let i = 0; i < rewardTokens.length; i++) {
    let rewardToken = rewardTokens[i];
    if (!rewardToken) {
      context.log.info(`It doesnt exist`);

      // Doesn't exist so I we need to fetch it
      const rewardTokenAddress = event.params.rewardsTokenAddresses[i];

      if (!isAddress(rewardTokenAddress)) return;
      context.log.info(`Made it past isAddress`);
      const erc20 = await getErc20(rewardTokenAddress);

      context.log.info(
        `Got ERC20: ${erc20.address} | ${erc20.symbol} | ${erc20.name} | ${erc20.totalSupply} | ${erc20.decimals} | ${erc20.lpTokenAddresses[0]} | ${erc20.lpTokenAddresses[1]}`
      );

      if (!erc20.decimals) {
        return context.log.warn("The decimal on token 1 was null");
      }

      rewardToken = {
        id: rewardTokenAddress,
        symbol: erc20.symbol,
        name: erc20.name,
        totalSupply: SKIP_TOTAL_SUPPLY.includes(rewardTokenAddress)
          ? BigInt("0")
          : erc20.totalSupply,
        decimals: erc20.decimals,
        txCount: ZERO_BI,
        isLpToken:
          erc20.lpTokenAddresses[0] && erc20.lpTokenAddresses[1] ? true : false,
        pairTokenAddress0: erc20.lpTokenAddresses[0],
        pairTokenAddress1: erc20.lpTokenAddresses[1],
        // INITIALIZE DEX DATA
        derivedETH: ZERO_BD,
        totalLiquidity: ZERO_BD,
        tradeVolume: ZERO_BD,
        tradeVolumeUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
      };

      context.log.info(`About to save reward token`);

      context.Token.set(rewardToken);
    }

    rewardTokensFull.push(rewardToken);

    context.StakeReward.set({
      id: `${event.srcAddress}-${i}`,
      distribution_id: event.srcAddress,
      rewardIndex: i,
      token_id: event.params.rewardsTokenAddresses[i],
      amount: convertTokenToDecimal(
        event.params.rewardsAmounts[i],
        rewardToken.decimals
      ),
    });
  }

  // Get Formatted Contribution Amounts
  let formattedRewardAmounts: BigDecimal[] = [];
  for (let i = 0; i < event.params.rewardsAmounts.length; i++) {
    formattedRewardAmounts.push(
      convertTokenToDecimal(
        event.params.rewardsAmounts[i],
        rewardTokensFull[i].decimals
      )
    );
  }

  context.StakeContribution.set({
    id: `${event.srcAddress}-0`,
    distribution_id: event.srcAddress,
    updatedAmounts: formattedRewardAmounts,
    contributor_id: event.transaction.from,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    diffTokenAddresses: event.params.rewardsTokenAddresses,
    diffAmounts: formattedRewardAmounts,
  });

  context.StakeDistribution.set({
    id: event.srcAddress,
    stakingToken_id: stakingToken.id,
    startTimestamp: Number(event.params.startingTimestamp),
    endTimestamp: Number(event.params.endingTimestamp),
    locked: event.params.locked,
    createdAtTimestamp: event.block.timestamp,
    createdAtBlockNumber: event.block.number,
    txCount: ZERO_BI,
    amountStaked: ZERO_BD,
    depositsCount: ZERO_BI,
    withdrawCount: ZERO_BI,
    claimsCount: ZERO_BI,
    contributionCount: ZERO_BI, // We make this zero because we then update it in the updateOwnership (used as validation of 1st contribution)
    stakingCap: convertTokenToDecimal(
      event.params.stakingCap,
      stakingToken.decimals
    ),
    owner_id: undefined,
    canceled: false,
    canceledTimestamp: undefined,
    canceledBlockNumber: undefined,
  });
});

TaffyStakingRewards.OwnershipTransferred.handler(async ({ event, context }) => {
  let [newOwner, distribution, contribution] = await Promise.all([
    context.User.get(event.params.newOwner),
    context.StakeDistribution.get(event.srcAddress),
    context.StakeContribution.get(`${event.srcAddress}-0`),
  ]);

  if (!distribution || !contribution) {
    return;
  }

  if (distribution.contributionCount == ZERO_BI) {
    context.log.info(
      `Initial Deploy Ownership Change. Old Deployer: ${event.params.previousOwner}`
    );

    contribution = {
      ...contribution,
      contributor_id: event.params.newOwner,
    };

    distribution = {
      ...distribution,
      contributionCount: distribution.contributionCount + ONE_BI,
    };

    context.StakeContribution.set(contribution);
  }

  if (!newOwner) {
    newOwner = {
      id: event.params.newOwner,
      usdSwapped: ZERO_BD,
    };
    context.User.set(newOwner);
  }

  if (!distribution) return context.log.error("Distribution not found");

  distribution = {
    ...distribution,
    owner_id: event.params.newOwner,
    txCount: distribution.txCount + ONE_BI,
  };

  context.StakeDistribution.set(distribution);
});

TaffyStakingRewards.Canceled.handler(async ({ event, context }) => {
  let distribution = await context.StakeDistribution.get(event.srcAddress);

  if (!distribution) {
    return context.log.warn("Distribution not found");
  }

  distribution = {
    ...distribution,
    canceled: true,
    canceledTimestamp: event.block.timestamp,
    canceledBlockNumber: event.block.number,
    txCount: distribution.txCount + ONE_BI,
  };

  context.StakeDistribution.set(distribution);
  context.StakeCancel.set({
    id: event.transaction.hash,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    distribution_id: event.srcAddress,
    canceler_id: distribution.owner_id,
  });
});

TaffyStakingRewards.Staked.handler(async ({ event, context }) => {
  let distribution = await context.StakeDistribution.get(event.srcAddress);

  if (!distribution) return;

  const stakingToken = await context.Token.get(distribution.stakingToken_id);

  if (!stakingToken) return;

  context.log.info(
    `In The Staking Handler getting Staking Token: ${stakingToken.id} | ${stakingToken.symbol} | ${stakingToken.decimals}`
  );
  let formattedAmountStaked = convertTokenToDecimal(
    event.params.amount,
    stakingToken.decimals
  ); // As Decimal Type

  distribution = {
    ...distribution,
    amountStaked: distribution.amountStaked.plus(formattedAmountStaked),
    depositsCount: distribution.depositsCount + ONE_BI,
    txCount: distribution.txCount + ONE_BI,
  };

  context.StakeDeposit.set({
    id: `${event.srcAddress}-${distribution.depositsCount.toString()}`,
    distribution_id: event.srcAddress,
    amount: formattedAmountStaked,
    depositor_id: event.params.staker,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
  });
  context.StakeDistribution.set(distribution);
});

TaffyStakingRewards.Withdrawn.handler(async ({ event, context }) => {
  let distribution = await context.StakeDistribution.get(event.srcAddress);

  if (!distribution) return;

  let stakingToken = await context.Token.get(distribution.stakingToken_id);

  if (!stakingToken) return;

  context.log.info(
    `In The Staking Handler getting Staking Token: ${stakingToken.id} | ${stakingToken.symbol} | ${stakingToken.decimals}`
  );
  let formattedAmountWithdrawn = convertTokenToDecimal(
    event.params.amount,
    stakingToken.decimals
  ); // As Decimal Type

  distribution = {
    ...distribution,
    amountStaked: distribution.amountStaked.minus(formattedAmountWithdrawn),
    withdrawCount: distribution.withdrawCount + ONE_BI,
    txCount: distribution.txCount + ONE_BI,
  };

  context.StakeWithdraw.set({
    id: `${event.srcAddress}-${distribution.withdrawCount.toString()}`,
    distribution_id: event.srcAddress,
    amount: formattedAmountWithdrawn,
    withdrawer_id: event.params.withdrawer,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
  });
  context.StakeDistribution.set(distribution);
});

TaffyStakingRewards.Claimed.handler(async ({ event, context }) => {
  let distribution = await context.StakeDistribution.get(event.srcAddress);

  if (!distribution) return;

  distribution = {
    ...distribution,
    claimsCount: distribution.claimsCount + ONE_BI,
    txCount: distribution.txCount + ONE_BI,
  };

  // Calculate Formatted Amounts Claimed
  let formattedAmountsClaimed: BigDecimal[] = [];
  for (let i = 0; i < event.params.amounts.length; i++) {
    let rewardObject = await context.StakeReward.get(
      `${event.srcAddress}-${i}`
    );

    if (rewardObject) {
      let rewardToken = await context.Token.get(rewardObject.token_id)!;

      if (!rewardToken) continue;

      context.log.info(
        `Claim Token: ${rewardToken.id} | ${rewardToken.symbol} | ${rewardToken.decimals}`
      );

      formattedAmountsClaimed.push(
        convertTokenToDecimal(event.params.amounts[i], rewardToken.decimals)
      );
    }
  }

  context.StakeClaim.set({
    id: `${event.srcAddress}-${distribution.claimsCount.toString()}`,
    distribution_id: event.srcAddress,
    claimer_id: event.params.claimer,
    amounts: formattedAmountsClaimed,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
  });
  context.StakeDistribution.set(distribution);
});

TaffyStakingRewards.UpdatedRewards.handler(async ({ event, context }) => {
  let distribution = await context.StakeDistribution.get(event.srcAddress);

  if (!distribution) {
    return context.log.warn("Distribution not found");
  }

  distribution = {
    ...distribution,
    contributionCount: distribution.contributionCount + ONE_BI,
    txCount: distribution.txCount + ONE_BI,
  };

  context.StakeDistribution.set(distribution);

  // Find Diff Amounts
  let originalRewards: StakeReward[] = [];
  let updatedRewards: StakeReward[] = [];

  // Update Rewards and keep track of the diff
  for (let i = 0; i < 6; i++) {
    let reward = await context.StakeReward.get(`${event.srcAddress}-${i}`);

    if (reward) {
      let rewardToken = await context.Token.get(reward.token_id)!;

      if (!rewardToken) continue;

      originalRewards.push(reward);

      reward = {
        ...reward,
        amount: convertTokenToDecimal(
          event.params.amounts[i],
          rewardToken.decimals
        ),
      };

      updatedRewards.push(reward);
      context.StakeReward.set(reward);
    }
  }

  // Find the diff
  let diffRewards: { address: string; amount: BigDecimal }[] = [];

  for (let i = 0; i < updatedRewards.length; i++) {
    let originalReward = originalRewards[i].amount;
    let updatedReward = updatedRewards[i].amount;

    if (!originalReward.eq(updatedReward)) {
      diffRewards.push({
        address: updatedRewards[i].token_id,
        amount: (updatedReward ?? ZERO_BI.toString()).minus(
          originalReward ?? ZERO_BI.toString()
        ),
      });
    }
  }

  context.StakeContribution.set({
    id: `${event.srcAddress}-${distribution.contributionCount.toString()}`,
    distribution_id: event.srcAddress,
    contributor_id: event.params.contributor,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    updatedAmounts: updatedRewards.map((reward) => reward.amount),
    diffTokenAddresses: diffRewards.map((reward) => reward.address),
    diffAmounts: diffRewards.map((reward) => reward.amount),
  });
});
