import * as fs from "fs";
import * as path from "path";
import { providers } from "ethers";
import { AaveProtocolDataProviderFactory } from "./contracts/AaveProtocolDataProviderFactory";
const KEY = process.env.ALCHEMY_KEY;
if (KEY === "") throw new Error("ENV ALCHEMY KEY not configured");
// Get the main addreses from the DOC's https://docs.aave.com/developers/getting-started/deployed-contracts
const NETWORKS_CONFIG = [
  {
    network: "mainnet",
    nodeUrl: `https://eth-mainnet.alchemyapi.io/v2/${KEY}`,
    protocolDataProviderAddress: "0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d",
  },
  {
    network: "kovan",
    nodeUrl: `https://eth-kovan.alchemyapi.io/v2/${KEY}`,
    protocolDataProviderAddress: "0x3c73a5e5785cac854d468f727c606c07488a29d6",
  },
];

(async () => {
  const generateTokensData = async (
    network: string,
    nodeUrl: string,
    protocolDataProviderAddress: string
  ) => {
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

      fs.writeFileSync(
        path.join(__dirname, `../public/${network}.json`),
        JSON.stringify(result)
      );
      console.log(`Success generate data for ${network}`);
    } catch (error) {
      console.error(`Error network : ${network}`, error);
    }
  };

  for (const config of NETWORKS_CONFIG) {
    await generateTokensData(
      config.network,
      config.nodeUrl,
      config.protocolDataProviderAddress
    );
  }
})();
