import { createPublicClient, http, isAddress, zeroAddress, type Address } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import deployment from "@/generated/deployment.json";

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || deployment.chainId);
export const chain = chainId === 84532 ? baseSepolia : hardhat;
export const supportedChain = chainId === 31337 || chainId === 84532;
export const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (chainId === 84532 ? "https://sepolia.base.org" : "http://127.0.0.1:8545");
const envAddresses = [
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS,
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  process.env.NEXT_PUBLIC_VAULT_ADDRESS,
];
const useEnv = envAddresses.some(Boolean);
const raw = useEnv
  ? envAddresses
  : deployment.chainId === chainId
    ? [deployment.token, deployment.registry, deployment.vault]
    : [];
export const configured =
  supportedChain && raw.length === 3 && raw.every((a) => !!a && isAddress(a) && a !== zeroAddress);
export const addresses = {
  token: (raw[0] || zeroAddress) as Address,
  registry: (raw[1] || zeroAddress) as Address,
  vault: (raw[2] || zeroAddress) as Address,
};
export const deploymentBlock = BigInt(
  process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ||
    (deployment.chainId === chainId && !useEnv ? deployment.blockNumber : 0),
);
export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
  batch: { multicall: false },
});
export const seedMerchants =
  !useEnv && deployment.chainId === chainId
    ? (deployment.merchants as {
        address: string;
        name: string;
        category: number;
        location: string;
      }[])
    : [];
export const demoWallets = chainId === 31337 ? (deployment.wallets as Record<string, string>) : {};
export const explorer = (hash: string) =>
  chainId === 84532 ? `https://sepolia.basescan.org/tx/${hash}` : undefined;
