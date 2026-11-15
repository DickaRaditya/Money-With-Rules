import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createSiweMessage } from "viem/siwe";
import { getAddress } from "viem";
import { z } from "zod";
import {
  api,
  body,
  db,
  origin,
  cookieOptions,
  challengeCookie,
  addressSchema,
  ApiError,
} from "@/lib/server";
import { chainId } from "@/lib/config";
export const runtime = "nodejs";
export const POST = api(async (request) => {
  const input = await body(
    request,
    z.object({ wallet: addressSchema, chainId: z.literal(chainId) }),
  );
  const nonce = randomBytes(24).toString("hex");
  const message = createSiweMessage({
    address: getAddress(input.wallet),
    chainId,
    domain: new URL(origin()).host,
    uri: origin(),
    version: "1",
    nonce,
    statement: "Masuk ke Money With Rules. Tanda tangan ini tidak memindahkan token.",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 300_000),
  });
  const { data, error } = await db().rpc("issue_wallet_nonce", {
    p_wallet: input.wallet,
    p_nonce: nonce,
    p_message: message,
    p_chain: chainId,
  });
  if (error)
    throw new ApiError(
      error.message.includes("RATE_LIMIT") ? 429 : 503,
      error.message.includes("RATE_LIMIT")
        ? "Terlalu banyak permintaan. Tunggu satu menit."
        : "Tantangan masuk belum dapat dibuat.",
    );
  (await cookies()).set(challengeCookie, data, { ...cookieOptions, maxAge: 300 });
  return { message };
});
