// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

 contract feeToken is ERC20, Ownable {
    string private _name = "feeToken";
    string private _symbol = "feeToken";
    uint256 private _supply = 1000000000 ether;
    bool public _isPublicLaunched = false;

    uint256 public maxTxAmount = 10000000 ether;
    uint256 public maxWalletAmount = 10000000 ether;
    address public projectWallet = 0xe699c7548B1E4ecFb124c4b09ebB33cEC6766975;
    address public liquidityWallet = 0xe699c7548B1E4ecFb124c4b09ebB33cEC6766975;
    address public DEAD = 0x000000000000000000000000000000000000dEaD;
    mapping(address => bool) public _isExcludedFromFee;

    // Taxes against bots
    uint256 public taxForLiquidity = 50; 
    uint256 public taxForProject = 50; 

    function publicLaunch() public onlyOwner {
        taxForLiquidity = 10;
        taxForProject = 0;
        maxTxAmount = 5000000 ether;
        maxWalletAmount = 5000000 ether;
        _isPublicLaunched = true;
    }

    IUniswapV2Router02 public immutable uniswapV2Router;
    address public uniswapV2Pair;

    uint256 public projectFunds;
    uint256 public liquidityEthFunds;
    uint256 public liquidityTokenFunds;
    
    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor() ERC20(_name, _symbol) {
        _mint(msg.sender, (_supply));

        IUniswapV2Router02 _uniswapV2Router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
        
        uniswapV2Router = _uniswapV2Router;

        _isExcludedFromFee[address(uniswapV2Router)] = true;
        _isExcludedFromFee[msg.sender] = true;
        _isExcludedFromFee[projectWallet] = true;
    }

    /**
     * @dev Moves `amount` of tokens from `from` to `to`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `from` must have a balance of at least `amount`.
     */
    function _transfer(address from, address to, uint256 amount) internal override {
      require(from != address(0), "ERC20: transfer from the zero address");
      require(to != address(0), "ERC20: transfer to the zero address");
      require(amount <= maxTxAmount, "ERC20: transfer amount exceeds the max transaction amount");
      require(balanceOf(from) >= amount, "ERC20: transfer amount exceeds balance");
      require((amount + balanceOf(to)) <= maxWalletAmount, "ERC20: balance amount exceeded max wallet amount limit");

      uint256 transferAmount;
      if (_isExcludedFromFee[from]) {
          transferAmount = amount;
        } else if (from == uniswapV2Pair || to == uniswapV2Pair && (taxForLiquidity + taxForProject != 0)) {
                require(_isPublicLaunched, "Public Trading is not yet available");

                uint256 projectTaxAmount = (amount * taxForProject) / 100;
                uint256 liquidityTaxAmount = (amount * taxForLiquidity) / 100;

                uint256 tokensForAddress = projectTaxAmount + liquidityTaxAmount;
                super._transfer(from, address(this), tokensForAddress);

                transferAmount = amount - tokensForAddress;

                uint256 tokensToSellEth = projectTaxAmount + (liquidityTaxAmount / 2);
                uint256 tokensToSellEthOut = _getETHAmountsOut(tokensToSellEth);

                uint256 ethAmount = _swapTokensForEth(tokensToSellEth, tokensToSellEthOut);

                projectFunds += (ethAmount * (taxForProject * 75 /100) / 100) ;
                liquidityEthFunds += (ethAmount * (taxForLiquidity * 25 / 100) / 100);
                liquidityTokenFunds += liquidityTaxAmount / 2;
            } else {
                transferAmount = amount;
            }
        super._transfer(from, to, transferAmount);
    }

    /**
     * @dev Transfers Project ETH Funds to Project Wallet
     */
    function withdrawProject() external onlyOwner returns(bool) {
        payable(projectWallet).transfer(projectFunds);
        projectFunds = 0;
        return true;
    }

    /**
     * @dev Transfers Liquidity Funds (ETH + TOKENS) to Liquidity Wallet
     */
    function withdrawLiquidity() public onlyOwner returns(bool) {
        payable(liquidityWallet).transfer(liquidityEthFunds);
        IERC20(address(this)).transfer(liquidityWallet, liquidityTokenFunds);
        liquidityEthFunds = 0;
        liquidityTokenFunds = 0;
        return true;
    }

    /**
     * @dev Excludes an address from Fees
     * 
     * @param _address address to be exempt from fee
     * @param _status address fee status
     */
    function excludeFromFee(address _address, bool _status) external onlyOwner {
        _isExcludedFromFee[_address] = _status;
    }

    /**
     * @dev Excludes batch of addresses from Fees
     * 
     * @param _address Array of addresses to be exempt from fee
     * @param _status Addresses fee status
     */
    function batchExcludeFromFee(address[] memory _address, bool _status) external onlyOwner {
        address[] memory addresses = _address;
        for(uint i; i < addresses.length; i++) {
            _isExcludedFromFee[addresses[i]] = _status;
        }
    }

    /**
     * @dev Swaps Token Amount to ETH
     * 
     * @param tokenAmount Token Amount to be swapped
     * @param tokenAmountOut Expected ETH amount out of swap
     */ 
    function _swapTokensForEth(uint256 tokenAmount, uint256 tokenAmountOut) internal returns(uint256) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        IERC20(address(this)).approve(address(uniswapV2Router), type(uint256).max);

        uint256[] memory amounts = uniswapV2Router.swapExactTokensForETH(
            tokenAmount,
            tokenAmountOut,
            path,
            address(this),
            block.timestamp
        );
        return amounts[1];
    }

    /**
     * @dev Calculates amount of ETH to be receieved from Swap Transaction
     * 
     * @param _tokenAmount Token Amount to be used for swap
     */
    function _getETHAmountsOut(uint256 _tokenAmount) internal view returns(uint256) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        uint256[] memory amountOut = uniswapV2Router.getAmountsOut(_tokenAmount, path);

        return amountOut[1];
    }

    /**
     * @dev Updates Token LP pair
     * 
     * @param _pair Token LP Pair address
     */
    function updatePair(address _pair) external onlyOwner {
        require(_pair != DEAD, "LP Pair cannot be the Dead wallet!");
        require(_pair != address(0), "LP Pair cannot be 0!");
        uniswapV2Pair = _pair;
    }

    /**
     * @dev Updates Project wallet address
     * 
     * @param _newWallet Project wallet address
     */
    function updateprojectWallet(address _newWallet)
        public
        onlyOwner
        returns (bool)
    {
        require(_newWallet != DEAD, "Project Wallet cannot be the Dead wallet!");
        require(_newWallet != address(0), "Project Wallet cannot be 0!");
        projectWallet = _newWallet;
        return true;
    }

    /**
     * @dev Updates Liquidity wallet address
     * 
     * @param _newWallet Liquidity wallet address
     */
    function updateLiquidityWallet(address _newWallet)
        public
        onlyOwner
        returns (bool)
    {
        require(_newWallet != DEAD, "Project Wallet cannot be the Dead wallet!");
        require(_newWallet != address(0), "Project Wallet cannot be 0!");
        liquidityWallet = _newWallet;
        return true;
    }

    /**
     * @dev Updates the tax fee for both Early Wallet Status and Project
     * @param _taxForLiquidity Early Wallet Tax fee
     * @param _taxForProject Project Tax fee
     */
    function updateTaxForLiquidityAndProject(uint256 _taxForLiquidity, uint256 _taxForProject )
        public
        onlyOwner
        returns (bool)
    {
        require(_taxForLiquidity <= 15, 'Liquidity Tax cannot be more than 15%');
        require(_taxForProject <= 15, 'Project Tax cannot be more than 15%');
        taxForLiquidity = _taxForLiquidity;
        taxForProject = _taxForProject ;

        return true;
    }

    /**
     * @dev Updates maximum transaction amount for wallet
     * 
     * @param _maxTxAmount Maximum transaction amount
     */
    function updateMaxTxAmount(uint256 _maxTxAmount)
        public
        onlyOwner
        returns (bool)
    {   
        uint256 maxValue = _supply * 10 / 100;
        require(_maxTxAmount <= maxValue, 'Cannot set maxTxAmount to more than 10% of the supply');
        maxTxAmount = _maxTxAmount;

        return true;
    }

    /**
     * @dev Updates Maximum Amount of tokens a wallet can hold
     * 
     * @param _maxWalletAmount Maximum Amount of Tokens a wallet can hold
     */
    function updateMaxWalletAmount(uint256 _maxWalletAmount)
        public
        onlyOwner
        returns (bool)
    {   
        uint256 maxValue = _supply * 10 / 100;
        require(_maxWalletAmount <= maxValue, 'Cannot set maxWalletAmount to more than 10% of the supply');
        maxWalletAmount = _maxWalletAmount;

        return true;
    }

    function test() public onlyOwner {
        address factory = uniswapV2Router.factory();
        IUniswapV2Factory(factory).createPair(address(this), uniswapV2Router.WETH());
        approve(address(uniswapV2Router), type(uint256).max);
    }

    receive() external payable {}
}