import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { expect } from "chai"
import { ethers, run } from "hardhat"
// @ts-ignore: typechain folder will be generated after contracts compilation
import { ISemaphore, ShadowGroup } from "../build/typechain"
import { config } from "../package.json"
import { BigNumberish } from "ethers"
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ShadowGroup", () => {
    /**************************************************************************
    *                           HELPER VARIABLES                              *
    **************************************************************************/
    const wasmFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.wasm`;
    const zkeyFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.zkey`;

    const groupID = 42;
    const identities = [new Identity(), new Identity(), new Identity()];
    const identitiesCommitments = identities.map((identity) => identity.commitment);
    const quorum = identitiesCommitments.length - 1;

    const invalidIdentity = new Identity("invalid-identity");
    const invalidIdentityCommitment = invalidIdentity.commitment;

    const tx = {
        to: ethers.constants.AddressZero,
        value: 0,
        data: "0x",
    };

    /**************************************************************************
    *                           HELPER FUNCTIONS                              *
    **************************************************************************/
    async function deployShadowGroup(
        groupID: BigNumberish,
        identitiesCommitments: BigNumberish[],
        quorum: BigNumberish,
        deploymentCustomError?: string,
    ) {
        const semaphore = await loadFixture(deploySemaphoreFixture) as ISemaphore;

        const shadowGroupContractFactory = await ethers.getContractFactory("ShadowGroup");

        if (deploymentCustomError) {
            await expect(shadowGroupContractFactory.deploy(semaphore.address, groupID, identitiesCommitments, quorum))
                .to.be.revertedWithCustomError(shadowGroupContractFactory, deploymentCustomError);

            return null;
        } else {
            const shadowGroup = await shadowGroupContractFactory.deploy(semaphore.address, groupID, identitiesCommitments, quorum);
            await shadowGroup.deployed();

            return { shadowGroup, semaphore };
        }
    }

    function generateSubmitTransactionSignal(to: string = tx.to, value: BigNumberish = tx.value, data: string = tx.data) {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [to, value, data]));
    }

    function generateSubmitTransactionExternalNullifier(numTxs: number, signal: BigNumberish) {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [numTxs, signal]));
    }

    function generateConfirmTransactionSignal() {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
    }

    function generateConfirmTransactionExternalNullifier(txIndex: number, signal: BigNumberish) {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [txIndex, signal]));
    }

    function generateRevokeTransactionSignal() {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [false]));
    }

    function generateRevokeTransactionExternalNullifier(txIndex: number, signal: BigNumberish) {
        return ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [txIndex, signal]));
    }

    /**************************************************************************
    *                               FIXTURES                                  *
    **************************************************************************/
    async function deploySemaphoreFixture() {
        const { semaphore } = await run("deploy:semaphore", { logs: false });

        return semaphore;
    }

    async function deployShadowGroupFixture() {
        const { shadowGroup, semaphore } = await deployShadowGroup(groupID, identitiesCommitments, quorum) as { shadowGroup: ShadowGroup, semaphore: ISemaphore };

        return { semaphore, shadowGroup };
    }

    async function deployShadowGroupWithOneSubmittedTransactionFixture() {
        const { semaphore, shadowGroup } = await deployShadowGroupFixture() as { semaphore: ISemaphore, shadowGroup: ShadowGroup };

        const identity = identities[0];
        const group = new Group(groupID, 20, [identity.commitment]);

        const generatedSignal = generateSubmitTransactionSignal();
        const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(0, generatedSignal);

        const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
            identity,
            group,
            generatedExternalNullifier,
            generatedSignal,
            {
                wasmFilePath,
                zkeyFilePath
            },
        );

        await expect(shadowGroup.submitTransaction(tx.to, tx.value, tx.data, merkleTreeRoot, nullifierHash, proof))
                    .not.to.be.reverted;

        return { semaphore, shadowGroup };
    };

    async function deployShadowGroupWithOneSubmittedInvalidTransactionFixture() {
        const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupFixture);

        const identity = identities[0];
        const group = new Group(groupID, 20, [identity.commitment]);

        const invalidTx = {
            to: ethers.constants.AddressZero,
            value: 1,
            data: "0xdeadbeef",
        }

        const generatedSignal = generateSubmitTransactionSignal(invalidTx.to, invalidTx.value, invalidTx.data);
        const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(0, generatedSignal);

        const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
            identity,
            group,
            generatedExternalNullifier,
            generatedSignal,
            {
                wasmFilePath,
                zkeyFilePath
            },
        );

        await expect(shadowGroup.submitTransaction(invalidTx.to, invalidTx.value, invalidTx.data, merkleTreeRoot, nullifierHash, proof))
                    .not.to.be.reverted;

        return { semaphore, shadowGroup };
    };

    async function deployShadowGroupWithOneConfirmedTransactionFixture() {
        const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupWithOneSubmittedTransactionFixture);

        for (let i = 0; i < identities.length; i++) {
            const identity = identities[i];
            const group = new Group(groupID, 20, identities.map((identity) => identity.commitment));

            const generatedSignal = generateConfirmTransactionSignal();
            const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(0, generatedSignal);

            const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                identity,
                group,
                generatedExternalNullifier,
                generatedSignal,
                {
                    wasmFilePath,
                    zkeyFilePath
                },
            );

            await expect(shadowGroup.confirmTransaction(0, merkleTreeRoot, nullifierHash, proof))
                .not.to.be.reverted;
        }

        return { semaphore, shadowGroup };
    };

    async function deployShadowGroupWithOneConfirmedInvalidTransactionFixture() {
        const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupWithOneSubmittedInvalidTransactionFixture);

        for (let i = 0; i < identities.length; i++) {
            const identity = identities[i];
            const group = new Group(groupID, 20, identities.map((identity) => identity.commitment));

            const generatedSignal = generateConfirmTransactionSignal();
            const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(0, generatedSignal);

            const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                identity,
                group,
                generatedExternalNullifier,
                generatedSignal,
                {
                    wasmFilePath,
                    zkeyFilePath
                },
            );

            await expect(shadowGroup.confirmTransaction(0, merkleTreeRoot, nullifierHash, proof))
                .not.to.be.reverted;
        }

        return { semaphore, shadowGroup };
    };

    async function deployShadowGroupWithOneRevokedTransactionFixture() {
        const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupWithOneSubmittedTransactionFixture);

        for (let i = 0; i < identities.length; i++) {
            const identity = identities[i];
            const group = new Group(groupID, 20, identities.map((identity) => identity.commitment));

            const generatedSignal = generateRevokeTransactionSignal();
            const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(0, generatedSignal);

            const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                identity,
                group,
                generatedExternalNullifier,
                generatedSignal,
                {
                    wasmFilePath,
                    zkeyFilePath
                },
            );

            await expect(shadowGroup.revokeTransaction(0, merkleTreeRoot, nullifierHash, proof))
                .not.to.be.reverted;
        }

        return { semaphore, shadowGroup };
    };

    async function deployShadowGroupWithOneExecutedTransactionFixture() {
        const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupWithOneConfirmedTransactionFixture);

        await expect(shadowGroup.executeTransaction(0))
            .not.to.be.reverted;

        return { semaphore, shadowGroup };
    };
    
    
    /**************************************************************************
    *                           DEPLOYMENT TESTS                              *
    **************************************************************************/
    describe("# Deployment", () => {
        it("Should fail to create ShadowGroup using empty owner list", async () => {
            await deployShadowGroup(groupID, [], quorum, "InvalidInitialOwners");
        });

        it("Should fail to create ShadowGroup using too small quorum", async () => {
            await deployShadowGroup(groupID, identitiesCommitments, 0, "InvalidQuorum");
        });
        
        it("Should fail to create ShadowGroup using too large quorum", async () => {
            await deployShadowGroup(groupID, identitiesCommitments, identitiesCommitments.length + 1, "InvalidQuorum");
        });

        it("Should succeed to create ShadowGroup", async () => {
            const { semaphore, shadowGroup } = await loadFixture(deployShadowGroupFixture);

            expect(await shadowGroup.semaphore()).to.equal(semaphore.address);
            expect(await shadowGroup.groupID()).to.equal(groupID);
            expect(await shadowGroup.quorum()).to.equal(quorum);
        });
    });

    /**************************************************************************
    *                               UNIT TESTS                                *
    **************************************************************************/
    describe("# Unit Tests", () => {
        let semaphore: ISemaphore;
        let shadowGroup: ShadowGroup;
        
        describe("# submitTransaction", () => {
            before(async () => {
                const contracts = await loadFixture(deployShadowGroupFixture);

                semaphore = contracts.semaphore;
                shadowGroup = contracts.shadowGroup;
            });

            it("Should fail to submit transaction using invalid identity", async () => {
                const group = new Group(groupID, 20, [invalidIdentityCommitment]);
    
                const generatedSignal = generateSubmitTransactionSignal();
                const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(0, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    invalidIdentity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.submitTransaction(tx.to, tx.value, tx.data, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__MerkleTreeRootIsNotPartOfTheGroup");
            });
    
            it("Should succeed to submit first transaction using valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);

                const generatedSignal = generateSubmitTransactionSignal();
                const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(0, generatedSignal);

                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );

                await expect(shadowGroup.submitTransaction(tx.to, tx.value, tx.data, merkleTreeRoot, nullifierHash, proof))
                    .not.to.be.reverted;
    
                const transaction = await shadowGroup.transactions(0);
                expect(transaction.to).to.equal(tx.to);
                expect(transaction.value).to.equal(tx.value);
                expect(transaction.data).to.equal(tx.data);
                expect(transaction.numConfirmations).to.equal(0);
                expect(transaction.numRevocations).to.equal(0);
            });
    
            it("Should fail to submit first transaction again using valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateSubmitTransactionSignal();
                const generatedExternalNullifier = generateSubmitTransactionExternalNullifier(0, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.submitTransaction(tx.to, tx.value, tx.data, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__YouAreUsingTheSameNillifierTwice");
            });
        });

        describe("# confirmTransaction", () => {
            const txIndexToConfirm = 0;
            const invalidTxIndexToConfirm = 1;

            before(async () => {
                const contracts = await loadFixture(deployShadowGroupWithOneSubmittedTransactionFixture);

                semaphore = contracts.semaphore;
                shadowGroup = contracts.shadowGroup;
            });

            it("Should fail to confirm inexisting transaction", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateConfirmTransactionSignal();
                const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(invalidTxIndexToConfirm, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.confirmTransaction(invalidTxIndexToConfirm, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(shadowGroup, "TxDoesNotExist");
            });

            it("Should fail to confirm transaction using invalid identity", async () => {
                const group = new Group(groupID, 20, [invalidIdentityCommitment]);
    
                const generatedSignal = generateConfirmTransactionSignal();
                const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(txIndexToConfirm, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    invalidIdentity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.confirmTransaction(txIndexToConfirm, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__MerkleTreeRootIsNotPartOfTheGroup");
            });
    
            it("Should succeed to confirm transaction using first valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateConfirmTransactionSignal();
                const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(txIndexToConfirm, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.confirmTransaction(txIndexToConfirm, merkleTreeRoot, nullifierHash, proof))
                    .not.to.be.reverted;
    
                const transaction = await shadowGroup.transactions(txIndexToConfirm);
                expect(transaction.numConfirmations).to.equal(1);
                expect(transaction.numRevocations).to.equal(0);
            });

            it("Should fail to confirm transaction again using valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateConfirmTransactionSignal();
                const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(txIndexToConfirm, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.confirmTransaction(txIndexToConfirm, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__YouAreUsingTheSameNillifierTwice");
            });
        });

        describe("# revokeTransaction", () => {
            const txIndexToRevoke = 0;
            const invalidTxIndexToRevoke = 1;

            before(async () => {
                const contracts = await loadFixture(deployShadowGroupWithOneSubmittedTransactionFixture);

                semaphore = contracts.semaphore;
                shadowGroup = contracts.shadowGroup;
            });

            it("Should fail to revoke inexisting transaction", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateRevokeTransactionSignal();
                const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(invalidTxIndexToRevoke, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.revokeTransaction(invalidTxIndexToRevoke, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(shadowGroup, "TxDoesNotExist");
            });

            it("Should fail to revoke transaction using invalid identity", async () => {
                const group = new Group(groupID, 20, [invalidIdentityCommitment]);
    
                const generatedSignal = generateRevokeTransactionSignal();
                const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(txIndexToRevoke, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    invalidIdentity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.confirmTransaction(txIndexToRevoke, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__MerkleTreeRootIsNotPartOfTheGroup");
            });
    
            it("Should succeed to revoke transaction using first valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateRevokeTransactionSignal();
                const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(txIndexToRevoke, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.revokeTransaction(txIndexToRevoke, merkleTreeRoot, nullifierHash, proof))
                    .not.to.be.reverted;
    
                const transaction = await shadowGroup.transactions(txIndexToRevoke);
                expect(transaction.numConfirmations).to.equal(0);
                expect(transaction.numRevocations).to.equal(1);
            });

            it("Should fail to revoke transaction again using valid identity", async () => {
                const identity = identities[0];
                const group = new Group(groupID, 20, [identity.commitment]);
    
                const generatedSignal = generateRevokeTransactionSignal();
                const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(txIndexToRevoke, generatedSignal);
    
                const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                    identity,
                    group,
                    generatedExternalNullifier,
                    generatedSignal,
                    {
                        wasmFilePath,
                        zkeyFilePath
                    },
                );
    
                await expect(shadowGroup.revokeTransaction(txIndexToRevoke, merkleTreeRoot, nullifierHash, proof))
                    .to.be.revertedWithCustomError(semaphore, "Semaphore__YouAreUsingTheSameNillifierTwice");
            });
        });

        describe("# executeTransaction", () => {
            const txIndexToExecute = 0;
            const invalidTxIndexToExecute = 1;

            beforeEach(async () => {
                const contracts = await loadFixture(deployShadowGroupWithOneConfirmedTransactionFixture);

                semaphore = contracts.semaphore;
                shadowGroup = contracts.shadowGroup;
            });

            it("Should fail to execute inexisting transaction", async () => {
                await expect(shadowGroup.executeTransaction(invalidTxIndexToExecute))
                    .to.be.revertedWithCustomError(shadowGroup, "TxDoesNotExist");
            });

            it("Should fail to execute transaction with unreached quorum", async () => {
                const { shadowGroup } = await loadFixture(deployShadowGroupWithOneSubmittedTransactionFixture);
                await expect(shadowGroup.executeTransaction(txIndexToExecute))
                    .to.be.revertedWithCustomError(shadowGroup, "QuorumNotReached");
            });

            it("Should succeed to execute transaction", async () => {
                await expect(shadowGroup.executeTransaction(txIndexToExecute))
                    .not.to.be.reverted;

                const transaction = await shadowGroup.transactions(txIndexToExecute);
                expect(transaction.executed).to.equal(true);
            });

            it("Should fail to execute transaction", async () => {
                const { shadowGroup } = await loadFixture(deployShadowGroupWithOneConfirmedInvalidTransactionFixture);

                await expect(shadowGroup.executeTransaction(0))
                    .to.be.revertedWithCustomError(shadowGroup, "TxExecutionFailed");
            });
        });

        describe("# fallback", () => {
            it("Should succeed to call fallback", async () => {
                const { shadowGroup } = await loadFixture(deployShadowGroupFixture);
                const [ owner ] = await ethers.getSigners();

                await expect(owner.sendTransaction({ to: shadowGroup.address, value: 1 }))
                    .not.to.be.reverted;

                const shadowGroupBalance = await ethers.provider.getBalance(shadowGroup.address);
                expect(shadowGroupBalance).to.equal(1);
            });
        });
    });

    /**************************************************************************
    *                                   E2E                                   *
    **************************************************************************/
    describe("# E2E", () => {
        it("Should fail to confirm already executed transaction", async () => {
            const { shadowGroup } = await loadFixture(deployShadowGroupWithOneExecutedTransactionFixture);

            const identity = identities[0];
            const group = new Group(groupID, 20, identities.map((identity) => identity.commitment));

            const generatedSignal = generateConfirmTransactionSignal();
            const generatedExternalNullifier = generateConfirmTransactionExternalNullifier(0, generatedSignal);

            const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                identity,
                group,
                generatedExternalNullifier,
                generatedSignal,
                {
                    wasmFilePath,
                    zkeyFilePath
                },
            );

            await expect(shadowGroup.confirmTransaction(0, merkleTreeRoot, nullifierHash, proof))
                .to.be.revertedWithCustomError(shadowGroup, "TxAlreadyExecuted");
        });

        it("Should fail to revoke already executed transaction", async () => {
            const { shadowGroup } = await loadFixture(deployShadowGroupWithOneExecutedTransactionFixture);

            const identity = identities[0];
            const group = new Group(groupID, 20, identities.map((identity) => identity.commitment));

            const generatedSignal = generateRevokeTransactionSignal();
            const generatedExternalNullifier = generateRevokeTransactionExternalNullifier(0, generatedSignal);

            const { merkleTreeRoot, nullifierHash, proof } = await generateProof(
                identity,
                group,
                generatedExternalNullifier,
                generatedSignal,
                {
                    wasmFilePath,
                    zkeyFilePath
                },
            );

            await expect(shadowGroup.revokeTransaction(0, merkleTreeRoot, nullifierHash, proof))
                .to.be.revertedWithCustomError(shadowGroup, "TxAlreadyExecuted");
        });

        it("Should fail to execute already executed transaction", async () => {
            const { shadowGroup } = await loadFixture(deployShadowGroupWithOneExecutedTransactionFixture);

            await expect(shadowGroup.executeTransaction(0))
                .to.be.revertedWithCustomError(shadowGroup, "TxAlreadyExecuted");
        });

        it("Should fail to execute revoked transaction", async () => {
            const { shadowGroup } = await loadFixture(deployShadowGroupWithOneRevokedTransactionFixture);

            await expect(shadowGroup.executeTransaction(0))
                .to.be.revertedWithCustomError(shadowGroup, "TxRevoked");
        });

        it("Should get all the transactions", async () => {
            const { shadowGroup } = await loadFixture(deployShadowGroupWithOneConfirmedTransactionFixture);

            const transactions = await shadowGroup.getTransactions();
            expect(transactions.length).to.equal(1);
        });
    });
});
