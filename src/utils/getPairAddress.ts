import { FACTORY_ADDRESS, INIT_CODE_HASH } from "./constants";
import { keccak256, pack } from "@ethersproject/solidity";
import { getCreate2Address } from "@ethersproject/address";

export function getPairAddress(tokenA: string, tokenB: string): string {
  const factoryAddress = FACTORY_ADDRESS;

  const [token0, token1] = sortsBefore(tokenA, tokenB)
    ? [tokenA, tokenB]
    : [tokenB, tokenA]; // does safety checks
  return getCreate2Address(
    factoryAddress,
    keccak256(["bytes"], [pack(["address", "address"], [token0, token1])]),
    INIT_CODE_HASH
  );
}

function sortsBefore(tokenA: string, tokenB: string): boolean {
  // invariant(tokenA.toLowerCase() !== tokenB.toLowerCase(), 'ADDRESSES');
  return tokenA.toLowerCase() < tokenB.toLowerCase();
}
