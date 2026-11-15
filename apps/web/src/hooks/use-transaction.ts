"use client";
import { useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hash } from "viem";
import { addresses, chainId, publicClient, configured } from "@/lib/config";
import { errorMessage } from "@/lib/utils";

export type TxState = {
  stage: "idle" | "checking" | "signature" | "submitted" | "confirmed" | "failed";
  message?: string;
  hash?: Hash;
};
export function useTransaction() {
  const [state, setState] = useState<TxState>({ stage: "idle" });
  const busyRef = useRef(false);
  const { address, chainId: walletChain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  async function execute(
    input: { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] },
    label = "Transaksi",
    payment?: { budgetId: string; merchant: string; amount: string },
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    let hash: Hash | undefined;
    let differentReplacement = false;
    try {
      if (!configured) throw new Error("Kontrak belum dikonfigurasi. Ikuti panduan pengaturan.");
      if (!walletClient || !address) throw new Error("Hubungkan dompet terlebih dahulu.");
      if (walletChain !== chainId) throw new Error("Ganti jaringan dompet sebelum melanjutkan.");
      setState({ stage: "checking", message: `${label}: memeriksa kontrak…` });
      const { request } = await publicClient.simulateContract({ ...input, account: address });
      setState({ stage: "signature", message: `${label}: konfirmasi di dompet Anda.` });
      hash = await walletClient.writeContract(request);
      setState({
        stage: "submitted",
        message: "Transaksi dikirim. Menunggu konfirmasi jaringan…",
        hash,
      });
      if (payment) void logAttempt({ ...payment, wallet: address, hash, status: "submitted" });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 180_000,
        onReplaced: ({ transaction, reason }) => {
          hash = transaction.hash;
          differentReplacement = reason !== "repriced";
          setState({ stage: "submitted", hash, message: "Menunggu transaksi pengganti…" });
        },
      });
      if (differentReplacement)
        throw new Error(
          "Transaksi diganti atau dibatalkan di dompet. Periksa riwayat sebelum mencoba lagi.",
        );
      if (receipt.status !== "success")
        throw new Error("Transaksi dibatalkan oleh kontrak. Biaya gas mungkin tetap dikenakan.");
      setState({
        stage: "confirmed",
        message: `${label} berhasil dikonfirmasi.`,
        hash: receipt.transactionHash,
      });
      if (payment)
        await logAttempt({
          ...payment,
          wallet: address,
          hash: receipt.transactionHash,
          status: "submitted",
        });
      await queryClient.invalidateQueries({ queryKey: ["chain-data"] });
      return true;
    } catch (error) {
      const message = errorMessage(error);
      // A timeout is not a reverted transaction. A submitted hash stays pending until the receipt is known.
      const timedOut = hash && /timeout|timed out|not found/i.test(String(error));
      setState({
        stage: timedOut ? "submitted" : "failed",
        message: timedOut
          ? "Konfirmasi belum diterima. Periksa hash transaksi sebelum mengirim ulang."
          : message,
        hash,
      });
      if (payment)
        await logAttempt({
          ...payment,
          wallet: address,
          hash,
          status: hash ? "submitted" : "failed",
          reason: message,
        });
      return false;
    } finally {
      busyRef.current = false;
    }
  }
  return { execute, state, busy: ["checking", "signature", "submitted"].includes(state.stage) };
}
async function logAttempt(data: Record<string, unknown>) {
  // Metadata is optional and never influences transaction validity or receipt status.
  try {
    await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-mwr-wallet": String(data.wallet || "") },
      body: JSON.stringify({ ...data, chainId, vault: addresses.vault }),
    });
  } catch {
    /* Chain results remain authoritative when metadata is unavailable. */
  }
}
