import {
  Bundle,
  eventLog,
  Factory,
  FactoryDayData,
  handlerContext,
  Pair,
  PairDayData,
  PairHourData,
  TaffyPair_Burn_eventArgs,
  TaffyPair_Mint_eventArgs,
  TaffyPair_Swap_eventArgs,
  Token,
  TokenDayData,
} from "generated";
import { ONE_BI, ZERO_BD, ZERO_BI } from "../utils/constants";

type EventTypeMintBurnSwap = eventLog<
  TaffyPair_Mint_eventArgs | TaffyPair_Burn_eventArgs | TaffyPair_Swap_eventArgs
>;

export async function updateFactoryDayData(
  event: EventTypeMintBurnSwap,
  factory: Factory,
  context: handlerContext
): Promise<FactoryDayData> {
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayStartTimestamp = dayID * 86400;

  let factoryDayData = await context.FactoryDayData.get(dayID.toString());

  if (!factoryDayData) {
    factoryDayData = {
      id: dayID.toString(),
      date: dayStartTimestamp,
      dailyVolumeUSD: ZERO_BD,
      dailyVolumeETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      totalVolumeETH: ZERO_BD,
      dailyVolumeUntracked: ZERO_BD,
      totalLiquidityUSD: factory.totalLiquidityUSD,
      totalLiquidityETH: factory.totalLiquidityETH,
      txCount: factory.txCount,
    };
  }

  factoryDayData = {
    ...factoryDayData,
    totalLiquidityUSD: factory.totalLiquidityUSD,
    totalLiquidityETH: factory.totalLiquidityETH,
    txCount: factory.txCount,
  };

  context.FactoryDayData.set(factoryDayData);

  return factoryDayData;
}

// We're going to have to update the arguments to accepts all sorts of events and contexts
export async function updatePairDayData(
  event: EventTypeMintBurnSwap,
  pair: Pair,
  context: handlerContext
): Promise<PairDayData> {
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayStartTimestamp = dayID * 86400;
  let dayPairID = event.srcAddress.concat("-").concat(dayID.toString());

  let pairDayData = await context.PairDayData.get(dayPairID);

  if (!pairDayData) {
    pairDayData = {
      id: dayPairID,
      date: dayStartTimestamp,
      token0_id: pair.token0_id,
      token1_id: pair.token1_id,
      pairAddress: event.srcAddress,
      dailyVolumeToken0: ZERO_BD,
      dailyVolumeToken1: ZERO_BD,
      dailyVolumeUSD: ZERO_BD,
      dailyTxns: ZERO_BI,
      totalSupply: pair.totalSupply,
      reserve0: pair.reserve0,
      reserve1: pair.reserve1,
      reserveUSD: pair.reserveUSD,
    };
  }

  pairDayData = {
    ...pairDayData,
    totalSupply: pair.totalSupply,
    reserve0: pair.reserve0,
    reserve1: pair.reserve1,
    reserveUSD: pair.reserveUSD,
    dailyTxns: pairDayData.dailyTxns + ONE_BI,
  };

  context.PairDayData.set(pairDayData);

  return pairDayData;
}

export async function updatePairHourData(
  event: EventTypeMintBurnSwap,
  pair: Pair,
  context: handlerContext
): Promise<PairHourData> {
  let timestamp = event.block.timestamp;
  let hourIndex = Math.floor(timestamp / 3600); // get unique hour within unix history
  let hourStartUnix = hourIndex * 3600; // want the rounded effect
  let hourPairID = event.srcAddress.concat("-").concat(hourIndex.toString());

  let pairHourData = await context.PairHourData.get(hourPairID);

  if (!pairHourData) {
    pairHourData = {
      id: hourPairID,
      hourStartUnix: hourStartUnix,
      pair_id: event.srcAddress,
      hourlyVolumeToken0: ZERO_BD,
      hourlyVolumeToken1: ZERO_BD,
      hourlyVolumeUSD: ZERO_BD,
      hourlyTxns: ZERO_BI,
      totalSupply: pair.totalSupply,
      reserve0: pair.reserve0,
      reserve1: pair.reserve1,
      reserveUSD: pair.reserveUSD,
    };
  }

  pairHourData = {
    ...pairHourData,
    totalSupply: pair.totalSupply,
    reserve0: pair.reserve0,
    reserve1: pair.reserve1,
    reserveUSD: pair.reserveUSD,
    hourlyTxns: pairHourData.hourlyTxns + ONE_BI,
  };

  context.PairHourData.set(pairHourData);

  return pairHourData;
}

export async function updateTokenDayData(
  token: Token,
  event: EventTypeMintBurnSwap,
  bundle: Bundle,
  context: handlerContext
): Promise<TokenDayData> {
  let timestamp = event.block.timestamp;
  let dayID = Math.floor(timestamp / 86400);
  let dayStartTimestamp = dayID * 86400;
  let tokenDayID = token.id.toString().concat("-").concat(dayID.toString());

  let tokenDayData = await context.TokenDayData.get(tokenDayID);

  if (!tokenDayData) {
    tokenDayData = {
      id: tokenDayID,
      date: dayStartTimestamp,
      token_id: token.id,
      priceUSD: token.derivedETH.times(bundle.ethPrice),
      dailyVolumeToken: ZERO_BD,
      dailyVolumeETH: ZERO_BD,
      dailyVolumeUSD: ZERO_BD,
      dailyTxns: ZERO_BI,
      totalLiquidityUSD: ZERO_BD,
      totalLiquidityETH: token.totalLiquidity.times(token.derivedETH),
      totalLiquidityToken: token.totalLiquidity,
    };
  }

  tokenDayData = {
    ...tokenDayData,
    priceUSD: token.derivedETH.times(bundle.ethPrice),
    totalLiquidityToken: token.totalLiquidity,
    totalLiquidityETH: token.totalLiquidity.times(token.derivedETH),
    dailyTxns: tokenDayData.dailyTxns + ONE_BI,
  };

  tokenDayData = {
    ...tokenDayData,
    totalLiquidityUSD: tokenDayData.totalLiquidityETH.times(bundle.ethPrice),
  };

  context.TokenDayData.set(tokenDayData);

  /**
   * @todo test if this speeds up sync
   */
  // updateStoredTokens(tokenDayData as TokenDayData, dayID)
  // updateStoredPairs(tokenDayData as TokenDayData, dayPairID)

  return tokenDayData;
}
