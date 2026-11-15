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
```

## Checks

```powershell
npm run compile
npm test
npm run lint
npm run typecheck
npm run build
# All checks in one command:
npm run check
# With npm run dev already running (optional HTTP integration checks):
npm run test:http
```

The contract suite covers every payment status, approval rollback, budget isolation, exact limits, UTC resets, preserved daily spending, pause/unpause, whitelist intersections, merchant suspension/revocation, category disablement, permission boundaries, mint caps, controlled withdrawals/reallocation, double-spend, accounting invariants, and malicious token transfers/callbacks. The web suite executes the migration against embedded PostgreSQL (PGlite) and tests deny-by-default access, nonce expiry/rate limiting/one-time consumption, SIWE binding, signature mismatch, QR integrity and token precision. It does not require hosted database credentials.

See [architecture and data model](docs/ARCHITECTURE.md), [security and limitations](docs/SECURITY.md), [complete demo walkthrough](docs/DEMO.md), and [verification record](docs/VERIFICATION.md).
