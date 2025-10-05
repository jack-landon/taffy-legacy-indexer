import { TaffyFactory } from "generated";
import {
  FACTORY_ADDRESS,
  SKIP_TOTAL_SUPPLY,
  ZERO_BD,
  ZERO_BI,
} from "../utils/constants";
import { getErc20, isAddress } from "../utils/helpers";

TaffyFactory.PairCreated.contractRegister(({ event, context }) => {
  context.addTaffyPair(event.params.pair);
});

TaffyFactory.PairCreated.handler(async ({ event, context }) => {
  let [factory, token0, token1] = await Promise.all([
    context.Factory.get(FACTORY_ADDRESS),
    context.Token.get(event.params.token0),
    context.Token.get(event.params.token1),
  ]);

  if (!factory) {
    factory = {
      id: FACTORY_ADDRESS,
      pairCount: 0,
      totalVolumeETH: ZERO_BD,
      totalLiquidityETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalLiquidityUSD: ZERO_BD,
      txCount: ZERO_BI,
    };

    // create new bundle
    context.Bundle.set({
      id: "1",
      ethPrice: ZERO_BD,
    });
  }

  factory = {
    ...factory,
    pairCount: factory.pairCount + 1,
  };

  context.Factory.set(factory);

  if (!token0) {
    if (!isAddress(event.params.token0)) return;
    const erc20 = await getErc20(event.params.token0);
    if (!erc20.decimals && erc20.decimals !== BigInt(0)) {
      return context.log.warn("The decimal on token 0 was null");
    }

    token0 = {
      id: event.params.token0,
      symbol: erc20.symbol,
      name: erc20.name,
      totalSupply: SKIP_TOTAL_SUPPLY.includes(event.params.token0)
        ? BigInt("0")
        : erc20.totalSupply,
      decimals: erc20.decimals,
      derivedETH: ZERO_BD,
      tradeVolume: ZERO_BD,
      tradeVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalLiquidity: ZERO_BD,
      txCount: ZERO_BI,
      isLpToken:
        erc20.lpTokenAddresses[0] && erc20.lpTokenAddresses[1] ? true : false,
      pairTokenAddress0: erc20.lpTokenAddresses[0],
      pairTokenAddress1: erc20.lpTokenAddresses[1],
    };
  }

  if (!token1) {
    if (!isAddress(event.params.token1)) return;
    const erc20 = await getErc20(event.params.token1);
    if (!erc20.decimals) {
      return context.log.warn("The decimal on token 1 was null");
    }

    token1 = {
      id: event.params.token1,
      symbol: erc20.symbol,
      name: erc20.name,
      totalSupply: SKIP_TOTAL_SUPPLY.includes(event.params.token1)
        ? BigInt("0")
        : erc20.totalSupply,
      decimals: erc20.decimals,
      derivedETH: ZERO_BD,
      tradeVolume: ZERO_BD,
      tradeVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalLiquidity: ZERO_BD,
      txCount: ZERO_BI,
      isLpToken:
        erc20.lpTokenAddresses[0] && erc20.lpTokenAddresses[1] ? true : false,
      pairTokenAddress0: erc20.lpTokenAddresses[0],
      pairTokenAddress1: erc20.lpTokenAddresses[1],
    };
  }

  if (!token0 || !token1) return;

  context.Token.set(token0);
  context.Token.set(token1);
  context.Pair.set({
    id: event.params.pair,
    token0_id: token0.id,
    token1_id: token1.id,
    liquidityProviderCount: ZERO_BI,
    createdAtTimestamp: event.block.timestamp,
    createdAtBlockNumber: event.block.number,
    txCount: ZERO_BI,
    reserve0: ZERO_BD,
    reserve1: ZERO_BD,
    trackedReserveETH: ZERO_BD,
    reserveETH: ZERO_BD,
    reserveUSD: ZERO_BD,
    totalSupply: ZERO_BD,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    untrackedVolumeUSD: ZERO_BD,
    token0Price: ZERO_BD,
    token1Price: ZERO_BD,
  });
});
