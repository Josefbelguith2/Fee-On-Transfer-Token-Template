import "dotenv/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import "@typechain/hardhat";
import "solidity-coverage";
import "@nomiclabs/hardhat-etherscan";
import { HardhatUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    networks: {
        goerli_testnet: {
            url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
            accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
            saveDeployments: true,
            tags: ["staging"],
        },
        eth_mainnet: {
            url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
            accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
            saveDeployments: true,
            tags: ["production"],
        },
    },
    etherscan: { apiKey: process.env.EXPLORER_API_KEY },
};
export default config;
