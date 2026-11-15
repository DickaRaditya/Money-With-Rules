# End-to-end demonstration

## Automated, real local-chain demo

With `npm run chain` running in another terminal:

```powershell
npm run deploy:local
npm run demo
```

The deploy script creates DCR, registry, and vault; approves four local merchant categories; mints 5,000 DCR to account 1; and exports addresses. The demo then:

1. Mints another 2,500 DCR through the token owner (account 0).
2. Has the parent (account 1) approve exactly 2,500 DCR.
3. Creates separate food (1,200), education (800), and transport (500) budgets for account 2, with 150 DCR per-payment and 250 DCR daily limits.
4. Calls `checkPayment` for 45 DCR to the verified food merchant (account 3), expecting `OK`.
5. Sends an actual `pay` transaction from account 2 and waits for its receipt.
6. Asserts that the merchant receives exactly 45 DCR and only the food budget decreases to 1,155 DCR.
7. Checks and attempts payment to the education merchant (account 4) using the food budget, expecting `WRONG_CATEGORY` and a contract revert.
8. Verifies unchanged escrow after rejection and checks total escrow against token balance.

The output includes `result: PASS`, a unique receipt hash, and accounting assertions. Nothing is implemented as a fake payment API.

## Interactive walkthrough

1. Start the app and open `/parent` using account 1 in an isolated local development wallet. The three seeded budgets and real vault totals appear after connecting.
2. Open **Buat budget** to create an additional budget, or open an existing budget to add funds. Approval and deposit are separate wallet prompts. Each approval is limited to the requested amount.
3. Use account 2 and the **Penerima** view. Select the food budget and Kantin Nusantara. Enter `45`, click **Periksa aturan di blockchain**, then **Konfirmasi pembayaran**.
4. Verify the wallet signature/submitted/confirmed status, updated balance, and unique payment receipt in **Riwayat aktivitas**.
5. Switch to account 3 in the **Merchant** view. Verify the received DCR and receipt. Create a QR request; it contains the current chain, vault, merchant, and requested DCR amount. Return to account 2 and scan it on a supported browser or paste its payload.
6. As account 2, select the food budget and Ruang Buku. The preview reads **Merchant tidak sesuai kategori**. Directly invoking `pay` also reverts, as proven by tests/demo.
7. As account 0 in **Admin**, suspend Kantin Nusantara. Repeat the child's preview: the merchant is now rejected. Re-enable the merchant to resume payments.
8. As account 1, pause a budget, withdraw a small unused amount, or reallocate to another active budget for account 2. As account 2, inspect **Transparansi dana** and **Jejak budget** to see the withdrawal/reallocation.
9. With Supabase configured, visit `/connect` for each wallet to create a signed session and profile. Submit a merchant application, sign in as the on-chain admin, approve it on chain, and synchronize the application review.

Account role choices never alter contract permissions. The child cannot use parent controls even by making direct calls. The registry admin can approve merchants but cannot withdraw user escrow.

## Status semantics

| UI state                 | Meaning                                                     |
| ------------------------ | ----------------------------------------------------------- |
| Memeriksa kontrak        | Read-only simulation; no signature or token transfer        |
| Konfirmasi di dompet     | Awaiting user wallet action                                 |
| Menunggu konfirmasi      | Submitted hash exists; receipt not yet known                |
| Terkonfirmasi            | Successful on-chain receipt; associated events persist      |
| Ditolak kontrak          | Reverted on-chain receipt; no payment event/effects persist |
| Percobaan tidak terkirim | Optional metadata for preflight failure or wallet rejection |

A timeout remains pending and should be checked before resubmitting. Gas can be charged for a reverted on-chain transaction. Hashless metadata records are not chain evidence.
