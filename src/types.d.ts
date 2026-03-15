export type Address = `0x${string}`;

type CONSTANT_TYPE = {
    FACTORY_ADDRESS: string
    INIT_CODE_HASH: string
    PRICING: {
        wethAddress: Address
        whitelist: Address[], // token where amounts should contribute to tracked volume and liquidity
        referenceStablePairs: {
            usdcWethPair: {
                pairAddress: Address,
                stableTokenAddress: Address,
                stableSide: "token0" | "token1",
            },
            usdtWethPair?: {
                pairAddress: Address,
                stableTokenAddress: Address,
                stableSide: "token0" | "token1",
            },
            daiWethPair?: {
                pairAddress: Address,
                stableTokenAddress: Address,
                stableSide: "token0" | "token1",
            },
        },
    }
}