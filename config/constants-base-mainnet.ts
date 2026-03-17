import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const constants = {
    FACTORY_ADDRESS: "0xEE455a18C845FBd9227286c9BA33DB4F8456EdD3",
    INIT_CODE_HASH: "0x051361a4a1e3cd2eda8c517ad1c83ce07bf9ed7af6b7e4b8a4b686ac37f9f0a0",
    PRICING: {
        wethAddress: "0x4200000000000000000000000000000000000006", // WETH
        whitelist: [
            "0x4200000000000000000000000000000000000006", // WETH,
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC,
            "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
            "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC,
        ], // token where amounts should contribute to tracked volume and liquidity
        referenceStablePairs: {
            usdcWethPair: {
                pairAddress: "0x88E08cBbd2A0d195f455A77f1B26d9e41CaDFB07",
                stableTokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                stableSide: "token1",
            },
            usdtWethPair: { // DUMMY FOR NOW
                pairAddress: "0x44c3d92308879eFbA1238045F495374E70cE7B80",
                stableTokenAddress: "0x739222D8A9179fE05129C77a8fa354049c088CaA",
                stableSide: "token1", // not corret => only to fill out type for pricing.ts
            },
            daiWethPair: { // DUMMY FOR NOW
                pairAddress: "0x44c3d92308879eFbA1238045F495374E70cE7B80",
                stableTokenAddress: "0x739222D8A9179fE05129C77a8fa354049c088CaA",
                stableSide: "token1", // not corret => only to fill out type for pricing.ts
            },
        },
    },
    publicClient: createPublicClient({
        chain: base,
        transport: http("https://base-mainnet.g.alchemy.com/v2/zux7OncCZreqC-YpbD30QjP-K9wLQXqN"),
    })
} as const