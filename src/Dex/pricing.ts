import {
  ADDRESS_ZERO,
  ONE_BD,
  UNTRACKED_PAIRS,
  ZERO_BD,
  MINIMUM_USD_THRESHOLD_NEW_PAIRS,
  MINIMUM_LIQUIDITY_THRESHOLD_ETH,
  PRICING,
  onlyUsdcPricing,
} from "../utils/constants";
import {
  BigDecimal,
  Bundle,
  Factory,
  handlerContext,
  Pair,
  Token,
} from "generated";
import { getPairAddress } from "../utils/getPairAddress";

type GetEthPriceInUsdParams = {
  daiPair?: Pair;
  usdcPair?: Pair;
  usdtPair?: Pair;
};
const wethAddress: string = PRICING.wethAddress;
const whitelist: readonly string[] = PRICING.whitelist;
const { usdcWethPair, usdtWethPair, daiWethPair } = PRICING.referenceStablePairs;

function getNativeReserve(pair: Pair, stableSide: "token0" | "token1") {
  return stableSide === "token0" ? pair.reserve1 : pair.reserve0;
}

function getNativePriceInUsd(pair: Pair, stableSide: "token0" | "token1") {
  return stableSide === "token0" ? pair.token0Price : pair.token1Price;
}

export function getEthPriceInUSD({
  daiPair, // dai is token0 => CHECK THIS ON CUSTOM CHAIN
  usdcPair, // usdc is token1 => CHECK THIS ON CUSTOM CHAIN
  usdtPair, // usdt is token1 => CHECK THIS ON CUSTOM CHAIN
}: GetEthPriceInUsdParams): BigDecimal {
  // fetch eth prices for each stablecoin

  // all 3 have been created
  if (daiPair && usdcPair && usdtPair && daiWethPair && usdcWethPair && daiWethPair && !onlyUsdcPricing) {
    let totalLiquidityETH = getNativeReserve(daiPair, daiWethPair.stableSide)
      .plus(getNativeReserve(usdcPair, usdcWethPair.stableSide))
      .plus(getNativeReserve(usdtPair, usdtWethPair.stableSide));

    let daiWeight = getNativeReserve(daiPair, daiWethPair.stableSide).div(
      totalLiquidityETH
    );
    let usdcWeight = getNativeReserve(usdcPair, usdcWethPair.stableSide).div(
      totalLiquidityETH
    );
    let usdtWeight = getNativeReserve(usdtPair, usdtWethPair.stableSide).div(
      totalLiquidityETH
    );

    return getNativePriceInUsd(daiPair, daiWethPair.stableSide)
      .times(daiWeight)
      .plus(
        getNativePriceInUsd(usdcPair, usdcWethPair.stableSide).times(usdcWeight)
      )
      .plus(
        getNativePriceInUsd(usdtPair, usdtWethPair.stableSide).times(usdtWeight)
      );
  } else if (daiPair && usdtPair && daiWethPair && usdtWethPair && !onlyUsdcPricing) {
    // dai and USDT have been created
    let totalLiquidityETH = getNativeReserve(daiPair, daiWethPair.stableSide)
      .plus(getNativeReserve(usdtPair, usdtWethPair.stableSide));

    let daiWeight = getNativeReserve(daiPair, daiWethPair.stableSide).div(
      totalLiquidityETH
    );
    let usdtWeight = getNativeReserve(usdtPair, usdtWethPair.stableSide).div(
      totalLiquidityETH
    );

    return getNativePriceInUsd(daiPair, daiWethPair.stableSide)
      .times(daiWeight)
      .plus(
        getNativePriceInUsd(usdtPair, usdtWethPair.stableSide).times(usdtWeight)
      );
  } else if (usdcPair && usdcWethPair) {
    // USDC is the only pair so far
    return getNativePriceInUsd(usdcPair, usdcWethPair.stableSide);
  } else {
    return ZERO_BD;
  }
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export async function findEthPerToken(
  token: Token,
  factoryContract: Factory,
  context: handlerContext
): Promise<BigDecimal> {
  if (token.id == wethAddress) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < whitelist.length; ++i) {
    let pairAddress = getPairAddress(token.id, whitelist[i]);
    // let pairAddress = factoryContract.getPair(
    // 	Address.fromString(token.id),
    // 	Address.fromString(whitelist[i])
    // );
    if (pairAddress != ADDRESS_ZERO) {
      let pair = await context.Pair.get(pairAddress);
      if (!pair) {
        continue;
      }
      if (
        pair.token0_id == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token1 = await context.Token.get(pair.token1_id);
        if (!token1) {
          continue;
        }
        return pair.token1Price.times(token1.derivedETH); // return token1 per our token * Eth per token 1
      }
      if (
        pair.token1_id == token.id &&
        pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)
      ) {
        let token0 = await context.Token.get(pair.token0_id);
        if (!token0) {
          continue;
        }
        return pair.token0Price.times(token0.derivedETH); // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair,
  bundle: Bundle,
  context: handlerContext
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // dont count tracked volume on these pairs - usually rebase tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return ZERO_BD;
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  // Remove this for now because most pairs will have less than 5 liquidity providers
  if (pair.liquidityProviderCount < 5n) {
    let reserve0USD = pair.reserve0.times(price0);
    let reserve1USD = pair.reserve1.times(price1);

    if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD;
      }
    }
    if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
      if (
        reserve0USD.times(BigDecimal("2")).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
    if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
      if (
        reserve1USD.times(BigDecimal("2")).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal("2"));
  }

  // take full value of the whitelisted token amount
  if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  bundle: Bundle,
  context: handlerContext
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (whitelist.includes(token0.id) && !whitelist.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal("2"));
  }

  // take double value of the whitelisted token amount
  if (!whitelist.includes(token0.id) && whitelist.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
