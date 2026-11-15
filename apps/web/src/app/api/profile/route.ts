import { z } from "zod";
import { api, session, db, body, databaseError } from "@/lib/server";
export const GET = api(async () => {
  const wallet = await session();
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();
  databaseError(error);
  return { wallet, profile: data };
});
export const POST = api(async (request) => {
  const wallet = await session();
  const input = await body(
    request,
    z.object({
      display_name: z.string().trim().min(1).max(80),
      role: z.enum(["parent", "child", "merchant"]),
    }),
  );
  const { error } = await db()
    .from("profiles")
    .upsert({ ...input, wallet, updated_at: new Date().toISOString() });
  databaseError(error);
  return { ok: true };
});
