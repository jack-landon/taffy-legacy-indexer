import { BigDecimal } from "generated";
import { constants as constantsBaseMainnet } from "../../config/constants-base-mainnet"
import { constants as constantsBaseSepolia } from "../../config/constants-base-sepolia"
import { constants as constantsSaakuru } from "../../config/constants-saakuru"
import { Address } from "../types";

type SupportedChain = "base-mainnet" | "base-sepolia" | 'saakuru'
const targetChain: SupportedChain = "base-sepolia"
export const onlyUsdcPricing = true

const CHAIN_CONFIGS = {
  "base-mainnet": constantsBaseMainnet,
  "base-sepolia": constantsBaseSepolia,
  "saakuru": constantsSaakuru,
} as const;

const active = CHAIN_CONFIGS[targetChain];

export const {
  FACTORY_ADDRESS,
  INIT_CODE_HASH,
  PRICING,
  publicClient
} = active;

export const { wethAddress, whitelist, referenceStablePairs } = PRICING;
export const { usdcWethPair, usdtWethPair, daiWethPair } = referenceStablePairs

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const NATIVE_TOKEN_DECIMALS = 18;

export const LP_TOKEN_NAME = "Taffy LP Token";
export const LP_TOKEN_SYMBOL = "TAFFY-LP";

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
export let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal("1");

// minimum liquidity for price to get tracked
export let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal("1");

export let UNTRACKED_PAIRS: string[] = [
  "0x9ea3b5b4ec044b70375236a281986106457b20ef",
]; // rebase tokens, dont count in tracked volume

// HOT FIX: we cant implement try catch for overflow catching so skip total supply parsing on these tokens that overflow
// TODO: find better way to handle overflow
export const SKIP_TOTAL_SUPPLY: string[] = [
  "0x0000000000bf2686748e1c0255036e7617e7e8a5",
]; // Exploit Contract

export let ZERO_BI = BigInt("0");
export let ONE_BI = BigInt("1");
export let ZERO_BD = BigDecimal("0");
export let ONE_BD = BigDecimal("1");
export let BI_18 = BigInt("18");