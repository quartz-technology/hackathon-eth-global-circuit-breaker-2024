import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { generateProof } from "@semaphore-protocol/proof"
import { expect } from "chai"
import { formatBytes32String, parseEther, randomBytes } from "ethers/lib/utils"
import { ethers, run } from "hardhat"
// @ts-ignore: typechain folder will be generated after contracts compilation
import { ISemaphore, ShadowGroup } from "../build/typechain"
import { config } from "../package.json"
import { BigNumberish } from "ethers"

describe("ShadowGroup", () => {
    let semaphoreContract: ISemaphore;

    beforeEach(async () => {
        const semaphore = await run("deploy:semaphore", { logs: false });

        semaphoreContract = semaphore;
    });

    const deployShadowGroup = async (groupID: BigNumberish, ownerIdentityCommitments: Identity[], quorum: number) => {
       const shadowGroupContract: ShadowGroup = await run("deploy", {
            logs: false,
            semaphore: semaphoreContract.address,
            group: groupID,
            ownerIdentityCommitments: ownerIdentityCommitments.map((ownerIdentityCommitment) => ownerIdentityCommitment.commitment),
            quorum: quorum,
        });

        return shadowGroupContract;
    }

    it("Should create a new ShadowGroup", async () => {
        const groupID = 42;

        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];

        await deployShadowGroup(groupID, ownerIdentityCommitments, ownerIdentityCommitments.length - 1);
    });

    it("Should fail to create ShadowGroup using empty owner list", async () => {
        const groupID = 42;

        const ownerIdentityCommitments: Identity[] = [];

        await expect(deployShadowGroup(groupID, ownerIdentityCommitments, ownerIdentityCommitments.length))
            .to.be.revertedWith("at least one owner identity commitment is required to create the ShadowGroup");
    });

    it("Should fail to create ShadowGroup using too small quorum", async () => {
        const groupID = 42;

        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];

        const quorum = 0;

        await expect(deployShadowGroup(groupID, ownerIdentityCommitments, quorum))
            .to.be.reverted;
    });

    it("Should fail to create ShadowGroup using too large quorum", async () => {
        const groupID = 42;

        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];

        const quorum = ownerIdentityCommitments.length + 1;

        await expect(deployShadowGroup(groupID, ownerIdentityCommitments, quorum))
            .to.be.reverted;
    });

    describe("# submitTransaction", () => {
        const wasmFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.wasm`;
        const zkeyFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.zkey`;

        const groupID = 42;
        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];
        const quorum = ownerIdentityCommitments.length - 1;
        
        let group: Group;
        let shadowGroupContract: ShadowGroup;

        before(async () => {    
            group = new Group(groupID, 20, ownerIdentityCommitments.map((ownerIdentityCommitment) => ownerIdentityCommitment.commitment));
            shadowGroupContract = await deployShadowGroup(groupID, ownerIdentityCommitments, quorum);
        });

        it("Should succeed to submit transaction for the first time", async () => {    
            const _to = ethers.constants.AddressZero;
            const _value = 0;
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));
   
            const externalNullifier = ethers.utils.keccak256(randomBytes(32));

            const fullProof = await generateProof(ownerIdentityCommitments[0], group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            await shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            );
    
            const transaction = await shadowGroupContract.transactions(0);
            expect(transaction.to).to.eq(_to);
            expect(transaction.value).to.eq(_value);
            expect(transaction.data).to.eq(_data);
            expect(transaction.executed).to.eq(false);
            expect(transaction.numConfirmations).to.eq(0);
        });

        it("Should succeed to submit transaction for the second time", async () => {    
            const _to = ethers.constants.AddressZero;
            const _value = 1;
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));

            const externalNullifier = ethers.utils.keccak256(randomBytes(32));
    
            const fullProof = await generateProof(ownerIdentityCommitments[0], group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            await shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            );
    
            const transaction = await shadowGroupContract.transactions(1);
            expect(transaction.to).to.eq(_to);
            expect(transaction.value).to.eq(_value);
            expect(transaction.data).to.eq(_data);
            expect(transaction.executed).to.eq(false);
            expect(transaction.numConfirmations).to.eq(0);
        });

        it("Should fail to submit transaction for invalid identity", async () => {    
            const _to = ethers.constants.AddressZero;
            const _value = 0;
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));

            const externalNullifier = ethers.utils.keccak256(randomBytes(32));

            const invalidIdentity = new Identity();
            group.addMember(invalidIdentity.commitment);
    
            const fullProof = await generateProof(invalidIdentity, group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            expect(shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            )).to.be.revertedWith("Semaphore__MerkleTreeRootIsNotPartOfTheGroup()");
        });
    });

    describe("# confirmTransaction", () => {
        const wasmFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.wasm`;
        const zkeyFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.zkey`;

        const groupID = 42;
        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];
        const quorum = ownerIdentityCommitments.length - 1;
        
        let group: Group;
        let shadowGroupContract: ShadowGroup;

        before(async () => {    
            group = new Group(groupID, 20, ownerIdentityCommitments.map((ownerIdentityCommitment) => ownerIdentityCommitment.commitment));
            shadowGroupContract = await deployShadowGroup(groupID, ownerIdentityCommitments, quorum);

            const _to = ethers.constants.AddressZero;
            const _value = 0;
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));
   
            const externalNullifier = ethers.utils.keccak256(randomBytes(32));

            const fullProof = await generateProof(ownerIdentityCommitments[0], group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            await shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            );
        });

        it("Should succeed to confirm transaction with valid identities", async () => {
            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const _to = ethers.constants.AddressZero;
                const _value = 0;
                const _data = "0x";
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                await shadowGroupContract.confirmTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof);

                const transaction = await shadowGroupContract.transactions(0);
                expect(transaction.to).to.eq(_to);
                expect(transaction.value).to.eq(_value);
                expect(transaction.data).to.eq(_data);
                expect(transaction.executed).to.eq(false);
                expect(transaction.numConfirmations).to.eq(i + 1);
            }
        });

        it("Should fail to confirm transaction already confirmed with valid identities", async () => {
            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                expect(shadowGroupContract.confirmTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof))
                    .to.be.revertedWith("Semaphore__YouAreUsingTheSameNillifierTwice()");
            }
        });

        it("Should fail to confirm transaction with invalid identities", async () => {
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
            const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

            const invalidGroup = group;
            const invalidIdentity = new Identity();
            invalidGroup.addMember(invalidIdentity.commitment);
            
            const fullProof = await generateProof(invalidIdentity, invalidGroup, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });

            expect(shadowGroupContract.confirmTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof))
                .to.be.revertedWith("Semaphore__MerkleTreeRootIsNotPartOfTheGroup()");
        });
    });

    describe("# revokeTransaction", () => {
        const wasmFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.wasm`;
        const zkeyFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.zkey`;

        const groupID = 42;
        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];
        const quorum = ownerIdentityCommitments.length - 1;
        
        let group: Group;
        let shadowGroupContract: ShadowGroup;

        before(async () => {    
            group = new Group(groupID, 20, ownerIdentityCommitments.map((ownerIdentityCommitment) => ownerIdentityCommitment.commitment));
            shadowGroupContract = await deployShadowGroup(groupID, ownerIdentityCommitments, quorum);

            const _to = ethers.constants.AddressZero;
            const _value = 0;
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));
   
            const externalNullifier = ethers.utils.keccak256(randomBytes(32));

            const fullProof = await generateProof(ownerIdentityCommitments[0], group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            await shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            );

            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                await shadowGroupContract.confirmTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof);
            }
        });

        it("Should succeed to revoke transaction with valid identities", async () => {
            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [false]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                await shadowGroupContract.revokeTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof);

                const transaction = await shadowGroupContract.transactions(0);
                expect(transaction.numRevocations).to.eq(i + 1);
            }
        });

        it("Should fail to revoke transaction already revoked with valid identities", async () => {
            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [false]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                expect(shadowGroupContract.revokeTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof))
                    .to.be.revertedWith("Semaphore__YouAreUsingTheSameNillifierTwice()");
            }
        });

        it("Should fail to revoke transaction with invalid identities", async () => {
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [false]));
            const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

            const invalidGroup = group;
            const invalidIdentity = new Identity();
            invalidGroup.addMember(invalidIdentity.commitment);
            
            const fullProof = await generateProof(invalidIdentity, invalidGroup, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });

            expect(shadowGroupContract.revokeTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof))
                .to.be.revertedWith("Semaphore__MerkleTreeRootIsNotPartOfTheGroup()");
        });
    });

    describe("# executeTransaction", () => {
        const wasmFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.wasm`;
        const zkeyFilePath = `${config.paths.build["snark-artifacts"]}/semaphore.zkey`;

        const groupID = 42;
        const ownerIdentityCommitments: Identity[] = [
            new Identity(),
            new Identity(),
            new Identity(),
        ];
        const quorum = ownerIdentityCommitments.length - 1;
        
        let group: Group;
        let shadowGroupContract: ShadowGroup;

        before(async () => {    
            group = new Group(groupID, 20, ownerIdentityCommitments.map((ownerIdentityCommitment) => ownerIdentityCommitment.commitment));
            shadowGroupContract = await deployShadowGroup(groupID, ownerIdentityCommitments, quorum);

            const accounts = (await ethers.getSigners());

            await accounts[0].sendTransaction({
                to: shadowGroupContract.address,
                value: parseEther("1"),
            });

            const _to = ethers.constants.AddressZero;
            const _value = parseEther("0.5");
            const _data = "0x";
            const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["address", "uint256", "bytes"], [_to, _value, _data]));

            const externalNullifier = ethers.utils.keccak256(randomBytes(32));

            const fullProof = await generateProof(ownerIdentityCommitments[0], group, externalNullifier, signal, {
                wasmFilePath,
                zkeyFilePath
            });
    
            await shadowGroupContract.submitTransaction(
                _to,
                _value,
                _data,
                fullProof.merkleTreeRoot,
                fullProof.nullifierHash,
                externalNullifier,
                fullProof.proof
            );

            for (let i = 0; i < ownerIdentityCommitments.length; i++) {
                const signal = ethers.utils.keccak256(ethers.utils.solidityPack(["bool"], [true]));
                const externalNullifier = ethers.utils.keccak256(ethers.utils.solidityPack(["uint", "uint256"], [0, signal]));

                const fullProof = await generateProof(ownerIdentityCommitments[i], group, externalNullifier, signal, {
                    wasmFilePath,
                    zkeyFilePath
                });

                await shadowGroupContract.confirmTransaction(0, fullProof.merkleTreeRoot, fullProof.nullifierHash, externalNullifier, fullProof.proof);
            }
        });

        it("Should succeed to execute transaction with valid identities", async () => {
            const transaction = await shadowGroupContract.transactions(0);
            expect(transaction.executed).to.eq(false);

            await shadowGroupContract.executeTransaction(0);

            const executedTransaction = await shadowGroupContract.transactions(0);
            expect(executedTransaction.executed).to.eq(true);

            const balance = await ethers.provider.getBalance(ethers.constants.AddressZero);
            expect(balance).to.eq(parseEther("0.5"));
        });
    });
});