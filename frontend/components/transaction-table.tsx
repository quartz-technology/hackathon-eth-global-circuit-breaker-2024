import {
    ChipProps,
    Table,
    TableHeader,
    TableRow,
    TableBody,
    TableCell,
    TableColumn,
    Chip,
    Tooltip,
} from "@nextui-org/react";
import * as React from 'react';
import {
    CheckIcon,
    CrossIcon,
    TriangleIcon,
} from "./actions-buttons";
import { getContract, Address, createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import shadowGroup from '@/components/shadow-group.json';
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof";
import { generateConfirmTransactionExternalNullifier, generateConfirmTransactionSignal, generateRevokeTransactionExternalNullifier, generateRevokeTransactionSignal } from "@/utils/shadow";

const columns = [
    {
        name: "TX INDEX",
        uid: "txIndex",
    },
    {
        name: "STATUS",
        uid: "status",
    },
    {
        name: "ACTIONS",
        uid: "actions",
    },
];

const statusColorMap: Record<string, ChipProps["color"]>  = {
    executed: "success",
    revoked: "danger",
    active: "warning",
  };

export interface ITransaction {
    id: number;
    to: string;
    value: string;
    data: string;
    executed: boolean;
    numConfirmations: number;
    numRevocations: number;
};

export interface ITransactionTableProps {
    shadowGroupAddress: string;
    qorum: number;
    transactions: ITransaction[];
    identity: Identity;
    identitiesCommitments: string[];
    groupID: string;
};

export default function TransactionTable({ shadowGroupAddress, qorum, transactions, identity, identitiesCommitments, groupID }: ITransactionTableProps) {
    const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
        account: privateKeyToAccount("0x4c88eccb34856d59199d14fee223d27b4cabffe1de5b2f5075765c92eab784b5"),
    });
    const contract = getContract({
        address: shadowGroupAddress as Address,
        abi: shadowGroup.abi,
        client: walletClient,
    });

    const approveTransaction = async (transaction: ITransaction) => {
        console.log("Approving transaction", transaction);

        const group = new Group(groupID, 20, identitiesCommitments);

        const generatedSignal = generateConfirmTransactionSignal();
        const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(transaction.id, generatedSignal);

        const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
            identity,
            group,
            generatedExternalNullifier,
            generatedSignal,
        );

        const txHash = await contract.write.confirmTransaction([transaction.id, merkleTreeRoot, nullifierHash, proof]);
        console.log(txHash);
    };

    const revokeTransaction = async (transaction: ITransaction) => {
        console.log("Revoking transaction", transaction);

        const group = new Group(groupID, 20, identitiesCommitments);

        const generatedSignal = generateRevokeTransactionSignal();
        const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(transaction.id, generatedSignal);

        const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
            identity,
            group,
            generatedExternalNullifier,
            generatedSignal,
        );

        const txHash = await contract.write.revokeTransaction([transaction.id, merkleTreeRoot, nullifierHash, proof]);
        console.log(txHash);
    };

    const executeTransaction = async (transaction: ITransaction) => {
        console.log("Executing transaction", transaction);

        const txHash = await contract.write.executeTransaction([transaction.id]);
        console.log(txHash);
    };

    const computeStatus = React.useCallback((transaction: ITransaction) => {
        if (transaction.numRevocations >= qorum) {
            return "revoked";
        }

        if (transaction.executed) {
            return "executed";
        }

        return "active";
    }, [qorum]);

    const renderCell = React.useCallback((transaction: ITransaction, columnKey: React.Key) => {
        const cellValue = transaction[columnKey as keyof ITransaction];
    
        switch (columnKey) {
          case "txIndex":
            const recap = `To: ${transaction.to}, Value: ${transaction.value}, Data: ${transaction.data}`;

            return (
                <Tooltip content={recap}>
                    <Chip className="capitalize" size="sm" variant="flat">
                        {transaction.id}
                    </Chip>
                </Tooltip>
            );
          case "status":
            return (
              <Chip className="capitalize" color={statusColorMap[computeStatus(transaction)]} size="sm" variant="flat">
                {computeStatus(transaction)}
              </Chip>
            );
          case "actions":
            return (
              <div className="relative flex items-center gap-2">
                <Tooltip color="success" content="Approve">
                  <span className="text-lg text-default-400 cursor-pointer active:opacity-50" onClick={async () => {
                    await approveTransaction(transaction);
                  }}>
                    <CheckIcon />
                  </span>
                </Tooltip>
                <Tooltip color="danger" content="Revoke">
                  <span className="text-lg text-danger cursor-pointer active:opacity-50" onClick={async () => {
                    await revokeTransaction(transaction);
                  }}>
                    <CrossIcon />
                  </span>
                </Tooltip>
                <Tooltip content="Execute">
                  <span className="text-lg text-default-400 cursor-pointer active:opacity-50" onClick={async () => {
                    await executeTransaction(transaction);
                  }}>
                    <TriangleIcon />
                  </span>
                </Tooltip>
              </div>
            );
          default:
            return cellValue;
        }
      }, [computeStatus]);
    
      return (
        <Table aria-label="Example table with custom cells">
            <TableHeader columns={columns}>
                {(column) => (
                <TableColumn key={column.uid} align={column.uid === "actions" ? "center" : "start"}>
                    {column.name}
                </TableColumn>
                )}
            </TableHeader>
            <TableBody items={transactions}>
                {(item) => (
                <TableRow key={item.id}>
                    {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
                )}
            </TableBody>
        </Table>
      );
}