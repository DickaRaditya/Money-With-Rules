# Security model and MVP limitations

## What is enforced on chain

- Caller must equal the selected budget's beneficiary.
- The budget must exist, be unpaused, and satisfy `startsAt <= block.timestamp <= endsAt`.
- Amount must be positive and fit the budget balance, transaction ceiling, and remaining UTC-day ceiling.
- Merchant must be verified and unsuspended, its category must be enabled, and its grant mask must include the budget's category.
- An enabled budget whitelist adds a separate address check; it never bypasses category verification.
- Zero address, the vault itself, the beneficiary, and the budget's parent cannot be direct merchant destinations.
- Only the budget's parent may edit rules, whitelist, pause state, deposit, withdraw, or reallocate.
- Parent withdrawal always goes back to the parent and only while paused or after expiry. Every withdrawal is an event visible to the child.
- Reallocation cannot cross parent or beneficiary boundaries and cannot reset the daily spend counter.
- The vault has no administrator, upgrade proxy, arbitrary transfer method, or admin sweep.

SafeERC20 handles failed/false-returning token operations; ReentrancyGuard covers all money-moving entry points. Checks and accounting effects precede external transfers. Transfer failures roll back both state and event logs. Solidity checked arithmetic and a subtractive daily-limit comparison avoid addition overflow. The fixed deployed DCR is non-rebasing and has no transfer fee. The safety components follow [OpenZeppelin Contracts documentation](https://docs.openzeppelin.com/contracts/5.x/api/utils).

## Trusted off-chain decisions

Registry owners determine which merchant wallets receive which classifications. This is a trusted verification process, not an oracle for the contents of a shopping basket. A merchant might collude, sell disallowed items, forward received tokens, or provide off-chain cash back. Smart contracts do not make merchant classification fraud-proof. Revocation only prevents future spending; it cannot recover settled payments.

Parents retain substantial control: they can change spending rules and withdraw paused allocations. This is disclosed in both parent and child views. The system is not a trustless irrevocable gift to a beneficiary.

The UI does not constrain unrelated wallet assets or DCR outside the vault. Tokens sent directly to the vault are donations, not deposits; use `createBudget` or `addFunds`. There is intentionally no sweep function for accidentally sent tokens.

## Authentication and API protections

SIWE challenges bind the expected origin/domain, wallet, chain ID, nonce, issuance time, and five-minute expiry. Signatures are verified server-side, including contract-wallet verification through viem. Challenge storage comes from the server, not a client-submitted message. A database update atomically consumes a valid nonce and creates one session; simultaneous replays cannot create two sessions. Invalid signatures do not consume the nonce.

Sessions are eight-hour opaque random bearers in HttpOnly, SameSite=Lax cookies, Secure on production HTTPS. Only hashes are stored. Each protected request also declares the active wallet and must match its session. Switching the browser wallet does not silently authorize edits under a previous wallet. State-changing routes require an exact `Origin` match and validated bounded JSON inputs. Admin access uses the live registry owner, not a database role. Private keys and service-role secrets are never bundled in client code.

Per-wallet nonce throttling is in PostgreSQL with an advisory transaction lock. Add an edge/global IP limiter and body-size limits at the hosting proxy for a public internet deployment. The Node route also rejects JSON bodies above 16 KB, but that application check alone is not a streaming denial-of-service defense. Persisted sessions and unused nonces need periodic retention cleanup.

## Remaining production work

This is a functional educational MVP, not an audited financial product. Before handling anything with real economic value, conduct an independent contract/security review, establish merchant due diligence and dispute procedures, review dependency advisories, add operational monitoring, formalize key ownership/recovery, use robust RPC providers, build a reorg-aware indexer and finality policy, test hosted Supabase and wallet flows against the actual deployment, and obtain appropriate legal advice for that deployment. No claim of bank/payment licensing, fiat redemption, stable value, or QRIS compatibility is made.

The repository is deliberately non-upgradeable. A future contract change needs a new deployment and explicit migration planning. The fixed four merchant types can be enabled/disabled; adding new type semantics requires a new registry/vault version.

Browser camera scanning uses the native BarcodeDetector API when available; the UI offers QR-payload pasting as a fallback. The QR is unsigned input, not permission or proof of settlement. Merchant, amount, chain, vault, and budget policy must still be reviewed and validated.
