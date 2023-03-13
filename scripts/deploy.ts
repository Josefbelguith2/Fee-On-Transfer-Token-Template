import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { FeeToken__factory } from "../typechain-types";

async function deploy() {
const vesting = (await ethers.getContractFactory("feeToken")) as FeeToken__factory;
    const token = await vesting.deploy();
    await token.deployed();
    console.log("Fee on Transfer Token deployed at", token.address);

  /*await deploy("Betatest", {
    from: deployer,
    log: true,
    args: [
      MyoToken
    ]
  });*/
};

if (require.main === module) {
  deploy();
}

export { deploy };
