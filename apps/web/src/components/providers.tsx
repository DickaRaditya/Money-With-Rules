"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  lightTheme,
  darkTheme,
  connectorsForWallets,
} from "@rainbow-me/rainbowkit";
import { injectedWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { WagmiProvider, createConfig, http } from "wagmi";
import { ThemeProvider, useTheme } from "next-themes";
import { chain, rpcUrl } from "@/lib/config";
import { useHydrated } from "@/hooks/use-hydrated";
import "@rainbow-me/rainbowkit/styles.css";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const config = createConfig({
  chains: [chain],
  ssr: true,
  connectors: connectorsForWallets(
    [
      {
        groupName: "Dompet",
        wallets: projectId ? [injectedWallet, walletConnectWallet] : [injectedWallet],
      },
    ],
    { appName: "Money With Rules", projectId: projectId || "local-injected-only" },
  ),
  transports: { 31337: http(rpcUrl), 84532: http(rpcUrl) },
});
function WalletTheme({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const { resolvedTheme } = useTheme();
  const palette = {
    accentColor: "#1c594b",
    accentColorForeground: "#fff",
    borderRadius: "medium" as const,
    fontStack: "system" as const,
  };
  return (
    <RainbowKitProvider
      locale="id-ID"
      theme={hydrated && resolvedTheme === "dark" ? darkTheme(palette) : lightTheme(palette)}
    >
      {children}
    </RainbowKitProvider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <WalletTheme>{children}</WalletTheme>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
