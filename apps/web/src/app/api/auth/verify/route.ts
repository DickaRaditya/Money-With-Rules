import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  api,
  body,
  db,
  origin,
  sessionCookie,
  challengeCookie,
  cookieOptions,
  ApiError,
  serverChain,
} from "@/lib/server";
import { hashSession, validChallenge } from "@/lib/auth-policy";
import { chainId } from "@/lib/config";
export const runtime = "nodejs";
export const POST = api(async (request) => {
  const { signature } = await body(
    request,
    z.object({
      signature: z
        .string()
        .regex(/^0x[0-9a-fA-F]+$/)
        .max(8192),
    }),
  );
  const jar = await cookies();
  const id = jar.get(challengeCookie)?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id))
    throw new ApiError(401, "Tantangan masuk tidak ditemukan.");
  const database = db();
  const { data: challenge, error } = await database
    .from("auth_nonces")
    .select("*")
    .eq("id", id)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (
    error ||
    !challenge ||
    !validChallenge(challenge.message, challenge.wallet, challenge.nonce, chainId, origin())
  )
    throw new ApiError(401, "Tantangan sudah kedaluwarsa atau digunakan.");
  const verified = await serverChain.verifySiweMessage({
    message: challenge.message,
    signature: signature as `0x${string}`,
    domain: new URL(origin()).host,
    nonce: challenge.nonce,
    address: challenge.wallet,
  });
  if (!verified) throw new ApiError(401, "Tanda tangan dompet tidak valid.");
  const token = randomBytes(32).toString("hex");
  const { data: consumed, error: consumeError } = await database.rpc("consume_wallet_nonce", {
    p_id: id,
    p_token_hash: hashSession(token),
  });
  if (consumeError || !consumed)
    throw new ApiError(401, "Tantangan sudah digunakan. Silakan masuk kembali.");
  const old = jar.get(sessionCookie)?.value;
  if (old) await database.from("wallet_sessions").delete().eq("token_hash", hashSession(old));
  jar.set(sessionCookie, token, { ...cookieOptions, maxAge: 8 * 3600 });
  jar.delete(challengeCookie);
  return { wallet: challenge.wallet };
});
