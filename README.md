# Money With Rules

**Your Money. Your Rules.** A programmable allowance MVP with real ERC-20 escrow and contract-enforced merchant spending policies. Default product copy is Bahasa Indonesia; source and technical documentation are English.

Demo Credits (**DCR**) are test tokens with **no monetary value, fiat backing, cash redemption, or QRIS integration**. This application is not a bank or licensed payment service. Use local Hardhat or Base Sepolia only.

## Repository

```text
apps/web/                  Next.js App Router, TypeScript, Tailwind, shadcn-style primitives
  src/app/(dashboard)/     Parent, child, budgets, payment, merchants, admin, history, settings
  src/app/api/             Signed-wallet auth and protected metadata endpoints
  src/components/          Responsive Indonesian UI, forms, transaction states
  src/hooks/               Real viem reads, wagmi writes, transaction lifecycle
  src/generated/           ABIs exported from compilation and deployment addresses
  tests/                   Auth/QR/amount tests and embedded PostgreSQL migration tests
packages/contracts/
  contracts/               MockToken, MerchantRegistry, MoneyWithRulesVault
  contracts/test/          Adversarial ERC-20 (test-only; never deployed by scripts)
  scripts/                 ABI export, deployment, complete local demo
  test/                    Hardhat policy, permissions, accounting, adversarial tests
supabase/migrations/       Metadata tables, RLS, grants, nonce/session functions
docs/                      Architecture, security boundaries, demo and verification
```

## Prerequisites

- Node.js **22.13+** (validated with Node 24.14.0), npm 11+, and a browser wallet with custom-network support.
- A Supabase PostgreSQL project for profile persistence and merchant applications. **On-chain functions work without Supabase.** Missing credentials produce a clear unavailable state, not mock authentication or a fake database.
- For Base Sepolia deployment only: a dedicated testnet deployer with faucet ETH and an RPC endpoint.

## Exact local setup

Run commands from the repository root. PowerShell commands below also work on Windows paths containing spaces.

```powershell
npm ci
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
npm run compile
```

Keep the default chain ID `31337`. No secret is necessary for local blockchain functions. `compile` uses the pinned npm `solc` compiler and exports typed ABIs; it does not download a separate compiler binary.

Terminal 1:

```powershell
npm run chain
```

Terminal 2:

```powershell
npm run deploy:local
npm run demo
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**. Keep the Hardhat node alive. Restarting the node clears its state: rerun deployment and demo, then restart Next.js. Clear the wallet's local activity/nonce cache if it remembers transactions from a previous node instance.

The deployment script writes `apps/web/src/generated/deployment.json`. The demo prints a real transaction hash and checks a permitted payment and an invalid category payment. Re-running the demo creates another three budgets; it is intentionally additive, not destructive.

## Vercel deployment

Import this repository with **Root Directory `apps/web`** and **Framework Preset Next.js**. The committed configuration handles workspace installation and the Solidity/Next.js build. Follow the [Vercel deployment guide](docs/VERCEL.md) for environment variables and verification.

## Local Wallet Network

The application uses a local Hardhat network for blockchain development and testing.

| Setting | Value |
|---|---|
| Network | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Native Currency | ETH (local testing only) |
| Explorer | None |

Hardhat provides predefined development accounts for testing:

| Account | Demo Role |
|---|---|
| 0 | Registry Admin |
| 1 | Parent / Fund Provider |
| 2 | Child / Beneficiary |
| 3–6 | Demo Merchants |

Use these accounts only in an isolated development wallet. Never use wallets containing real assets.

## Supabase Setup

Supabase PostgreSQL is used for profile persistence and merchant applications.

1. Create a Supabase project.
2. Run the complete migration file `supabase/migrations/001_initial.sql` in the Supabase SQL Editor.
3. Configure the following environment variables in `apps/web/.env.local`:

```dotenv
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET
SERVER_RPC_URL=http://127.0.0.1:8545
```

4. Restart Next.js and visit `/connect` to connect your wallet and authenticate using SIWE.

**Note:** On-chain functionality works without Supabase. Profile persistence and merchant applications require valid Supabase credentials. Never expose the service-role key through a `NEXT_PUBLIC_` variable.

## Base Sepolia Deployment

The application supports deployment to Base Sepolia using Chain ID `84532`.

See the [Base Chain Documentation](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId).

### 1. Configure Environment Variables

Add the following variables to the root `.env` file:

```dotenv
BASE_SEPOLIA_RPC_URL=YOUR_RPC_ENDPOINT
DEPLOYER_PRIVATE_KEY=YOUR_TESTNET_PRIVATE_KEY
ADMIN_ADDRESS=YOUR_ADMIN_WALLET_ADDRESS
```

Use a dedicated testnet wallet with faucet ETH. Never use a mainnet wallet.

### 2. Deploy Smart Contracts

Run the following commands from the repository root:

```powershell
npm run compile
npm run deploy:base
```

The deployment script verifies the network, deploys the three smart contracts, and exports their addresses and deployment block.

### 3. Configure the Web Application

Update `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
SERVER_RPC_URL=https://sepolia.base.org
```

The generated deployment file provides the contract addresses. Alternatively, all three `NEXT_PUBLIC_*_ADDRESS` values can be overridden together with `NEXT_PUBLIC_DEPLOYMENT_BLOCK`.

Do not mix addresses from different deployments.

### 4. Complete the Setup

After deployment:

1. Restart or rebuild the web application.
2. Connect the token owner through `/settings` to mint demo DCR to the parent.
3. Connect the registry owner through `/admin` to verify merchant wallets.
4. Test the parent-to-child-to-merchant payment flow.

**Note:** Base Sepolia deployment requires testnet credentials, faucet ETH, and an RPC endpoint. Deployment scripts alone do not indicate that contracts have been published.

## Base Sepolia deployment

The configured chain ID is **84532**. See the [Base chain reference](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId).

1. Set root `.env` with `BASE_SEPOLIA_RPC_URL`, a dedicated `DEPLOYER_PRIVATE_KEY`, and optionally `ADMIN_ADDRESS`. Do not use a mainnet account. Obtain test ETH separately.
2. Run:

   ```powershell
   npm run compile
   npm run deploy:base
   ```

3. The script verifies the chain ID, deploys the three contracts, and exports addresses plus the deployment block. It does **not** automatically approve merchants or mint to development accounts on testnet.
4. Update `apps/web/.env.local`:

   ```dotenv
   NEXT_PUBLIC_CHAIN_ID=84532
   NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
   SERVER_RPC_URL=https://sepolia.base.org
   ```

   The generated deployment file supplies the addresses. Alternatively override **all three** `NEXT_PUBLIC_*_ADDRESS` values and set `NEXT_PUBLIC_DEPLOYMENT_BLOCK`. Never combine addresses from different deployments. Leave address overrides empty to use the generated file.

5. Restart/rebuild the web app. Connect the token owner at `/settings` to mint capped demo DCR to the parent. Connect the registry owner at `/admin` to verify test merchant wallets. Then execute the same parent → child → merchant flow.

`ADMIN_ADDRESS` is the initial owner of both token and registry. If supplied, it must be able to sign transactions. Later ownership transfers use OpenZeppelin's two-step acceptance. The vault has no owner or admin withdrawal authority.

No testnet deployment or external publication is represented as complete without an actual transaction/deployment result. This delivery includes a tested local deployment and ready-to-run Base Sepolia scripts; faucet ETH, testnet credentials, and a hosted Supabase project must be supplied by the operator.

## Wallets and production hosting

The app uses wagmi, viem, RainbowKit, and TanStack Query, following [RainbowKit's documented integration](https://rainbowkit.com/en-US/docs/installation). Injected wallets work without a WalletConnect project. For WalletConnect, set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and configure your allowed deployment origins in that service.

This repository uses the requested **Next.js Node server** with protected API routes. Deploy `apps/web` to a Next.js-compatible Node/HTTPS host with the root npm workspace lockfile, compile contracts before building, and supply the server-only environment variables. It is not a static export, and it has not been published through a substitute framework or placeholder API. Public RPC URLs are public by design; put private provider credentials only in `SERVER_RPC_URL`.

```powershell
npm run build
npm run start -w @mwr/web