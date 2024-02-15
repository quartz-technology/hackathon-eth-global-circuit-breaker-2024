import { task, types } from "hardhat/config"

task("deploy", "Deploy a ShadowGroup contract")
    .addOptionalParam("semaphore", "Semaphore contract address", undefined, types.string)
    .addOptionalParam("group", "Group id", 42, types.int)
    .addOptionalParam("logs", "Print the logs", true, types.boolean)
    .setAction(
        async (
            {
                logs,
                semaphore: semaphoreAddress,
                group: groupID,
                ownerIdentityCommitments,
                quorum
            },
            { ethers, run }
        ) => {
            if (!semaphoreAddress) {
                const { semaphore } = await run("deploy:semaphore", { logs });

                semaphoreAddress = semaphore.address;
            }

            const ShadowGroupFactory = await ethers.getContractFactory("ShadowGroup");
            const shadowGroupContract = await ShadowGroupFactory.deploy(semaphoreAddress, groupID, ownerIdentityCommitments, quorum);

            await shadowGroupContract.deployed();

            if (logs) {
                console.info(`ShadowGroup contract has been deployed to: ${shadowGroupContract.address}`)
            }

            return shadowGroupContract;
        }
    );
