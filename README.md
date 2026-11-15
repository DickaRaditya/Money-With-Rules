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

### Local wallet network

| Setting         | Value                            |
| --------------- | -------------------------------- |
| Network         | Hardhat local                    |
| RPC             | `http://127.0.0.1:8545`          |
| Chain ID        | `31337`                          |
| Native currency | ETH (local test only)            |
| Explorer        | None; hashes are still displayed |

The local node provides well-known development accounts. Use its displayed test accounts **only in an isolated development wallet**. The application never asks for or stores private keys. No private key or seed phrase is committed in this repository. You may instead use your own throwaway wallet and fund it through the local Hardhat console; never use a wallet holding real assets.

| Hardhat account | Demo role                                          |
| --------------- | -------------------------------------------------- |
| 0               | Registry admin and DCR mint owner                  |
| 1               | Parent/fund provider; initially receives 5,000 DCR |
| 2               | Child/beneficiary                                  |
| 3               | FOOD: Kantin Nusantara                             |
| 4               | EDUCATION: Ruang Buku                              |
| 5               | TRANSPORT: Jalan Bersama                           |
| 6               | OTHER: Toko Serba Ada                              |

Only public addresses and local merchant names are exported to the browser. No local merchant seed is deployed on Base Sepolia.

## Supabase setup

1. Create a Supabase project and run the **complete** `supabase/migrations/001_initial.sql` in its SQL editor, or use your normal migration workflow.
2. Set these values in `apps/web/.env.local`:

   ```dotenv
   APP_ORIGIN=http://localhost:3000
   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET
   SERVER_RPC_URL=http://127.0.0.1:8545
   ```

3. Restart Next.js. Visit `/connect`, connect the desired wallet, sign the one-use SIWE challenge, then save the profile.
4. Parent labels use `/api/children`. Merchants submit applications from `/merchant`. The current on-chain registry owner signs in to review them at `/admin`.

`APP_ORIGIN` must exactly match the browser origin. `localhost` and `127.0.0.1` are different origins. Production requires HTTPS because session cookies are `Secure` in production. Do not set these server secrets with a `NEXT_PUBLIC_` prefix.

All six tables enable RLS and revoke browser-role access. There are **no permissive anonymous policies**. The server gateway uses the service-role key, validates the wallet session, and scopes queries to that wallet. This design intentionally does not confuse SIWE sessions with Supabase Auth JWTs. Admin access is checked against `MerchantRegistry.owner()` on chain on each protected admin request. The two security-definer nonce functions have a fixed search path and are executable only by `service_role`.

For maintenance, periodically remove expired sessions, old nonces, and obsolete attempt logs using a trusted database maintenance job. Put a global request limiter at your hosting edge before exposing authentication publicly. Nonce issuance already has a serialized per-wallet limit of five per minute.