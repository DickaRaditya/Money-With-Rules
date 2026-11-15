import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { z } from "zod";
import { addresses, chain, chainId, configured, rpcUrl } from "./config";
import { hashSession, sameOrigin } from "./auth-policy";
import { MerchantRegistryAbi } from "@/generated/MerchantRegistry";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const sessionCookie = "mwr-session";
export const challengeCookie = "mwr-challenge";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
export function origin() {
  return new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin;
}
export function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new ApiError(
      503,
      "Penyimpanan profil belum dikonfigurasi. Fitur kontrak tetap dapat digunakan.",
    );
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const serverChain = createPublicClient({
  chain,
  transport: http(process.env.SERVER_RPC_URL || rpcUrl),
});
export function assertOrigin(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), origin()))
    throw new ApiError(403, "Asal permintaan tidak diizinkan.");
}
export async function body<T>(request: Request, schema: z.ZodType<T>) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(415, "Format permintaan harus JSON.");
  const text = await request.text();
  if (text.length > 16000) throw new ApiError(413, "Permintaan terlalu besar.");
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new ApiError(400, "Data tidak valid. Periksa kolom formulir.");
  }
}
export async function session() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(401, "Masuk dengan tanda tangan dompet terlebih dahulu.");
  const { data, error } = await db()
    .from("wallet_sessions")
    .select("wallet,chain_id")
    .eq("token_hash", hashSession(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new ApiError(503, "Penyimpanan sesi tidak tersedia.");
  if (!data || data.chain_id !== chainId)
    throw new ApiError(401, "Sesi berakhir. Silakan masuk lagi.");
  const expectedWallet = (await headers()).get("x-mwr-wallet");
  if (!expectedWallet || expectedWallet.toLowerCase() !== data.wallet)
    throw new ApiError(401, "Dompet berubah. Masuk kembali dengan dompet yang aktif.");
  return data.wallet as `0x${string}`;
}
export async function requireAdmin() {
  const wallet = await session();
  if (!configured) throw new ApiError(503, "Kontrak belum dikonfigurasi.");
  const owner = await serverChain.readContract({
    address: addresses.registry,
    abi: MerchantRegistryAbi,
    functionName: "owner",
  });
  if (wallet.toLowerCase() !== owner.toLowerCase())
    throw new ApiError(403, "Hanya admin registry yang dapat mengakses antrean.");
  return wallet;
}
export function databaseError(error: unknown) {
  if (error) throw new ApiError(503, "Data belum dapat disimpan. Periksa konfigurasi database.");
}
export function api(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      if (request.method !== "GET") assertOrigin(request);
      const result = await handler(request);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const known = error instanceof ApiError;
      return NextResponse.json(
        { error: known ? error.message : "Layanan belum tersedia. Silakan coba lagi." },
        { status: known ? error.status : 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((s) => s.toLowerCase());
