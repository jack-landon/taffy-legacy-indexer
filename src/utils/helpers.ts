import { Address } from "../types";
import { erc20Abi, uniswapPairAbiMainnet } from "../../abis/abis";
import { publicClient } from "./viemHelpers";
import {
  NATIVE_TOKEN_DECIMALS,
  ZERO_BD,
  ZERO_BI,
  ONE_BD,
  ONE_BI,
  BI_18,
  LP_TOKEN_NAME,
  LP_TOKEN_SYMBOL,
} from "./constants";
import { BigDecimal } from "generated";

export function isAddress(address: string): address is Address {
  return address.startsWith("0x");
}

// export async function getErc20(address: `0x${string}`) {
//   const [name, symbol, decimals, totalSupply] = (await Promise.all([
//     publicClient.readContract({
//       address,
//       abi: erc20Abi,
//       functionName: "name",
//     }),
//     publicClient.readContract({
//       address,
//       abi: erc20Abi,
//       functionName: "symbol",
//     }),
//     publicClient.readContract({
//       address,
//       abi: erc20Abi,
//       functionName: "decimals",
//     }),
//     publicClient.readContract({
//       address,
//       abi: erc20Abi,
//       functionName: "totalSupply",
//     }),
//   ])) as [string, string, bigint, bigint];

//   console.log("Token: ", { name, symbol, decimals, totalSupply });
//   return { address, name, symbol, decimals, totalSupply };
// }

export async function getErc20(address: `0x${string}`) {
  let [name, symbol, decimals, totalSupply] = (await Promise.all([
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "name",
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address,
      abi: erc20Abi,
      functionName: "totalSupply",
    }),
  ])) as [string, string, bigint, bigint];

  // Now we'll check if it's an LP token
  let lpTokenAddresses: [Address | undefined, Address | undefined] = [
    undefined,
    undefined,
  ];

  if (name == LP_TOKEN_NAME && symbol == LP_TOKEN_SYMBOL) {
    try {
      // It's an LP Token => so Store the Name as the Concat of the two tokens
      const [token0Address, token1Address] = (await Promise.all([
        publicClient.readContract({
          address,
          abi: uniswapPairAbiMainnet,
          functionName: "token0",
        }),
        publicClient.readContract({
          address,
          abi: uniswapPairAbiMainnet,
          functionName: "token1",
        }),
      ])) as [Address, Address];

      lpTokenAddresses = [token0Address, token1Address];

      if (!token0Address || !token1Address)
        return {
          address,
          name,
          symbol,
          decimals,
          totalSupply,
          lpTokenAddresses,
        };

      const [token0Name, token0Symbol, token1Name, token1Symbol] =
        (await Promise.all([
          publicClient.readContract({
            address: token0Address,
            abi: erc20Abi,
            functionName: "name",
          }),
          publicClient.readContract({
            address: token0Address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          publicClient.readContract({
            address: token1Address,
            abi: erc20Abi,
            functionName: "name",
          }),
          publicClient.readContract({
            address: token1Address,
            abi: erc20Abi,
            functionName: "symbol",
          }),
        ])) as [string, string, string, string];

      if (token0Name && token0Symbol && token1Name && token1Symbol) {
        name = `${token0Name}/${token1Name} LP Token`;
        symbol = `${token0Symbol}/${token1Symbol}`;
      }
    } catch (error) {
      console.log("Not actually an LP Token");
    }
  }

  console.log("Token: ", {
    name,
    symbol,
    decimals,
    totalSupply,
    lpTokenAddresses,
  });
  return { address, name, symbol, decimals, totalSupply, lpTokenAddresses };
}

export function exponentToBigDecimal(decimals: bigint): BigDecimal {
  let bd = BigDecimal(1);
  const tenDecimal = BigDecimal(10);
  for (let i = ZERO_BI; i < decimals; i = i + ONE_BI) {
    bd = bd.times(tenDecimal);
  }
  return bd;
}

export function bigDecimalExp18(): BigDecimal {
  const decimal = BigDecimal("1000000000000000000");
  return decimal;
}

export function convertEthToDecimal(eth: bigint): BigDecimal {
  const ethDecimals = BigDecimal(eth.toString());
  return ethDecimals.div(exponentToBigDecimal(BigInt(NATIVE_TOKEN_DECIMALS)));
}

export function convertTokenToDecimal(
  tokenAmount: bigint,
  exchangeDecimals: bigint
): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    const decimal = BigDecimal(tokenAmount.toString());
    return decimal;
  }
  const tokenAmountDecimal = BigDecimal(tokenAmount.toString());
  return tokenAmountDecimal.div(exponentToBigDecimal(exchangeDecimals));
}

export function isNullEthValue(value: string): boolean {
  return (
    value ==
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
}
