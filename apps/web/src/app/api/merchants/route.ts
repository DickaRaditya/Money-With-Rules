import { api, db, databaseError } from "@/lib/server";
export const GET = api(async () => {
  const { data, error } = await db()
    .from("merchant_applications")
    .select("wallet,name,location,logo_url")
    .eq("status", "approved")
    .limit(500);
  databaseError(error);
  return { merchants: data };
});
