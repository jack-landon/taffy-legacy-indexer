import { BigDecimal } from "generated";

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const FACTORY_ADDRESS = "0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971"; // created block 25422409
export const STAKING_FACTORY_ADDRESS =
  "0xB5452B5fC8Fd563Be86096ee347abF4E9e161AeF";
export const WETH_ADDRESS = "0x557a526472372f1F222EcC6af8818C1e6e78A85f";
export const DAI_WETH_PAIR = ""; // created block ??
export const USDC_WETH_PAIR = "0x44c3d92308879eFbA1238045F495374E70cE7B80"; // created 27749185
export const USDT_WETH_PAIR = ""; // created block ??
export const INIT_CODE_HASH =
  "0x3cd44f169a5a484d9e4b8b17c1c7627e9de804ae67d936f112ca717dcb46a02c";
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

export const isDoingUpdateTokenDayData = false; // We can't until we cant to reverse lookup in Envio
