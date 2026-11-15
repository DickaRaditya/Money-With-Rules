"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { parseEventLogs, type Address, type Log } from "viem";
import {
  addresses,
  publicClient,
  configured,
  deploymentBlock,
  seedMerchants,
  chainId,
} from "@/lib/config";
import { MoneyWithRulesVaultAbi as vaultAbi } from "@/generated/MoneyWithRulesVault";
import { MerchantRegistryAbi as registryAbi } from "@/generated/MerchantRegistry";
import { MockTokenAbi as tokenAbi } from "@/generated/MockToken";

export type Rules = {
  category: number;
  startsAt: bigint;
  endsAt: bigint;
  maxPerPayment: bigint;
  dailyLimit: bigint;
};
export type Budget = {
  id: bigint;
  parent: Address;
  beneficiary: Address;
  name: string;
  rules: Rules;
  balance: bigint;
  totalFunded: bigint;
  totalSpent: bigint;
  totalWithdrawn: bigint;
  movedIn: bigint;
  movedOut: bigint;
  paused: boolean;
  whitelistEnabled: boolean;
};
export type Merchant = {
  address: Address;
  name: string;
  location: string;
  mask: number;
  suspended: boolean;
  verified: boolean;
};
export type Activity = {
  key: string;
  event: string;
  hash: string;
  block: bigint;
  args: Record<string, unknown>;
};

// Chunking avoids provider range limits. For a large deployment replace this with a reorg-aware indexer.
async function logs(address: Address, latest: bigint) {
  const result: Log[] = [];
  for (let start = deploymentBlock; start <= latest; start += 2000n) {
    result.push(
      ...(await publicClient.getLogs({
        address,
        fromBlock: start,
        toBlock: start + 1999n < latest ? start + 1999n : latest,
      })),
    );
  }
  return result;
}
export function useChainData() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["chain-data", chainId, addresses.vault, address],
    enabled: configured,
    refetchInterval: 20_000,
    queryFn: async () => {
      if ((await publicClient.getChainId()) !== chainId)
        throw new Error("RPC terhubung ke jaringan yang berbeda.");
      const block = await publicClient.getBlock();
      const at = { blockNumber: block.number };
      const [registryLogs, vaultLogs, admin, tokenOwner, enabledCategories] = await Promise.all([
        logs(addresses.registry, block.number),
        logs(addresses.vault, block.number),
        publicClient.readContract({
          address: addresses.registry,
          abi: registryAbi,
          functionName: "owner",
          ...at,
        }),
        publicClient.readContract({
          address: addresses.token,
          abi: tokenAbi,
          functionName: "owner",
          ...at,
        }),
        Promise.all(
          [0, 1, 2, 3].map((category) =>
            publicClient.readContract({
              address: addresses.registry,
              abi: registryAbi,
              functionName: "categoryEnabled",
              args: [category],
              ...at,
            }),
          ),
        ),
      ]);
      const merchantAddresses = [
        ...new Set(
          parseEventLogs({
            abi: registryAbi,
            logs: registryLogs,
            eventName: "MerchantUpdated",
          }).map((log) => log.args.merchant),
        ),
      ];
      const merchants: Merchant[] = await Promise.all(
        merchantAddresses.map(async (merchant) => {
          const [mask, suspended] = await publicClient.readContract({
            address: addresses.registry,
            abi: registryAbi,
            functionName: "merchants",
            args: [merchant],
            ...at,
          });
          const seed = seedMerchants.find(
            (s) => s.address.toLowerCase() === merchant.toLowerCase(),
          );
          return {
            address: merchant,
            name: seed?.name || "Merchant terdaftar",
            location: seed?.location || "Nama dapat dilengkapi melalui profil",
            mask,
            suspended,
            verified: mask > 0 && !suspended,
          };
        }),
      );
      const ids = new Set<bigint>();
      if (address)
        for (const asParent of [true, false]) {
          const count = await publicClient.readContract({
            address: addresses.vault,
            abi: vaultAbi,
            functionName: "budgetCount",
            args: [address, asParent],
            ...at,
          });
          for (let offset = 0n; offset < count; offset += 100n) {
            (
              await publicClient.readContract({
                address: addresses.vault,
                abi: vaultAbi,
                functionName: "budgetIds",
                args: [address, asParent, offset, 100n],
                ...at,
              })
            ).forEach((id) => ids.add(id));
          }
        }
      const budgets: Budget[] = await Promise.all(
        [...ids].map(async (id) => ({
          id,
          ...(await publicClient.readContract({
            address: addresses.vault,
            abi: vaultAbi,
            functionName: "getBudget",
            args: [id],
            ...at,
          })),
        })),
      );
      const activities: Activity[] = parseEventLogs({ abi: vaultAbi, logs: vaultLogs })
        .filter((log) => {
          if (!address) return false;
          if (address.toLowerCase() === admin.toLowerCase()) return true;
          const args = log.args as Record<string, unknown>;
          return (
            ids.has(args.budgetId as bigint) ||
            ids.has(args.fromBudgetId as bigint) ||
            ids.has(args.toBudgetId as bigint) ||
            String(args.merchant).toLowerCase() === address.toLowerCase()
          );
        })
        .map((log) => ({
          key: `${log.transactionHash}-${log.logIndex}`,
          event: log.eventName,
          hash: log.transactionHash!,
          block: log.blockNumber!,
          args: log.args as Record<string, unknown>,
        }))
        .reverse();
      const walletBalance = address
        ? await publicClient.readContract({
            address: addresses.token,
            abi: tokenAbi,
            functionName: "balanceOf",
            args: [address],
            ...at,
          })
        : 0n;
      return {
        budgets,
        merchants,
        activities,
        admin,
        tokenOwner,
        walletBalance,
        enabledCategories,
        block: block.number,
        timestamp: block.timestamp,
      };
    },
  });
}
