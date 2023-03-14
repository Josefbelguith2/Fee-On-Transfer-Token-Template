import { network, ethers } from "hardhat";
import { expect } from "./chai-setup";
import { BigNumber, Signer, VoidSigner } from "ethers";
import { solidity } from "ethereum-waffle";
const { time } = require('@nomicfoundation/hardhat-network-helpers');
import { FeeToken, FeeToken__factory, IERC20, IUniswapV2Router02 } from "../typechain-types";


const SPEEDY_RPC = "https://nameless-maximum-fog.ethereum-goerli.discover.quiknode.pro/11278e14174ca16398c1da6d14aacf645bed68bb/";
const WHALE = "0x2C30e62EeCa485F06187fCa6e703A2734c215F54";
const WETH = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"
const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"

describe('feeToken.sol', async () => {
    let token: FeeToken, tokenFactory: FeeToken__factory;
    let adminSigner: Signer, aliceSigner: Signer, bobSigner: Signer;
    let admin: string, alice: string, bob: string;
    let signer: Signer;
    let weth : IERC20;
    let router: IUniswapV2Router02;
    before(async () => {
        await startFork();
        adminSigner = await impersonate(WHALE);
        tokenFactory = await ethers.getContractFactory("feeToken") as FeeToken__factory;
    });
    beforeEach(async () => {
        [adminSigner, aliceSigner, bobSigner] = await ethers.getSigners();
        admin = await adminSigner.getAddress();
        alice = await aliceSigner.getAddress();
        bob = await bobSigner.getAddress();
        weth = (await ethers.getContractAt("IERC20", WETH)) as IERC20;
        router = (await ethers.getContractAt("IUniswapV2Router02", ROUTER)) as IUniswapV2Router02;
        token = await tokenFactory.connect(adminSigner).deploy();

    });
    it('should have correct name', async () => {
        const name = await token.name();
        expect(name).to.be.equal('feeToken');
    });
    it('should have correct symbol', async () => {
        const symbol = await token.symbol();
        expect(symbol).to.be.equal('feeToken');
    });
    it('should have correct supply', async () => {
        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.be.equal(ethers.utils.parseEther('1000000000'));
    });
    it('deployer should have entire supply', async () => {
        const totalSupply = await token.totalSupply();
        const beneficiaryBalance = await token.balanceOf(admin);
        expect(beneficiaryBalance).to.be.equal(totalSupply);
    });
    it('Transfers Tokens Correctly from Deployer to Address', async () => {
        const maxTxAmount = await token.maxTxAmount();
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        const addressBalance = await token.balanceOf(alice);
        expect(addressBalance).to.be.equal(maxTxAmount);
    });
    it('Transfers Tokens Correctly from fee exempt address', async () => {
        const maxTxAmount = await token.maxTxAmount();
        await token.connect(adminSigner).excludeFromFee(alice, true);
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);
        const receiverBalance = await token.balanceOf(bob);
        expect(receiverBalance).to.be.equal(maxTxAmount);
    });
    it('Cannot swap when not Public Launched', async () => {
        const maxTxAmount = await token.maxTxAmount();
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await expect(token.connect(aliceSigner).transfer(bob, maxTxAmount)).to.be.revertedWith("Public Trading is not yet available");
    });
    it('Swaps Successfully & Correctly when publicLaunch', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        let value = ethers.utils.parseEther("1000");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(adminSigner).publicLaunch();
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);

        await expect(await token.balanceOf(bob)).to.be.equal(ethers.utils.parseEther('4500000'));
        await expect(await token.balanceOf(token.address)).to.be.equal(ethers.utils.parseEther('250000'));
        console.log('Honorarium Funds:', await token.projectFunds());
        console.log('Liquidity ETH Funds:', await ethers.utils.formatEther(await token.liquidityEthFunds()));
        console.log('Liquidity Token Funds:', await ethers.utils.formatEther(await token.liquidityTokenFunds()));

    });
    it('Withdraws Project Funds correctly', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        let value = ethers.utils.parseEther("1");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(adminSigner).publicLaunch();
        await token.connect(adminSigner).updateTaxForLiquidityAndProject(15, 15);
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);

        console.log('Project Funds:', await ethers.utils.formatEther(await token.projectFunds()));

        await token.connect(adminSigner).withdrawProject();

        console.log('Project Funds after withdrawal', await ethers.utils.formatEther(await token.projectFunds()))        
    })
    it('Withdraws Liquidity Funds correctly', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        let value = ethers.utils.parseEther("1");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(adminSigner).publicLaunch();
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);

        console.log('Liquidity Token contract balance:', await ethers.utils.formatEther(await token.liquidityTokenFunds()));
        console.log('Liquidity ETH contract balance:', await ethers.utils.formatEther(await token.liquidityEthFunds()))
        await token.connect(adminSigner).withdrawLiquidity();
        console.log('Liquidity Token contract balance after withdrawal:', await ethers.utils.formatEther(await token.liquidityTokenFunds()));
        console.log('Liquidity ETH contract balance after withdrawal:', await ethers.utils.formatEther(await token.liquidityEthFunds()))
        await expect(await token.balanceOf(await token.liquidityWallet())).to.be.equal(ethers.utils.parseEther('250000'))
    });
    it('Liquidity/honorarium Funds are updated correctly after withdrawal', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        let value = ethers.utils.parseEther("1");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(adminSigner).publicLaunch();
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);

        await token.connect(adminSigner).withdrawLiquidity();
        await token.connect(adminSigner).withdrawProject();
        await expect(await token.liquidityTokenFunds()).to.be.equal(ethers.utils.parseEther('0'))
        await expect(await token.liquidityEthFunds()).to.be.equal(ethers.utils.parseEther('0'))
        await expect(await token.projectFunds()).to.be.equal(ethers.utils.parseEther('0'))
    });
    it('Excludes address from fee correctly:', async () => {
        await token.excludeFromFee(alice, true);
        await expect(await token._isExcludedFromFee(alice)).to.be.equal(true);
    });
    it('Excludes batch of address from fee correctly', async () => {
        await token.batchExcludeFromFee([alice, bob], true);
        await expect(await token._isExcludedFromFee(alice)).to.be.equal(true);
        await expect(await token._isExcludedFromFee(bob)).to.be.equal(true);
    });
    it('Updates Pair correctly', async () => {
        await token.updatePair(alice);
        await expect(await token.uniswapV2Pair()).to.be.equal(alice);
    });
    it('Updates Honorarium Wallet correctly', async () => {
        await token.updateprojectWallet(alice);
        await expect(await token.projectWallet()).to.be.equal(alice);
    });
    it('Updates Liquidity Wallet correctly', async () => {
        await token.updateLiquidityWallet(alice);
        await expect(await token.liquidityWallet()).to.be.equal(alice);
    });
    it('Updates Honorarium and Liquidity Tax correctly', async () => {
        await token.updateTaxForLiquidityAndProject(10, 15);
        await expect(await token.taxForLiquidity()).to.be.equal(10);
        await expect(await token.taxForProject()).to.be.equal(15);
    });
    it('Cannot Set Honorarium Tax for more than 15%', async () => {
        await expect(token.updateTaxForLiquidityAndProject(10, 16)).to.be.revertedWith('Project Tax cannot be more than 15%');
    });
    it('Cannot Set Liquidity Tax for more than 15%', async () => {
        await expect(token.updateTaxForLiquidityAndProject(16, 10)).to.be.revertedWith('Liquidity Tax cannot be more than 15%');
    })
    it('Updates Max Transaction amount correctly', async () => {
        await token.updateMaxTxAmount(10000);
        await expect(await token.maxTxAmount()).to.be.equal(10000);
    });
    it('Cannot set Max Transaction Amount to more than 10% of the supply', async () => {
        await expect(token.updateMaxTxAmount(ethers.utils.parseEther('100000001'))).to.be.revertedWith('Cannot set maxTxAmount to more than 10% of the supply');
    });
    it('Updates Maximum Wallet Amount correctly:',async () => {
        await token.updateMaxWalletAmount(10000);
        await expect(await token.maxWalletAmount()).to.be.equal(10000);
    });
    it('Cannot set Max Wallet Amount to more than 10% of the supply:',async () => {
        await expect(token.updateMaxWalletAmount(ethers.utils.parseEther('100000001'))).to.be.revertedWith('Cannot set maxWalletAmount to more than 10% of the supply');
    });
    it('Taxes correctly when liquidity tax is zero', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        await token.connect(adminSigner).publicLaunch();
        await token.updateTaxForLiquidityAndProject(0, 10)
        let value = ethers.utils.parseEther("1000");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);



        console.log('-------')
        console.log(await ethers.utils.formatEther(await token.balanceOf(bob)))
        console.log(await ethers.utils.formatEther(await token.projectFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityEthFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityTokenFunds()))
        console.log('-------')
    });
    it('Taxes correctly when project tax is zero', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        await token.connect(adminSigner).publicLaunch();
        await token.updateTaxForLiquidityAndProject(10, 0)
        let value = ethers.utils.parseEther("1000");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);



        console.log('-------')
        console.log(await ethers.utils.formatEther(await token.balanceOf(bob)))
        console.log(await ethers.utils.formatEther(await token.projectFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityEthFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityTokenFunds()))
        console.log('-------')
    });
    it('Does not tax when tax is zero', async () => {
        const maxTxAmount = await ethers.utils.parseEther('5000000');
        await token.connect(adminSigner).publicLaunch();
        await token.updateTaxForLiquidityAndProject(0, 0)
        let value = ethers.utils.parseEther("1000");

        await token.connect(adminSigner).test();
        const timing = await time.latest() + 100;
        await router.connect(adminSigner).addLiquidityETH(token.address, value, 0, 0, token.address, timing, { value})
        await token.connect(adminSigner).transfer(alice, maxTxAmount);
        await token.connect(adminSigner).updatePair(bob);
        await token.connect(aliceSigner).transfer(bob, maxTxAmount);



        console.log('-------')
        console.log(await ethers.utils.formatEther(await token.balanceOf(bob)))
        console.log(await ethers.utils.formatEther(await token.projectFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityEthFunds()))
        console.log(await ethers.utils.formatEther(await token.liquidityTokenFunds()))
        console.log('-------')
        
    });
});

const startFork = async () => {
    await network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    jsonRpcUrl: SPEEDY_RPC,
                    blockNumber: 8615870,
                },
            },
        ],
    });
};

const impersonate = async (whale: string): Promise<Signer> => {
    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [whale],
    });
    return await ethers.getSigner(whale);
};
