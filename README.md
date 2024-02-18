# 👤 0xShadows

A multi-signature wallet where owners can anonymously submit / approve / reject transactions.

## Security Considerations

It was made during a hackathon, so obviously it's full of bugs.
Don't ever use this with real money / on mainnet.

## Description

This project improves the concept of a multi-signature wallet, an on-chain application where several members are grouped together to manage a wallet and where each operation has to be approved by a quorum prior to be executed.

Instead of the members having their votes (either approvals or disapprovals) being made public, this solution keeps those private while ensuring no one is able to vote twice.
This way, nobody is able to know which member has casted which vote while preserving the system's integrity.

## How it's made

0xShadows is composed of two parts:

- [The smart contract](./contracts).
- [The dApp](./frontend).

The smart contract is a Solidity implementation of a simple multi-signature wallet, were owners are stored in a Semaphore group.
The smart contract implementation has been heavily tested using Hardhat.
Using Semaphore here has a huge benefit: only authorized members - the owners - can submit the transactions and approve or reject them while preserving their privacy as nobody can be able to know which of the members has performed the said operation.
Using Semaphore also prevents double-signaling, where a member could approve a transaction twice.

Then, on the dApp side, we created a NextJS application which makes it easy to interact with the Shadow Groups.
On the same page you can generate a new Semaphore identity, create and customize a shadow group, submit new transactions, approve / reject and execute them.

All users use a common Ethereum account to submit their transactions - this way it "hides" the calle identity. We could easily swap this implementation by using OZ Actions, but this one was simpler to do.
