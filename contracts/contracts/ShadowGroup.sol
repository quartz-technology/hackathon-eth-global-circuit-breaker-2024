//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";

contract ShadowGroup {
    ISemaphore public semaphore;
    uint256 public groupID;

    uint256 public quorum;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint numConfirmations;
    }

    Transaction[] public transactions;

    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "tx does not exist");
        _;
    }

    modifier notExecuted(uint _txIndex) {
        require(!transactions[_txIndex].executed, "tx already executed");
        _;
    }

    constructor(
        address _semaphoreAddress,
        uint256 _groupID,
        uint256[] memory _ownersIdentityCommitments,
        uint256 _quorum
    ) {
        require(
            _ownersIdentityCommitments.length > 0,
            "at least one owner identity commitment is required to create the ShadowGroup"
        );
        require(
            _quorum > 0 && _quorum <= _ownersIdentityCommitments.length,
            "invalid quorum value"
        );

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
        uint256 _externalNullifier,
        uint256[8] calldata _proof
    ) public {
        uint256 signal = uint256(keccak256(abi.encodePacked(_to, _value, _data)));

        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, _externalNullifier, _proof);

        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            numConfirmations: 0
        }));
    }

    function confirmTransaction(
        uint _txIndex,
        uint256 _merkleTreeRoot,
        uint256 _nullifierHash,
        uint256 _externalNullifier,
        uint256[8] calldata _proof
    ) txExists(_txIndex) notExecuted(_txIndex) public {
        uint256 signal = uint256(keccak256(abi.encodePacked(true)));
        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, _externalNullifier, _proof);

        transactions[_txIndex].numConfirmations += 1;
    }

    function revokeConfirmation(
        uint _txIndex,
        uint256 _merkleTreeRoot,
        uint256 _nullifierHash,
        uint256 _externalNullifier,
        uint256[8] calldata _proof
    ) txExists(_txIndex) notExecuted(_txIndex) public {
        require(transactions[_txIndex].numConfirmations > 0, "tx has no confirmations yet");

        uint256 signal = uint256(keccak256(abi.encodePacked(false)));
        semaphore.verifyProof(groupID, _merkleTreeRoot, signal, _nullifierHash, _externalNullifier, _proof);

        transactions[_txIndex].numConfirmations -= 1;
    }

    function executeTransaction(uint _txIndex) txExists(_txIndex) notExecuted(_txIndex) public {
        Transaction storage transaction = transactions[_txIndex];
        require(transaction.numConfirmations >= quorum, "cannot execute tx");

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "tx failed");
    }

    receive() external payable {
    }
}
