'use client';

import * as React from 'react';
import {NextUIProvider} from "@nextui-org/system";
import {
  RainbowKitProvider,
  getDefaultWallets,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';

const { wallets } = getDefaultWallets();

const config = getDefaultConfig({
  appName: '0xShadows',
  projectId: '6e0d26c03794bdefd280c55893308a51',
  wallets: [
    ...wallets
  ],
  chains: [sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextUIProvider>
        <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
        </QueryClientProvider>
        </WagmiProvider>
    </NextUIProvider>
  );
}
