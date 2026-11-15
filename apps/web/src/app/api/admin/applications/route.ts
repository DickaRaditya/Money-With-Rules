import { z } from "zod";
import {
  api,
  requireAdmin,
  db,
  body,
  addressSchema,
  databaseError,
  serverChain,
  ApiError,
} from "@/lib/server";
import { addresses } from "@/lib/config";
import { MerchantRegistryAbi } from "@/generated/MerchantRegistry";
export const GET = api(async () => {
  await requireAdmin();
  const { data, error } = await db()
    .from("merchant_applications")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);
  databaseError(error);
  return { applications: data };
});
export const PATCH = api(async (request) => {
  const reviewer = await requireAdmin();
  const input = await body(
    request,
    z.object({
      wallet: addressSchema,
      action: z.enum(["approve", "reject"]),
      review_note: z.string().max(500).optional(),
    }),
  );
  const database = db();
  const { data: application } = await database
    .from("merchant_applications")
    .select("category")
    .eq("wallet", input.wallet)
    .single();
  if (!application) throw new ApiError(404, "Pengajuan tidak ditemukan.");
  if (input.action === "approve") {
    const allowed = await serverChain.readContract({
      address: addresses.registry,
      abi: MerchantRegistryAbi,
      functionName: "isAllowed",
      args: [input.wallet as `0x${string}`, application.category],
    });
    if (!allowed)
      throw new ApiError(409, "Konfirmasi kategori merchant di blockchain terlebih dahulu.");
  }
  const { error } = await database
    .from("merchant_applications")
    .update({
      status: input.action === "approve" ? "approved" : "rejected",
      reviewed_by: reviewer,
      review_note: input.review_note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet", input.wallet);
  databaseError(error);
  return { ok: true };
});
