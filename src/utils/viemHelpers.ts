import { createPublicClient, http, defineChain } from "viem";

export const saakuruMainnet = defineChain({
  id: 7225878,
  name: "Saakuru Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Oasys",
    symbol: "OAS",
  },
  network: "7225878",
  rpcUrls: {
    default: {
      http: ["https://rpc.saakuru.network"],
      webSocket: ["wss://ws.saakuru.network"],
    },
    public: {
      http: ["https://rpc.saakuru.network"],
      webSocket: ["wss://ws.saakuru.network"],
    },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://explorer.saakuru.network" },
  },
});

export const publicClient = createPublicClient({
  // batch: {
  // 	multicall: true
  // }, // Might have to get rid of batch
  chain: saakuruMainnet,
  transport: http(),
});
