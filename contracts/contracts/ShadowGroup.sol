//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

contract ShadowGroup {
    error InvalidInitialOwners();
    error TxDoesNotExist();
    error TxAlreadyExecuted();
    error InvalidQuorum();
    error TxRevoked();
    error QuorumNotReached();
    error TxExecutionFailed();

    ISemaphore public semaphore;
    uint256 public groupID;

    uint256 public quorum;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint32 numConfirmations;
        uint32 numRevocations;
    }

    Transaction[] public transactions;

    modifier txExists(uint _txIndex) {
        if (_txIndex >= transactions.length) revert TxDoesNotExist();
        _;
    }

    modifier txNotExecuted(uint _txIndex) {
        if (transactions[_txIndex].executed) revert TxAlreadyExecuted();
        _;
    }

    constructor(
        address _semaphoreAddress,
        uint256 _groupID,
        uint256[] memory _ownersIdentityCommitments,
        uint256 _quorum
    ) {
        if (_ownersIdentityCommitments.length == 0) revert InvalidInitialOwners();

        if (_quorum == 0 || _quorum > _ownersIdentityCommitments.length) revert InvalidQuorum();

        semaphore = ISemaphore(_semaphoreAddress);
        groupID = _groupID;

        semaphore.createGroup(groupID, 20, address(this));

        for (uint256 i = 0; i < _ownersIdentityCommitments.length; i++) {
            semaphore.addMember(groupID, _ownersIdentityCommitments[i]);
        }

        quorum = _quorum;
    }

    function submitTransaction(
        address _to,
        uint _value,
        bytes memory _data,
        uint256 _merkleTreeRoot,
        uint256 _nullifierHash,
        uint256[8] calldata _proof
    ) public {
        uint256 signal = uint256(keccak256(abi.encodePacked(_to, _value, _data)));
        // TODO: Explain why the externalNullifier is calculated this way (using the transactions.len as a challenge).
        uint256 externalNullifier = uint256(keccak256(abi.encodePacked(transactions.length, signal)));

        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, externalNullifier, _proof);

        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            numConfirmations: 0,
            numRevocations: 0
        }));
    }

    function confirmTransaction(
        uint _txIndex,
        uint256 _merkleTreeRoot,
        uint256 _nullifierHash,
        uint256[8] calldata _proof
    ) txExists(_txIndex) txNotExecuted(_txIndex) public {
        uint256 signal = uint256(keccak256(abi.encodePacked(true)));
        uint256 externalNullifier = uint256(keccak256(abi.encodePacked(_txIndex, signal)));

        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, externalNullifier, _proof);

        transactions[_txIndex].numConfirmations += 1;
    }

    function revokeTransaction(
        uint _txIndex,
        uint256 _merkleTreeRoot,
        uint256 _nullifierHash,
        uint256[8] calldata _proof
    ) txExists(_txIndex) txNotExecuted(_txIndex) public {
        uint256 signal = uint256(keccak256(abi.encodePacked(false)));
        uint256 externalNullifier = uint256(keccak256(abi.encodePacked(_txIndex, signal)));

        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, externalNullifier, _proof);

        transactions[_txIndex].numRevocations += 1;
    }

    function executeTransaction(uint _txIndex) txExists(_txIndex) txNotExecuted(_txIndex) public {
        if (transactions[_txIndex].numRevocations >= quorum) revert TxRevoked();

        Transaction storage transaction = transactions[_txIndex];
        if (transaction.numConfirmations < quorum) revert QuorumNotReached();

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );

        if (!success) revert TxExecutionFailed();
    }

    fallback() external payable {}
}
