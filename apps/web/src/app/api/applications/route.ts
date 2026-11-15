import { z } from "zod";
import { api, session, db, body, databaseError } from "@/lib/server";
export const GET = api(async () => {
  const wallet = await session();
  const { data, error } = await db()
    .from("merchant_applications")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();
  databaseError(error);
  return { application: data };
});
export const POST = api(async (request) => {
  const wallet = await session();
  const input = await body(
    request,
    z.object({
      name: z.string().trim().min(1).max(100),
      location: z.string().trim().max(200),
      category: z.number().int().min(0).max(3),
      description: z.string().trim().max(1000),
      logo_url: z.union([z.literal(""), z.url().startsWith("https://").max(500)]).optional(),
    }),
  );
  const { error } = await db()
    .from("merchant_applications")
    .upsert({
      ...input,
      wallet,
      status: "pending",
      review_note: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    });
  databaseError(error);
  return { ok: true };
});
