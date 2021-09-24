import * as fs from "fs";
import * as path from "path";
import { providers } from "ethers";
import { AaveProtocolDataProviderFactory } from "./contracts/AaveProtocolDataProviderFactory";
const KEY = process.env.ALCHEMY_KEY;
const POLYGON_ALCHEMY_KEY = process.env.POLYGON_ALCHEMY_KEY;
const MUMBAI_ALCHEMY_KEY = process.env.MUMBAI_ALCHEMY_KEY;
if (
  KEY === "" ||
  MUMBAI_ALCHEMY_KEY === "" ||
  POLYGON_ALCHEMY_KEY === "" ||
  !KEY ||
  !MUMBAI_ALCHEMY_KEY ||
  !POLYGON_ALCHEMY_KEY
)
  throw new Error("ENV ALCHEMY KEY not configured");
// Get the main addreses from the DOC's https://docs.aave.com/developers/getting-started/deployed-contracts

const NETWORKS_CONFIG = {
  mainnet: [
    {
      market: "proto",
      nodeUrl: `https://eth-mainnet.alchemyapi.io/v2/${KEY}`,
      protocolDataProviderAddress: "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
    },
    {
      market: "amm",
      nodeUrl: `https://eth-mainnet.alchemyapi.io/v2/${KEY}`,
      protocolDataProviderAddress: "0xc443ad9dde3cecfb9dfc5736578f447afe3590ba",
    },
  ],
  kovan: [
    {
      market: "proto",
      nodeUrl: `https://eth-kovan.alchemyapi.io/v2/${KEY}`,
      protocolDataProviderAddress: "0x3c73a5e5785cac854d468f727c606c07488a29d6",
    },
  ],
  polygon: [
    {
      market: "matic",
      nodeUrl: `https://polygon-mainnet.g.alchemy.com/v2/${POLYGON_ALCHEMY_KEY}`,
      protocolDataProviderAddress: "0x7551b5D2763519d4e37e8B81929D336De671d46d",
    },
  ],
  mumbai: [
    {
      market: "matic",
      nodeUrl: `https://polygon-mumbai.g.alchemy.com/v2/${MUMBAI_ALCHEMY_KEY}`,
      protocolDataProviderAddress: "0xFA3bD19110d986c5e5E9DD5F69362d05035D045B",
    },
  ],
} as const;

(async () => {
  const generateTokensData = async (
    network: string,
    nodeUrl: string,
    market: string,
    protocolDataProviderAddress: string
  ) => {
    console.log("NET: ", network, " market: ", market, " URL : ", nodeUrl);
    const provider = new providers.JsonRpcProvider(nodeUrl);
    const helperContract = AaveProtocolDataProviderFactory.connect(
      protocolDataProviderAddress,
      provider
    );

    try {
      const [tokens, aTokens] = await Promise.all([
        helperContract.getAllReservesTokens(),
        helperContract.getAllATokens(),
      ]);

      const promises = tokens.map(async (token) => {
        const [reserve, config] = await Promise.all([
          helperContract.getReserveTokensAddresses(token.tokenAddress),
          helperContract.getReserveConfigurationData(token.tokenAddress),
        ]);

        const aToken = aTokens.find(
          (aToken) => aToken.tokenAddress === reserve.aTokenAddress
        );

        return {
          aTokenAddress: reserve.aTokenAddress,
          aTokenSymbol: aToken ? aToken.symbol : "",
          stableDebtTokenAddress: reserve.stableDebtTokenAddress,
          variableDebtTokenAddress: reserve.variableDebtTokenAddress,
          symbol: token.symbol,
          address: token.tokenAddress,
          decimals: config.decimals.toNumber(),
        };
      });

      const result = await Promise.all(promises);
      console.log(`Success generate data for ${market}-${network}`);
      return { [market]: result };
    } catch (error) {
      console.error(`Error network : ${network}`, error);
      return null;
    }
  };

  for (const network of Object.keys(NETWORKS_CONFIG) as (
    | "mainnet"
    | "kovan"
  )[]) {
    const data = await Promise.all(
      NETWORKS_CONFIG[network].map((config) => {
        return generateTokensData(
          network,
          config.nodeUrl,
          config.market,
          config.protocolDataProviderAddress
        );
      })
    );

    fs.writeFileSync(
      path.join(__dirname, `../public/${network}.json`),
      JSON.stringify(data.reduce((acc, market) => ({ ...acc, ...market }), {}))
    );
  }
})();
