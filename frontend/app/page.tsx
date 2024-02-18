"use client";

import * as React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Providers } from './provider';
import { useAccount } from 'wagmi';
import { CircularProgress, Textarea, Button } from "@nextui-org/react";
import GroupPreview from '@/components/group-preview';
import { SemaphoreSubgraph, SupportedNetwork, GroupResponse } from "@semaphore-protocol/data";
import { Identity } from "@semaphore-protocol/identity";
import GroupCreation from '@/components/group-creation';

export default function Home() {
  return (
    <Providers>
      <main className="flex flex-col min-h-screen p-12 h-full w-full">
        <Root />
      </main>
    </Providers>
  );
}

function Root() {
  const [isMounted, setIsMounted] = React.useState(false);
  const account = useAccount();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const renderContent = () => {
    if (!isMounted) {
      return <LoadingContent />;
    }

    if (account.status === 'connected') {
      return <Groups />;
    }

    if (!account.address || account.status === 'reconnecting') {
      return <Welcome />;
    }
  };

  return (
    <div className="flex flex-1">
      {renderContent()}
    </div>
  );
}

function LoadingContent() {
  return (
    <div className="flex flex-1 justify-center items-center text-center">
      <CircularProgress label="Loading 0xShadows" />
    </div>
  );

}

function Welcome() {
  return (
    <div className="flex flex-col flex-1 justify-center items-center text-center">
      <h1 className="text-4xl font-bold m-4 text-center">Welcome to 0xShadows</h1>
      <h2 className="text-2xl font-bold mb-4 text-center">An anonymous multi-signature wallet powered by PSE&apos;s semaphore.</h2>
      <ConnectButton />
    </div>
  );
}

function Groups() {
  const [isMounted, setIsMounted] = React.useState(false);
  const [identityTrapdoor, setIdentityTrapdoor] = React.useState("");
  const [identityNullifier, setIdentityNullifier] = React.useState("");
  const [identity, setIdentity] = React.useState<Identity>(null);
  const [groups, setGroups] = React.useState<GroupResponse[]>([]);

  const syncSemaphoreGroups = async (trapdoor: string, nullifier: string) => {
    const semaphoreSubgraph = new SemaphoreSubgraph(SupportedNetwork.ARBITRUM_GOERLI);
    const fetchedGroups = await semaphoreSubgraph.getGroups();

    try {
      const identity = new Identity(JSON.stringify([trapdoor, nullifier]));
      setIdentity(identity);

      setGroups(fetchedGroups.filter((group) => group.members?.includes(identity.commitment.toString())));
    } catch (e) {
      console.error(e)
    }
  };

  const syncSemaphoreGroupsCallback = React.useCallback(() => {
    return syncSemaphoreGroups(identityTrapdoor, identityNullifier);
  }, [identityTrapdoor, identityNullifier]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (isMounted && identityTrapdoor !== "" && identityNullifier !== "") {
      (async () => {
        await syncSemaphoreGroupsCallback();
      })();
    }
  }, [isMounted, syncSemaphoreGroupsCallback, identityTrapdoor, identityNullifier]);

  return (
    <div className='flex flex-1 flex-col w-full h-full justify-center items-center'>
      <h1 className="text-4xl font-bold m-4 text-center">Shadow Groups</h1>
      <h2 className="text-2xl font-bold mb-4 text-center">Manage your anonymous multi-signature wallets.</h2>
      <div className="flex w-full max-w-2xl p-2 justify-between">
        <Button
          onClick={async () => {
            const identity = new Identity();

            setIdentityTrapdoor(identity.trapdoor.toString());
            setIdentityNullifier(identity.nullifier.toString());
          }}
        >
          New Shadow Identity
        </Button>
        <ConnectButton />
      </div>
      <div className="flex w-full max-w-2xl">
        <Textarea
          className="m-2"
          maxRows={4}
          label="Identity Trapdoor"
          labelPlacement="outside"
          placeholder="Enter your identity trapdoor"
          value={identityTrapdoor}
          onValueChange={setIdentityTrapdoor}
        />
        <Textarea
          className="m-2"
          maxRows={4}
          label="Identity Nullifier"
          labelPlacement="outside"
          placeholder="Enter your identity nullifier"
          value={identityNullifier}
          onValueChange={setIdentityNullifier}
        />
      </div>
      <div className="flex flex-col w-full max-w-2xl">
        <h1 className='m-2 font-bold'>Your shadow groups:</h1>
        <GroupCreation identiyCommitment={identity?.commitment.toString()} />
        {groups.map((group, i) => (
          <GroupPreview
            key={i}
            address={group.admin || ""}
          />
        ))}
        <GroupPreview address="0x0000000000000000000000000000000000000000" />
      </div>
    </div>
  );
}
