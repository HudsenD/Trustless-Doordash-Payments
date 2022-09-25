const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", function () {
          let doordashPayments, doordashPaymentsPlayer, deployer, player
          const PRICE = ethers.utils.parseEther("0.01")
          const TIP_AMOUNT = ethers.utils.parseEther("0.005")
          provider = ethers.provider
          const TOKEN_ID = 0

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              player = (await getNamedAccounts()).player
              await deployments.fixture(["all"])
              doordashPayments = await ethers.getContract("DoordashPayments")
              doordashPaymentsPlayer = await ethers.getContract("DoordashPayments", player)
          })
          describe("orderFood", function () {
              it("emits a FoodOrdered Event", async function () {
                  expect(await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })).to.emit("FoodOrdered")
              })
              it("reverts if msg.value is 0", async function () {
                  await expect(doordashPayments.orderFood(TIP_AMOUNT)).to.be.revertedWith("NoValue")
              })
              it("updates struct with correct info", async function () {
                  const tx = await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  const txReciept = await tx.wait(1)
                  const { buyer, tipAmount } = await doordashPayments.getFoodOrder(txReciept.events[0].args.orderId) //get orderId from event
                  assert.equal(buyer, deployer)
                  assert.equal(tipAmount.toString(), TIP_AMOUNT)
              })
              it("updates owners balance correctly", async function () {
                  const tx = await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  const ownerBalance = await doordashPayments.getBalance(deployer)
                  assert.equal(PRICE - TIP_AMOUNT, ownerBalance.toString())
              })
              it("updates lastOrderId correctly", async function () {})
          })
          describe("assignDriver", function () {
              it("reverts if caller is not owner", async function () {
                  await expect(doordashPaymentsPlayer.assignDriver(player, "0")).to.be.revertedWith("")
              })
              it("reverts if order was already delivered", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  await doordashPayments.buyerDelivered("0")
                  await expect(doordashPayments.assignDriver(player, "0")).to.be.revertedWith("AlreadyDelivered")
              })
              it("reverts if OrderId doesn't exist", async function () {
                  await expect(doordashPayments.assignDriver(player, "4")).to.be.revertedWith("InvalidOrderId")
              })
              it("updates FoodOrder struct with inputed driver", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  const { driver } = await doordashPayments.getFoodOrder("0")
                  assert.equal(driver, player)
              })
          })
          describe("buyerDelivered", function () {
              it("emits OrderDelivered Event", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  expect(await doordashPayments.buyerDelivered("0")).to.emit("OrderDelivered")
              })
              it("reverts if msg.sender is not the buyer", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  await expect(doordashPaymentsPlayer.buyerDelivered("0")).to.be.revertedWith("NotYourOrder")
              })
              it("reverts if order doesn't have a driver", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await expect(doordashPayments.buyerDelivered("0")).to.be.revertedWith("DriverNotAssigned")
              })
              it("marks order as delivered, adds tip to drivers balance", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  const startBalance = await doordashPayments.getBalance(player)
                  await doordashPayments.buyerDelivered("0")
                  const endBalance = await doordashPayments.getBalance(player)
                  const { isDelivered } = await doordashPayments.getFoodOrder("0")
                  assert.equal(startBalance.toNumber() + TIP_AMOUNT, endBalance.toNumber())
                  assert.equal(isDelivered, true)
              })
          })
          describe("driverDelivered", function () {
              it("reverts if msg.sender is not driver", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  await expect(doordashPayments.driverDelivered("0")).to.be.revertedWith("NotYourOrder")
              })
              it("reverts if it hasn't been 2 hours since assign driver was called", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  await expect(doordashPaymentsPlayer.driverDelivered("0")).to.be.revertedWith("WaitMoreTime")
              })
              it("marks order as delivered, adds tip to drivers balance when its been 2 hours since driver was assigned", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  const startBalance = await doordashPayments.getBalance(player)
                  await network.provider.send("evm_increaseTime", [7200])
                  await doordashPaymentsPlayer.driverDelivered("0")
                  const endBalance = await doordashPayments.getBalance(player)
                  const { isDelivered } = await doordashPayments.getFoodOrder("0")
                  assert.equal(startBalance.toNumber() + TIP_AMOUNT, endBalance.toNumber())
                  assert.equal(isDelivered, true)
              })
          })
          describe("withdrawBalance", function () {
              it("reverts if msg.sender withdraws more then thier balance", async function () {
                  await expect(doordashPayments.withdrawBalance(PRICE)).to.be.revertedWith("InsufficientBalance")
              })
              it("updates msg.senders balance correctly, allows driver to withdraw tip", async function () {
                  await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.assignDriver(player, "0")
                  await doordashPayments.buyerDelivered("0")
                  const startBalance = await doordashPayments.getBalance(player)
                  const tx = await doordashPaymentsPlayer.withdrawBalance(startBalance.toString())
                  await tx.wait(1)
                  const endBalance = await doordashPayments.getBalance(player)
                  assert.equal(startBalance.toString(), TIP_AMOUNT)
                  assert.equal(endBalance.toString(), "0")
              })
          })
          describe("refundUser", function () {
              it("reverts if msg.sender is not contract owner", async function () {
                  await expect(doordashPaymentsPlayer.refundUser(player, PRICE)).to.be.revertedWith(
                      "Ownable: caller is not the owner"
                  )
              })
              it("reverts if owner doesn't have enough balance to do refund", async function () {
                  await expect(doordashPayments.refundUser(player, PRICE)).to.be.revertedWith("InsufficientBalance")
              })
              it("updates refunded users, owners balances correctly", async function () {
                  const startBalance = await doordashPayments.getBalance(player)
                  const ownerStartBalance = await doordashPayments.getBalance(deployer)
                  await doordashPayments.depositEth({ value: PRICE })
                  await doordashPayments.refundUser(player, PRICE)
                  const endBalance = await doordashPayments.getBalance(player)
                  const ownerEndBalance = await doordashPayments.getBalance(deployer)
                  assert.equal(endBalance.toString() - startBalance.toString(), PRICE)
                  assert.equal(ownerEndBalance.toString() - ownerStartBalance.toString(), "0")
              })
          })
          describe("cancelOrder", function () {
              it("reverts if msg.sender is not contract owner", async function () {
                  await doordashPaymentsPlayer.orderFood(TIP_AMOUNT, { value: PRICE })
                  await expect(doordashPaymentsPlayer.cancelOrder("0", PRICE - TIP_AMOUNT)).to.be.revertedWith(
                      "Ownable: caller is not the owner"
                  )
              })
              it("returns tipAmount back to buyer", async function () {
                  await doordashPaymentsPlayer.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.cancelOrder("0", PRICE - TIP_AMOUNT)
                  const balance = await doordashPayments.getBalance(player)
                  assert.equal(PRICE, balance.toString())
              })
              it("sets tipAmount to zero", async function () {
                  await doordashPaymentsPlayer.orderFood(TIP_AMOUNT, { value: PRICE })
                  await doordashPayments.cancelOrder("0", PRICE - TIP_AMOUNT)
                  const { tipAmount } = await doordashPayments.getFoodOrder("0")
                  assert.equal(tipAmount.toString(), "0")
              })
          })
          describe("depositEth", function () {
              it("reverts if msg.value is zero", async function () {
                  await expect(doordashPayments.depositEth()).to.be.revertedWith("NoValue")
              })
              it("adds msg.value to msg.senders balance correctly", async function () {
                  const startBalance = await doordashPayments.getBalance(player)
                  await doordashPaymentsPlayer.depositEth({ value: PRICE })
                  const endBalance = await doordashPayments.getBalance(player)
                  assert.equal(endBalance.toString() - startBalance.toString(), PRICE)
              })
          })
          describe("getLastOrderId", function () {
              it("returns last order id for a user correctly", async function () {
                  await doordashPaymentsPlayer.orderFood(TIP_AMOUNT, { value: PRICE })
                  const tx = await doordashPayments.orderFood(TIP_AMOUNT, { value: PRICE })
                  const txReciept = await tx.wait(1)
                  const eventOrderId = txReciept.events[0].args.orderId
                  const lastOrderId = await doordashPayments.getLastOrderId(deployer)
                  assert.equal(eventOrderId.toString(), lastOrderId.toString())
              })
          })
      })
