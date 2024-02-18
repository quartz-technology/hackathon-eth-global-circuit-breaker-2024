import {
    Card,
    CardBody,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    useDisclosure,
    Textarea,
} from "@nextui-org/react";
import TransactionTable, { ITransaction } from "./transaction-table";
import * as React from 'react';

export interface IGroupPreviewProps {
    address: string;
};

export default function GroupPreview(props: IGroupPreviewProps) {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [qorum, setQuorum] = React.useState<number>(3);
    const [transactions, setTransactions] = React.useState<ITransaction[]>([]);

    const [newTxTo, setNewTxTo] = React.useState<string>("");
    const [newTxValue, setNewTxValue] = React.useState<string>("");
    const [newTxData, setNewTxData] = React.useState<string>("");

    const getShadowGroupDetails = async () => {
        // TODO.
    };

    const submitNewTransaction = async () => {
        // TODO.
    };

    return (
        <div className={"flex w-full m-2 justify-center"}>
            <Card className="w-full" isPressable onPress={onOpen}>
                <CardBody>
                    <p>{props.address}</p>
                </CardBody>
            </Card>
            <Modal backdrop="blur" isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
                <ModalContent>
                {(onClose) => (
                    <>
                    <ModalHeader className="flex flex-col gap-1">Shadow Group Details</ModalHeader>
                    <ModalBody>
                        <h1 className="font-bold">Quorum: {qorum}</h1>
                        <h1 className="font-bold">Transactions:</h1>
                        <TransactionTable
                            shadowGroupAddress={props.address}
                            qorum={qorum}
                            transactions={transactions}
                        />
                        <h1 className="font-bold">Submit new transaction:</h1>
                        <Textarea
                            value={newTxTo}
                            onValueChange={setNewTxTo}
                            maxRows={1}
                            placeholder="To"
                        />
                        <Textarea
                            value={newTxValue}
                            onValueChange={setNewTxValue}
                            maxRows={1}
                            placeholder="Value"
                        />
                        <Textarea
                            value={newTxData}
                            onValueChange={setNewTxData}
                            placeholder="Data"
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            isDisabled={newTxTo === "" || newTxValue === "" || newTxData === ""}
                            color="primary"
                            variant="bordered"
                            onPress={() => {}}
                        >
                            Submit new TX
                        </Button>
                        <Button
                            color="danger"
                            onPress={onClose}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                    </>
                )}
                </ModalContent>
            </Modal>
        </div>
    );
};