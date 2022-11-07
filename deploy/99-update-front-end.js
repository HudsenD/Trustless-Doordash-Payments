const { ethers, network } = require("hardhat")
const fs = require("fs")
const frontEndContractsFile = "../doordash-payments-website/constants/networkMapping.json"
const frontEndAbiLocation = "../doordash-payments-website/constants/"

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating Front End...")
        await updateContractAddresses()
        await updateABI()
    }
}

async function updateABI() {
    const doordashPayments = await ethers.getContract("DoordashPayments")
    fs.writeFileSync(
        `${frontEndAbiLocation}DoordashPayments.json`,
        doordashPayments.interface.format(ethers.utils.FormatTypes.json)
    )
}

async function updateContractAddresses() {
    const doordashPayments = await ethers.getContract("DoordashPayments")
    const chainId = network.config.chainId.toString()
    const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"))
    if (chainId in contractAddresses) {
        if (!contractAddresses[chainId]["DoordashPayments"].includes(doordashPayments.address)) {
            contractAddresses[chainId]["DoordashPayments"].push(doordashPayments.address)
        }
    } else {
        contractAddresses[chainId] = { DoordashPayments: [doordashPayments.address] }
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses))
}

module.exports.tags = ["all", "frontend"]
