# Trustless Doordash Payments

**I am still working on this project and will make updates to the code and this ReadMe as I make more progress**

This is a project made for Doordash, Ubereats, Grubhub, or similar service that ensures full
customer tips make it to the delivery driver. When a customer orders food on Doordash's website,
they call the orderFood() function which takes an input for the tip amount on that order. This
amount is saved in the contract and becomes available to withdraw once the order is delivered.
Once marked delivered, the driver assigned to the order automatically gets the tip added to
their balance within the contract.
