import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits, isAddress, maxUint256, parseUnits, type Address } from "viem";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Belum terhubung";
}
export function dcr(value: bigint = 0n) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(
    Number(formatUnits(value, 18)),
  );
}
export function amount(value: string, allowZero = false): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(value))
    throw new Error("Masukkan jumlah DCR dengan titik sebagai pemisah desimal (maks. 18 angka).");
  const result = parseUnits(value, 18);
  if (result > maxUint256) throw new Error("Jumlah melebihi batas token.");
  if (!allowZero && result <= 0n) throw new Error("Jumlah harus lebih dari nol.");
  return result;
}
export function wallet(value: string): Address {
  if (!isAddress(value, { strict: false })) throw new Error("Alamat dompet tidak valid.");
  return value as Address;
}
export function localDate(value: bigint | number) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZoneName: "short",
  }).format(new Date(Number(value) * 1000));
}
export const categories = ["Makanan", "Pendidikan", "Transportasi", "Lainnya"] as const;
export const reasons = [
  "Pembayaran memenuhi semua aturan",
  "Budget tidak ditemukan",
  "Dompet bukan penerima budget",
  "Budget sedang dijeda",
  "Budget belum dimulai",
  "Budget sudah kedaluwarsa",
  "Jumlah harus lebih dari nol",
  "Merchant belum terverifikasi atau ditangguhkan",
  "Merchant tidak sesuai kategori",
  "Merchant tidak ada dalam daftar yang diizinkan",
  "Saldo kategori tidak mencukupi",
  "Batas transaksi terlampaui",
  "Batas harian terlampaui",
  "Alamat tujuan pembayaran tidak diizinkan",
];
export function errorMessage(error: unknown): string {
  const e = error as {
    name?: string;
    shortMessage?: string;
    message?: string;
    cause?: unknown;
    data?: { errorName?: string; args?: readonly unknown[] };
  };
  if (e?.data?.errorName === "PaymentRejected")
    return reasons[Number(e.data.args?.[0])] || "Pembayaran ditolak kontrak.";
  const contractMessages: Record<string, string> = {
    InvalidConfiguration: "Pengaturan budget tidak valid. Periksa tanggal, batas, dan alamat.",
    NotParent: "Hanya pemberi dana budget ini yang dapat melakukan tindakan tersebut.",
    UnknownBudget: "Budget tidak ditemukan.",
    InvalidAmount: "Jumlah harus positif dan tidak melebihi saldo budget.",
    UnsupportedToken: "Transfer token tidak sesuai dengan jumlah yang diminta.",
    BudgetMustBePausedOrExpired:
      "Jeda budget atau tunggu masa berlakunya berakhir sebelum menarik dana.",
    InvalidReallocation:
      "Realokasi memerlukan sumber dijeda dan tujuan aktif untuk pemberi serta penerima yang sama.",
    OwnableUnauthorizedAccount: "Dompet ini tidak memiliki izin untuk tindakan tersebut.",
    ERC20InsufficientBalance: "Saldo DCR dompet tidak mencukupi.",
    ERC20InsufficientAllowance: "Setujui penggunaan DCR terlebih dahulu.",
    SupplyCapExceeded: "Pencetakan melebihi batas suplai Demo Credits.",
  };
  if (e?.data?.errorName && contractMessages[e.data.errorName])
    return contractMessages[e.data.errorName];
  if (e?.cause) {
    const nested = errorMessage(e.cause);
    if (nested !== "Transaksi gagal. Periksa jaringan dan coba lagi.") return nested;
  }
  if (/reject|denied/i.test(e?.name || "") || /user rejected|user denied/i.test(e?.message || ""))
    return "Permintaan dibatalkan di dompet.";
  if (e instanceof Error && !("shortMessage" in e) && !/http|rpc|fetch|contract/i.test(e.message))
    return e.message;
  return "Transaksi gagal. Periksa jaringan dan coba lagi.";
}
