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
import { getContract, Address, createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import shadowGroup from '@/components/shadow-group.json';
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof";
import { generateSubmitTransactionExternalNullifier, generateSubmitTransactionSignal } from "@/utils/shadow";

export interface IGroupPreviewProps {
    address: string;
    identity: Identity;
    identitiesCommitments: string[];
    groupID: string;
};

export default function GroupPreview({ address, identity, identitiesCommitments, groupID }: IGroupPreviewProps) {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [qorum, setQuorum] = React.useState<number>(3);
    const [transactions, setTransactions] = React.useState<ITransaction[]>([]);

    const [newTxTo, setNewTxTo] = React.useState<string>("");
    const [newTxValue, setNewTxValue] = React.useState<string>("");
    const [newTxData, setNewTxData] = React.useState<string>("");

    const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(window.ethereum),
        account: privateKeyToAccount("0x4c88eccb34856d59199d14fee223d27b4cabffe1de5b2f5075765c92eab784b5"),
    });
    const contract = getContract({
        address: address as Address,
        abi: shadowGroup.abi,
        client: walletClient,
    });

    const submitNewTransactionCallback = React.useCallback(async () => {
        const group = new Group(groupID, 20, identitiesCommitments);

        const generatedSignal = generateSubmitTransactionSignal(newTxTo, newTxValue, newTxData);
        const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(transactions.length, generatedSignal);

        const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
            identity,
            group,
            generatedExternalNullifier,
            generatedSignal,
        );

        await contract.write.submitTransaction([newTxTo, newTxValue, newTxData, merkleTreeRoot, nullifierHash, proof]);
    }, [newTxTo, newTxValue, newTxData, groupID, identity, identitiesCommitments, contract, transactions]);

    React.useEffect(() => {
        (async () => {
            const qorum = await contract.read.quorum();
            setQuorum(Number(qorum));

            const fetchedTxs = await contract.read.getTransactions();
            console.log(fetchedTxs);
            const txs: ITransaction[] = (fetchedTxs as any).map((tx: any, i: number) => {
                return {
                    id: i,
                    to: tx.to,
                    value: tx.value,
                    data: tx.data,
                    executed: tx.executed,
                    numConfirmations: tx.numConfirmations,
                    numRevocations: tx.numRevocations,
                } as ITransaction;
            });
            setTransactions(txs);
        })();
    }, []);

    return (
        <div className={"flex w-full m-2 justify-center"}>
            <Card className="w-full" isPressable onPress={onOpen}>
                <CardBody>
                    <p>{address}</p>
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
                            shadowGroupAddress={address}
                            qorum={qorum}
                            transactions={transactions}
                            identity={identity}
                            identitiesCommitments={identitiesCommitments}
                            groupID={groupID}
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
                            onPress={async () => await submitNewTransactionCallback()}
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