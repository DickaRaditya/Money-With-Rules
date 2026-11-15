import { createHash } from "node:crypto";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";

export function hashSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function sameOrigin(origin: string | null, expected: string) {
  try {
    return origin !== null && new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
export function validChallenge(
  message: string,
  wallet: string,
  nonce: string,
  chainId: number,
  origin: string,
  now = new Date(),
) {
  try {
    const parsed = parseSiweMessage(message);
    return (
      parsed.chainId === chainId &&
      parsed.uri === origin &&
      parsed.address?.toLowerCase() === wallet.toLowerCase() &&
      !!parsed.expirationTime &&
      validateSiweMessage({ message: parsed, domain: new URL(origin).host, nonce, time: now })
    );
  } catch {
    return false;
  }
}
