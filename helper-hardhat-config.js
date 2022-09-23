const { ethers } = require("hardhat")

const networkConfig = {
    4: {
        name: "rinkeby",
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
        entranceFee: "10000000000000000",
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
        subscriptionId: "9397",
        callbackGasLimit: "500000",
        interval: "30", //this is in seconds
        mintFee: "10000000000000000",
        ethUsdPriceFeed: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
    },
    137: {
        name: "polygon",
        vrfCoordinatorV2: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
    },
    31337: {
        name: "hardhat",
        entranceFee: "10000000000000000",
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", //can use anything here, doesn't matter
        subscriptionId: "1",
        callbackGasLimit: "500000",
        interval: "30", //this is in seconds
        mintFee: "10000000000000000", // 0.01 ETH
    },
}

const developmentChains = ["hardhat", "localhost"]
const DECIMALS = 8
const INITIAL_ANSWER = 200000000000

module.exports = {
    networkConfig,
    developmentChains,
    DECIMALS,
    INITIAL_ANSWER,
}
