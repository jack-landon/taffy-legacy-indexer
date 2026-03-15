import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

export const constants = {
    FACTORY_ADDRESS: "0xb9FFd4f89A86a989069CAcaE90e9ce824D0c4971", // created block 25422409
    INIT_CODE_HASH: "0x3cd44f169a5a484d9e4b8b17c1c7627e9de804ae67d936f112ca717dcb46a02c",
    PRICING: {
        wethAddress: "0x557a526472372f1F222EcC6af8818C1e6e78A85f", // WOAS
        whitelist: [
            "0x557a526472372f1F222EcC6af8818C1e6e78A85f", // WOAS,
            "0xD457DE2ebCE0D70F571718Ad66A28273b5956105", // USDT,
            "0x739222D8A9179fE05129C77a8fa354049c088CaA", // USDC,
            "0xf3ad01CF8E4D3ef95f5D480Ec534dD98CAa0555f", // SATS,
            "0x02D728B9C1513478a6b6de77a92648e1D8F801e7", // DOG
        ], // token where amounts should contribute to tracked volume and liquidity
        referenceStablePairs: {
            usdcWethPair: {
                pairAddress: "0x44c3d92308879eFbA1238045F495374E70cE7B80",
                stableTokenAddress: "0x739222D8A9179fE05129C77a8fa354049c088CaA",
                stableSide: "token1", // or "token0"
            },
            usdtWethPair: { // DUMMY FOR NOW
                pairAddress: "0x44c3d92308879eFbA1238045F495374E70cE7B80",
                stableTokenAddress: "0x739222D8A9179fE05129C77a8fa354049c088CaA",
                stableSide: "token1", // or "token0"
            },
            daiWethPair: { // DUMMY FOR NOW
                pairAddress: "0x44c3d92308879eFbA1238045F495374E70cE7B80",
                stableTokenAddress: "0x739222D8A9179fE05129C77a8fa354049c088CaA",
                stableSide: "token1", // or "token0"
            },
        },
    },
    publicClient: createPublicClient({
        chain: base,
        transport: http(),
    })
} as const
