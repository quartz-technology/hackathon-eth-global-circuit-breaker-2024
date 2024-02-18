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
    Snippet,
    Slider,
    SliderValue,
} from "@nextui-org/react";
import * as React from 'react';
import { createWalletClient, custom, Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import shadowGroup from '@/components/shadow-group.json';

export interface IGroupCreationProps {
    identiyCommitment: string;
};

export default function GroupCreation(props: IGroupCreationProps) {
    const {isOpen, onOpen, onOpenChange} = useDisclosure();
    const [groupMembersRaw, setGroupMembersRaw] = React.useState<string[]>([]);

    const [groupMembers, setGroupMembers] = React.useState<string[]>([]);
    const [quorum, setQuorum] = React.useState<SliderValue>(1);
    const [groupID, setGroupID] = React.useState<string>("");

    const onCloseWrapper = (onClose: Function) => {
        setGroupMembersRaw([]);
        setGroupMembers([]);
        setQuorum(1);
        setGroupID("");

        onClose();
    };

    const createNewShadowGroup = async () => {
        const walletClient = createWalletClient({
            chain: sepolia,
            transport: custom(window.ethereum)
        });
        const account = privateKeyToAccount("0x4c88eccb34856d59199d14fee223d27b4cabffe1de5b2f5075765c92eab784b5");

        const hash = await walletClient.deployContract({
            abi: shadowGroup.abi,
            account,
            args: ["0x3889927F0B5Eb1a02C6E2C20b39a1Bd4EAd76131", groupID, groupMembers, quorum],
            bytecode: shadowGroup.bytecode as Hex,
        });

        console.log(hash);
    };

    return (
        <div className={"flex w-full m-2 justify-center"}>
            <Card className="w-full" isPressable onPress={onOpen}>
                <CardBody>
                    <p className="text-center font-bold italic">Create new Shadow Group</p>
                </CardBody>
            </Card>
            <Modal backdrop="blur" isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside">
                <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">New Shadow Group</ModalHeader>
                        <ModalBody>
                            <Snippet
                                variant="bordered"
                                codeString={props.identiyCommitment}
                                symbol="👤"
                            >
                                Copy your identity commitment
                            </Snippet>
                            <Textarea
                                value={groupMembersRaw.join("\n")}
                                onValueChange={(value) => {
                                    const members = value.split("\n");
                                    
                                    setGroupMembersRaw(members);
                                    setGroupMembers(members.filter((member) => member !== ""));
                                }}
                                label="Group Members"
                                placeholder="Add each identity commitment in a new line."
                            />
                            <Slider   
                                size="md"
                                step={1}
                                color="foreground"
                                label="Quorum"
                                showSteps={true}
                                maxValue={groupMembers.length === 0 ? 1 : groupMembers.length} 
                                minValue={1}
                                value={quorum}
                                onChange={setQuorum}
                                getValue={(quorum) => {
                                    return `${quorum} / ${groupMembers.length === 0 ? 1 : groupMembers.length}`;
                                }}
                                defaultValue={1}
                            />
                            <Textarea
                                value={groupID}
                                onValueChange={setGroupID}
                                label="Group ID"
                                placeholder="Enter a unique group ID."
                                maxRows={1}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button color="danger" variant="light" onPress={() => onCloseWrapper(onClose)}>
                                Cancel
                            </Button>
                            <Button
                                color="primary"
                                onPress={async () => {
                                    console.log(groupMembers, quorum);
                                    await createNewShadowGroup();

                                    onCloseWrapper(onClose);
                                }}
                            >
                                Create
                            </Button>
                        </ModalFooter>
                    </>
                )}
                </ModalContent>
            </Modal>
        </div>
    );
};