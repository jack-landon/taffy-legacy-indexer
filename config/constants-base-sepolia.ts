import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains"

export const constants = {
    FACTORY_ADDRESS: "0xF3a077C8B559776509EbD970986F951e0D40a902",
    INIT_CODE_HASH: "0x051361a4a1e3cd2eda8c517ad1c83ce07bf9ed7af6b7e4b8a4b686ac37f9f0a0",
    PRICING: {
        wethAddress: "0x4200000000000000000000000000000000000006", // WETH
        whitelist: [
            "0x4200000000000000000000000000000000000006", // WETH,
            "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC,
            "0x808456652fdb597867f38412077A9182bf77359F", // EURC
            "0xcbB7C0006F23900c38EB856149F799620fcb8A4a", // cbBTC,
            "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // LINK,
        ], // token where amounts should contribute to tracked volume and liquidity
        referenceStablePairs: {
            usdcWethPair: {
                pairAddress: "0xF1775458F0a6b239703B7De8661433dfE69060d6",
                stableTokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                stableSide: "token0",
            },
            usdtWethPair: {
                pairAddress: "0xF1775458F0a6b239703B7De8661433dfE69060d6",
                stableTokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                stableSide: "token0",
            }, // not corret => only to fill out type for pricing.ts
            daiWethPair: {
                pairAddress: "0xF1775458F0a6b239703B7De8661433dfE69060d6",
                stableTokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                stableSide: "token0",
            }, // not corret => only to fill out type for pricing.ts
        },
    },
    publicClient: createPublicClient({
        chain: baseSepolia,
        transport: http("https://base-sepolia.g.alchemy.com/v2/zux7OncCZreqC-YpbD30QjP-K9wLQXqN"),
    })
} as const
