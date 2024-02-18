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
};

export default function TransactionTable({ qorum, transactions }: ITransactionTableProps) {
    const approveTransaction = async (transaction: ITransaction) => {
        // TODO.
    };

    const revokeTransaction = async (transaction: ITransaction) => {
        // TODO.
    };

    const executeTransaction = async (transaction: ITransaction) => {
        // TODO.
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
                  <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
                    <CheckIcon />
                  </span>
                </Tooltip>
                <Tooltip color="danger" content="Revoke">
                  <span className="text-lg text-danger cursor-pointer active:opacity-50">
                    <CrossIcon />
                  </span>
                </Tooltip>
                <Tooltip content="Execute">
                  <span className="text-lg text-default-400 cursor-pointer active:opacity-50">
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