import {
  ADDRESS_ZERO,
  ONE_BD,
  UNTRACKED_PAIRS,
  ZERO_BD,
  WETH_ADDRESS,
  MINIMUM_USD_THRESHOLD_NEW_PAIRS,
  MINIMUM_LIQUIDITY_THRESHOLD_ETH,
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

export function getEthPriceInUSD({
  daiPair, // dai is token0 => CHECK THIS ON CUSTOM CHAIN
  usdcPair, // usdc is token1 => CHECK THIS ON CUSTOM CHAIN
  usdtPair, // usdt is token1 => CHECK THIS ON CUSTOM CHAIN
}: GetEthPriceInUsdParams): BigDecimal {
  // fetch eth prices for each stablecoin

  // all 3 have been created
  if (daiPair && usdcPair && usdtPair) {
    let totalLiquidityETH = daiPair.reserve1
      .plus(usdcPair.reserve1)
      .plus(usdtPair.reserve0); // DEPENDING ON THE ORDER OF THE TOKENS
    let daiWeight = daiPair.reserve1.div(totalLiquidityETH);
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityETH);
    let usdtWeight = usdtPair.reserve0.div(totalLiquidityETH);
    return daiPair.token0Price
      .times(daiWeight)
      .plus(usdcPair.token0Price.times(usdcWeight))
      .plus(usdtPair.token1Price)
      .times(usdtWeight);
  } else if (daiPair && usdtPair) {
    // dai and USDT have been created
    let totalLiquidityETH = daiPair.reserve1.plus(usdtPair.reserve1);
    let daiWeight = daiPair.reserve1.div(totalLiquidityETH);
    let usdtWeight = usdtPair.reserve1.div(totalLiquidityETH);
    return daiPair.token0Price
      .times(daiWeight)
      .plus(usdtPair.token0Price.times(usdtWeight));
  } else if (usdcPair) {
    // USDC is the only pair so far
    return usdcPair.token1Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  "0x557a526472372f1F222EcC6af8818C1e6e78A85f", // WOAS,
  "0xD457DE2ebCE0D70F571718Ad66A28273b5956105", // USDT,
  "0x739222D8A9179fE05129C77a8fa354049c088CaA", // USDC,
  "0xf3ad01CF8E4D3ef95f5D480Ec534dD98CAa0555f", // SATS,
  "0x02D728B9C1513478a6b6de77a92648e1D8F801e7", // DOG
];

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export async function findEthPerToken(
  token: Token,
  factoryContract: Factory,
  context: handlerContext
): Promise<BigDecimal> {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = getPairAddress(token.id, WHITELIST[i]);
    // let pairAddress = factoryContract.getPair(
    // 	Address.fromString(token.id),
    // 	Address.fromString(WHITELIST[i])
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

    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD;
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (
        reserve0USD.times(BigDecimal("2")).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (
        reserve1USD.times(BigDecimal("2")).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)
      ) {
        return ZERO_BD;
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
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
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
