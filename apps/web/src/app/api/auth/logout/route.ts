import { cookies } from "next/headers";
import { api, db, sessionCookie, challengeCookie } from "@/lib/server";
import { hashSession } from "@/lib/auth-policy";
export const POST = api(async () => {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await db().from("wallet_sessions").delete().eq("token_hash", hashSession(token));
  jar.delete(sessionCookie);
  jar.delete(challengeCookie);
  return { ok: true };
});
