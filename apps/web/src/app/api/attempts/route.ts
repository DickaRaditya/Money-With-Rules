import { z } from "zod";
import { decodeFunctionData, TransactionReceiptNotFoundError } from "viem";
import {
  api,
  session,
  db,
  body,
  databaseError,
  serverChain,
  addressSchema,
  ApiError,
} from "@/lib/server";
import { chainId, addresses } from "@/lib/config";
import { MoneyWithRulesVaultAbi } from "@/generated/MoneyWithRulesVault";
export const GET = api(async () => {
  const wallet = await session();
  const database = db();
  const { data, error } = await database
    .from("payment_attempts")
    .select("*")
    .eq("wallet", wallet)
    .eq("chain_id", chainId)
    .eq("vault", addresses.vault.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(100);
  databaseError(error);
  for (const row of data || [])
    if (row.status === "submitted" && row.tx_hash) {
      try {
        const receipt = await serverChain.getTransactionReceipt({ hash: row.tx_hash });
        row.status = receipt.status === "success" ? "confirmed" : "reverted";
        await database
          .from("payment_attempts")
          .update({ status: row.status })
          .eq("id", row.id)
          .eq("wallet", wallet);
      } catch {
        /* Unknown receipt remains submitted, never mislabelled failed. */
      }
    }
  return { attempts: data };
});
export const POST = api(async (request) => {
  const wallet = await session();
  const input = await body(
    request,
    z.object({
      chainId: z.literal(chainId),
      vault: addressSchema,
      budgetId: z.string().regex(/^\d{1,78}$/),
      merchant: addressSchema,
      amount: z.string().regex(/^\d{1,78}$/),
      hash: z
        .string()
        .regex(/^0x[0-9a-fA-F]{64}$/)
        .optional(),
      status: z.enum(["submitted", "failed"]),
      reason: z.string().max(300).optional(),
    }),
  );
  if (input.vault !== addresses.vault.toLowerCase()) throw new ApiError(400, "Vault tidak sesuai.");
  let status: string = "failed";
  if (input.hash) {
    const transaction = await serverChain.getTransaction({ hash: input.hash as `0x${string}` });
    if (transaction.from.toLowerCase() !== wallet || transaction.to?.toLowerCase() !== input.vault)
      throw new ApiError(403, "Transaksi bukan milik sesi ini.");
    const decoded = decodeFunctionData({ abi: MoneyWithRulesVaultAbi, data: transaction.input });
    if (
      decoded.functionName !== "pay" ||
      decoded.args[0].toString() !== input.budgetId ||
      decoded.args[1].toLowerCase() !== input.merchant ||
      decoded.args[2].toString() !== input.amount
    )
      throw new ApiError(400, "Detail transaksi tidak sesuai.");
    status = "submitted";
    try {
      const receipt = await serverChain.getTransactionReceipt({
        hash: input.hash as `0x${string}`,
      });
      status = receipt.status === "success" ? "confirmed" : "reverted";
    } catch (error) {
      if (!(error instanceof TransactionReceiptNotFoundError)) throw error;
    }
  }
  const row = {
    wallet,
    chain_id: chainId,
    vault: input.vault,
    budget_id: input.budgetId,
    merchant: input.merchant,
    amount: input.amount,
    tx_hash: input.hash?.toLowerCase() || null,
    status,
    reason: input.reason || null,
  };
  const { error } = await db().from("payment_attempts").insert(row);
  if (error?.code !== "23505") databaseError(error);
  return { ok: true, status };
});
