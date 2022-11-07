# Trustless Doordash Payments

This is a project made for Doordash, Ubereats, Grubhub, or similar service that ensures full
customer tips make it to the delivery driver. When a customer orders food on the mock Doordash website,
it calls the orderFood() function which takes an input for the tip amount on that order. This
amount is saved in the contract and becomes available to withdraw once the order is delivered.
Once marked delivered, the driver assigned to the order automatically gets the tip added to
their balance within the contract. The driver is then able to withdraw their tip from the contract.

Future features I'd like to implement:

-   Add more events to functions to keep better track of order on frontend
-   Ability to pay with erc20 stablecoins like USDC

## Frontend

Here is the code for the website that connects to this project:

https://github.com/HudsenD/decentralized-doordash

## Technologies

Project is made with:

-   Solidity
-   Javascript
-   Hardhat
-   Openzeppelin
-   Ethers.js

## Demo

Frontend that connects to this contract:
https://decentralized-doordash.vercel.app/

## License

[MIT](https://choosealicense.com/licenses/mit/)
