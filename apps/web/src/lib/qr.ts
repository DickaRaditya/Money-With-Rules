import { isAddress, type Address } from "viem";
import { amount } from "./utils";

export type PaymentRequest = {
  v: 1;
  chainId: number;
  vault: Address;
  merchant: Address;
  amount: string;
};
export function parsePaymentRequest(
  input: string,
  expectedChain: number,
  expectedVault: string,
): PaymentRequest {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("QR tidak valid. Gunakan QR Money With Rules.");
  }
  const data = value as Partial<PaymentRequest> | null;
  if (
    !data ||
    data.v !== 1 ||
    data.chainId !== expectedChain ||
    typeof data.vault !== "string" ||
    data.vault.toLowerCase() !== expectedVault.toLowerCase()
  )
    throw new Error("QR berasal dari jaringan atau vault yang berbeda.");
  if (
    typeof data.merchant !== "string" ||
    !isAddress(data.merchant) ||
    typeof data.amount !== "string"
  )
    throw new Error("Isi QR pembayaran tidak valid.");
  amount(data.amount);
  return data as PaymentRequest;
}
