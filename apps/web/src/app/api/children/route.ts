import { z } from "zod";
import { api, session, db, body, databaseError, addressSchema, ApiError } from "@/lib/server";
export const GET = api(async () => {
  const wallet = await session();
  const { data, error } = await db()
    .from("child_relationships")
    .select("child_wallet,label")
    .eq("parent_wallet", wallet)
    .order("created_at")
    .limit(100);
  databaseError(error);
  return { children: data };
});
export const POST = api(async (request) => {
  const wallet = await session();
  const input = await body(
    request,
    z.object({ child_wallet: addressSchema, label: z.string().trim().min(1).max(80) }),
  );
  if (input.child_wallet === wallet) throw new ApiError(400, "Pilih dompet penerima yang berbeda.");
  const { error } = await db()
    .from("child_relationships")
    .upsert({ ...input, parent_wallet: wallet });
  databaseError(error);
  return { ok: true };
});
export const DELETE = api(async (request) => {
  const wallet = await session();
  const { child_wallet } = await body(request, z.object({ child_wallet: addressSchema }));
  const { error } = await db()
    .from("child_relationships")
    .delete()
    .eq("parent_wallet", wallet)
    .eq("child_wallet", child_wallet);
  databaseError(error);
  return { ok: true };
});
