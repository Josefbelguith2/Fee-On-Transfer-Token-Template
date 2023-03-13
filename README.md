# feeToken-contracts

<img alt="Solidity" src="https://img.shields.io/badge/Solidity-e6e6e6?style=for-the-badge&logo=solidity&logoColor=black"/> <img alt="Javascript" src="https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E"/>

This repository contains the Solidity Smart Contracts for a Fee on Transfer Token that:
- Taxes swap transactions
- One tax gets swapped to ETH and is sent to a designated wallet
- One tax is designated for Liquidity where half the tokens are swapped to ETH and get sent to a liquidity wallet.

## Prerequisites

-   git
-   npm
-   hardhat

## Getting started

-   Clone the repository

```sh
git clone https://github.com/nonceblox/myosin-contracts
```

-   Navigate to `feeToken-contracts` directory

```sh
cd feeToken-contracts
```

-   Install dependencies

```sh
npm install
```

### Configure project

-   Configure the .env

```sh
cp .example.env .env
```

## Run tests

-   Run Tests

```sh
npm run test
```

### Deploy to Blockchain Network

```sh
npx hardhat run --network <your-network> scripts/<deployment-file>
```

## Verify smart contracts

```sh
npx hardhat verify --network <network-name-in-hardhat-config> DEPLOYED_CONTRACT_ADDRESS "Constructor arguments"
```
