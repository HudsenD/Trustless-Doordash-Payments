// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

// eventually make this erc20 compatable
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error DoordashPayments__AlreadyDelivered();
error DoordashPayments__NotYourOrder();
error DoordashPayments__InsufficientBalance();
error DoordashPayments__TransferFailed();
error DoordashPayments__NoValue();
error DoordashPayments__DriverNotAssigned();
error DoordashPayments__InvalidOrderId();
error DoordashPayments__WaitMoreTime();

contract DoordashPayments is Ownable, ReentrancyGuard {
    uint256 orderCounter;

    struct FoodOrder {
        address buyer;
        address driver;
        uint256 tipAmount;
        bool isDelivered;
        uint256 assignTime;
    }

    struct User {
        uint256 balance;
        uint256 lastOrderId;
    }

    event FoodOrdered(address indexed buyer, uint256 indexed orderId);

    mapping(uint256 => FoodOrder) s_idtoFoodOrder;
    mapping(address => User) s_users;

    modifier isDelivered(uint256 orderId) {
        if (s_idtoFoodOrder[orderId].isDelivered == true) {
            revert DoordashPayments__AlreadyDelivered();
        }
        _;
    }

    function orderFood(uint256 tipAmount) external payable {
        if (msg.value <= 0) {
            revert DoordashPayments__NoValue();
        }
        uint256 orderId = orderCounter;
        orderCounter++;
        uint256 payment = msg.value - tipAmount;
        s_users[owner()].balance += payment;
        s_users[msg.sender].lastOrderId = orderId;
        FoodOrder memory foodOrder;
        foodOrder.buyer = msg.sender;
        foodOrder.tipAmount = tipAmount;
        s_idtoFoodOrder[orderId] = foodOrder;
        emit FoodOrdered(msg.sender, orderId);
    }

    function assignDriver(address driver, uint256 orderId) external onlyOwner isDelivered(orderId) {
        if (s_idtoFoodOrder[orderId].buyer == address(0)) {
            revert DoordashPayments__InvalidOrderId();
        }
        s_idtoFoodOrder[orderId].driver = driver;
        s_idtoFoodOrder[orderId].assignTime = block.timestamp;
    }

    function buyerDelivered(uint256 orderId) external isDelivered(orderId) {
        FoodOrder memory foodOrder = s_idtoFoodOrder[orderId];
        if (msg.sender != foodOrder.buyer) {
            revert DoordashPayments__NotYourOrder();
        }
        if (foodOrder.driver == address(0)) {
            revert DoordashPayments__DriverNotAssigned();
        }
        _delivered(orderId);
    }

    function _delivered(uint256 orderId) internal {
        s_idtoFoodOrder[orderId].isDelivered = true;
        FoodOrder memory foodOrder = s_idtoFoodOrder[orderId];
        address driver = foodOrder.driver;
        uint256 tipAmount = foodOrder.tipAmount;
        s_users[driver].balance += tipAmount;
    }

    function driverDelivered(uint256 orderId) external isDelivered(orderId) {
        if (msg.sender != s_idtoFoodOrder[orderId].driver) {
            revert DoordashPayments__NotYourOrder();
        }
        if (block.timestamp < s_idtoFoodOrder[orderId].assignTime + 2 hours) {
            revert DoordashPayments__WaitMoreTime();
        }
        _delivered(orderId);
    }

    // drivers can call this to get their tips, users will also call this to receive a refund
    function withdrawBalance(uint256 amount) external nonReentrant {
        if (s_users[msg.sender].balance < amount) {
            // was <=, make sure i didn't mess this up
            revert DoordashPayments__InsufficientBalance();
        }
        s_users[msg.sender].balance -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert DoordashPayments__TransferFailed();
        }
    }

    function refundUser(address user, uint256 amount) public onlyOwner {
        if (s_users[owner()].balance < amount) {
            revert DoordashPayments__InsufficientBalance();
        }
        s_users[owner()].balance -= amount;
        s_users[user].balance += amount;
    }

    function cancelOrder(uint256 orderId, uint256 amount) external onlyOwner {
        FoodOrder memory foodOrder = s_idtoFoodOrder[orderId];
        address user = foodOrder.buyer;
        s_idtoFoodOrder[orderId].tipAmount = 0;
        s_users[user].balance += foodOrder.tipAmount;

        refundUser(user, amount);
    }

    function depositEth() external payable {
        if (msg.value <= 0) {
            revert DoordashPayments__NoValue();
        }
        s_users[msg.sender].balance += msg.value;
    }

    function getLastOrderId(address user) external view returns (uint256) {
        return s_users[user].lastOrderId;
    }

    function getBalance(address user) external view returns (uint256) {
        return s_users[user].balance;
    }

    function getFoodOrder(uint256 orderId) external view returns (FoodOrder memory) {
        return s_idtoFoodOrder[orderId];
    }
}
