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
