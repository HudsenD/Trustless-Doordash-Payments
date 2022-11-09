// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.7;

// eventually make this erc20 compatable
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error DoordashPayments__AlreadyDelivered();
error DoordashPayments__NotYourOrder();
error DoordashPayments__InsufficientBalance();
error DoordashPayments__TransferFailed();
error DoordashPayments__InsufficientValue();
error DoordashPayments__DriverNotAssigned();
error DoordashPayments__InvalidOrderId();
error DoordashPayments__WaitMoreTime();

/** @title A payment system for Doordash
 * @author Hudsen Durst
 * @notice This contract that ensures Doordash can't take tips from drivers
 * @dev Contract implements Ownable and ReentrancyGuard from openzeppelin
 */

contract DoordashPayments is Ownable, ReentrancyGuard {
    /* State Variables */
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

    /* Events */

    event FoodOrdered(address indexed buyer, uint256 indexed orderId);
    event OrderDelivered(uint256 indexed orderId, address indexed driver, address indexed buyer);

    // OrderID -> FoodOrder
    mapping(uint256 => FoodOrder) s_idtoFoodOrder;
    // User address -> User
    mapping(address => User) s_users;

    modifier isDelivered(uint256 orderId) {
        if (s_idtoFoodOrder[orderId].isDelivered == true) {
            revert DoordashPayments__AlreadyDelivered();
        }
        _;
    }

    /////////////////////
    // Main Functions //
    /////////////////////
    /**
     * @notice Method for handling new food orders from customers
     * @param tipAmount: tip that gets paid to delivery driver
     * @dev Function reverts if msg.value is 0 or if tipAmount is greater then msg.value
     */
    function orderFood(uint256 tipAmount) external payable {
        if (msg.value <= 0 || tipAmount > msg.value) {
            revert DoordashPayments__InsufficientValue();
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

    /**
     * @notice Method for Doordash to assign a delivery driver to an order
     * @param driver: Address of driver being assigned to the order
     * @param orderId: The ID of the food order
     * @dev Function can only be called by contracts owner
     */

    function assignDriver(address driver, uint256 orderId) external onlyOwner isDelivered(orderId) {
        if (s_idtoFoodOrder[orderId].buyer == address(0)) {
            revert DoordashPayments__InvalidOrderId();
        }
        s_idtoFoodOrder[orderId].driver = driver;
        s_idtoFoodOrder[orderId].assignTime = block.timestamp;
    }

    /**
     * @notice Method for the buyer of the food to mark the order as delivered
     * @param orderId: The ID of the food order
     * @dev Function checks if order has been delivered using the isDelivered modifier so tips cannot be paid twice.
     * Function can only be called by the buyer
     */

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
        emit OrderDelivered(orderId, driver, foodOrder.buyer);
    }

    /**
     * @notice Method for the delivery driver of the food to mark the order as delivered
     * @param orderId: The ID of the food order
     * @dev This function checks that its been at least 2 hours since a driver was assigned
     * to prevent drivers from recieving their tips before the order is actually delivered
     */

    function driverDelivered(uint256 orderId) external isDelivered(orderId) {
        if (msg.sender != s_idtoFoodOrder[orderId].driver) {
            revert DoordashPayments__NotYourOrder();
        }
        if (block.timestamp < s_idtoFoodOrder[orderId].assignTime + 2 hours) {
            revert DoordashPayments__WaitMoreTime();
        }
        _delivered(orderId);
    }

    /**
     * @notice Method for anyone to withdraw their funds(tips, refunds) from contract
     * @param amount: Amount in wei user wants to withdraw from contract
     * @dev Uses nonReentrant modifier from openzeppelin
     */
    function withdrawBalance(uint256 amount) external nonReentrant {
        if (s_users[msg.sender].balance < amount) {
            revert DoordashPayments__InsufficientBalance();
        }
        s_users[msg.sender].balance -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert DoordashPayments__TransferFailed();
        }
    }

    /**
     * @notice Method for Doordash to refund a user if an order is canceled
     * @param user: Address of person to refund
     * @param amount: Amount in wei to add to users balance
     * @dev Function can only be called by contracts owner
     */

    function refundUser(address user, uint256 amount) public onlyOwner {
        if (s_users[owner()].balance < amount) {
            revert DoordashPayments__InsufficientBalance();
        }
        s_users[owner()].balance -= amount;
        s_users[user].balance += amount;
    }

    /**
     * @notice Method for Doordash to cancel an order which automatically refunds the buyer
     * @param orderId: The ID of the food order
     * @param amount: Total amount in wei paid by user for that order
     * @dev Function can only be called by contracts owner
     */

    function cancelOrder(uint256 orderId, uint256 amount) external onlyOwner {
        FoodOrder memory foodOrder = s_idtoFoodOrder[orderId];
        address user = foodOrder.buyer;
        s_idtoFoodOrder[orderId].tipAmount = 0;
        s_users[user].balance += foodOrder.tipAmount;

        refundUser(user, amount);
    }

    /**
     * @notice Method for anyone to deposit eth into contract.
     * @dev Function reverts if no value is being deposited
     */

    function depositEth() external payable {
        if (msg.value <= 0) {
            revert DoordashPayments__InsufficientValue();
        }
        s_users[msg.sender].balance += msg.value;
    }

    /////////////////////
    // Getter Functions //
    /////////////////////

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
