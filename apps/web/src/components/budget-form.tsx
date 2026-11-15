"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  LockKeyhole,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { MoneyWithRulesVaultAbi as vaultAbi } from "@/generated/MoneyWithRulesVault";
import { MockTokenAbi as tokenAbi } from "@/generated/MockToken";
import { addresses, configured, demoWallets } from "@/lib/config";
import { amount, categories, wallet, dcr } from "@/lib/utils";
import { useTransaction } from "@/hooks/use-transaction";
import { useChainData } from "@/hooks/use-chain-data";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import { Card, Field, Message, PageHeading, TransactionStatus, DataNotice } from "./shared";

function dateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function BudgetForm() {
  const { address } = useAccount();
  const hydrated = useHydrated();
  const chain = useChainData();
  const tx = useTransaction();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [whitelist, setWhitelist] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [dates] = useState(() => ({
    start: dateInput(new Date()),
    end: dateInput(new Date(Date.now() + 30 * 86400_000)),
  }));
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (formBusy) return;
    setFormBusy(true);
    setMessage("");
    try {
      const form = new FormData(e.currentTarget);
      const beneficiary = wallet(String(form.get("beneficiary")));
      if (beneficiary.toLowerCase() === address?.toLowerCase())
        throw new Error("Pilih dompet penerima yang berbeda dari pemberi dana.");
      const value = amount(String(form.get("amount")));
      const name = String(form.get("name")).trim();
      if (new TextEncoder().encode(name).length > 80)
        throw new Error("Nama budget maksimal 80 byte. Gunakan nama yang lebih singkat.");
      const rules = {
        category: Number(form.get("category")),
        startsAt: BigInt(Math.floor(new Date(String(form.get("start"))).getTime() / 1000)),
        endsAt: BigInt(Math.floor(new Date(String(form.get("end"))).getTime() / 1000)),
        maxPerPayment: amount(String(form.get("max"))),
        dailyLimit: amount(String(form.get("daily") || "0"), true),
      };
      if (rules.startsAt >= rules.endsAt || rules.endsAt <= BigInt(Math.floor(Date.now() / 1000)))
        throw new Error("Tanggal akhir harus setelah tanggal mulai dan waktu sekarang.");
      const merchants = whitelist
        ? String(form.get("merchants") || "")
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(wallet)
        : [];
      if (merchants.length > 32) throw new Error("Maksimal 32 alamat merchant saat pembuatan.");
      if (whitelist && !merchants.length)
        throw new Error("Tambahkan setidaknya satu merchant atau nonaktifkan daftar izin.");
      if (chain.data && value > chain.data.walletBalance)
        throw new Error("Saldo DCR dompet tidak cukup untuk mendanai budget.");
      const approved = await tx.execute(
        {
          address: addresses.token,
          abi: tokenAbi,
          functionName: "approve",
          args: [addresses.vault, value],
        },
        "1/2 · Persetujuan token",
      );
      if (!approved) return;
      const created = await tx.execute(
        {
          address: addresses.vault,
          abi: vaultAbi,
          functionName: "createBudget",
          args: [beneficiary, name, rules, value, whitelist, merchants],
        },
        "2/2 · Pembuatan budget",
      );
      if (created) router.push("/parent");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setFormBusy(false);
    }
  }
  return (
    <>
      <Link className="text-link" href="/parent" style={{ marginBottom: 22 }}>
        <ArrowLeft size={15} />
        Kembali ke ringkasan
      </Link>
      <PageHeading
        title="Sebuah budget, sebuah tujuan."
        description="Tentukan untuk siapa, untuk apa, dan bagaimana dana digunakan."
      />
      <DataNotice error={chain.error} loading={chain.isLoading} retry={() => chain.refetch()} />
      <div className="content-grid">
        <Card className="card-padding">
          <form onSubmit={submit}>
            <section className="form-section">
              <h3>
                01 <span className="muted">/</span> Tujuan & penerima
              </h3>
              <div className="form-grid">
                <Field label="Nama budget">
                  <Input name="name" required maxLength={60} placeholder="Contoh: Makan & minum" />
                </Field>
                <Field label="Jenis merchant yang diizinkan">
                  <Select name="category">
                    {categories.map((c, i) => (
                      <option value={i} key={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="full-width">
                  <Field
                    label="Alamat dompet penerima"
                    help="Pastikan alamat benar. Penerima dan pemilik tidak dapat diganti setelah budget dibuat."
                  >
                    <Input
                      name="beneficiary"
                      required
                      placeholder="0x…"
                      pattern="0x[0-9a-fA-F]{40}"
                      defaultValue={demoWallets.child || ""}
                    />
                  </Field>
                </div>
              </div>
            </section>
            <section className="form-section">
              <h3>
                02 <span className="muted">/</span> Alokasi & masa berlaku
              </h3>
              <div className="form-grid">
                <div className="full-width">
                  <Field
                    label="Jumlah alokasi (DCR)"
                    help={`Saldo dompet: ${chain.data ? dcr(chain.data.walletBalance) : "—"} DCR. Persetujuan hanya sebesar jumlah ini.`}
                  >
                    <Input
                      name="amount"
                      inputMode="decimal"
                      required
                      placeholder="1.000 DCR → ketik 1000"
                    />
                  </Field>
                </div>
                <Field label="Mulai berlaku" help="Mengikuti zona waktu perangkat Anda.">
                  <Input
                    name="start"
                    type="datetime-local"
                    required
                    defaultValue={hydrated ? dates.start : ""}
                  />
                </Field>
                <Field label="Berlaku sampai" help="Disimpan sebagai timestamp UTC di kontrak.">
                  <Input
                    name="end"
                    type="datetime-local"
                    required
                    defaultValue={hydrated ? dates.end : ""}
                  />
                </Field>
              </div>
            </section>
            <section className="form-section">
              <h3>
                03 <span className="muted">/</span> Aturan penggunaan
              </h3>
              <div className="form-grid">
                <Field label="Maksimal per pembayaran (DCR)">
                  <Input name="max" inputMode="decimal" required placeholder="150" />
                </Field>
                <Field
                  label="Batas harian (DCR)"
                  help="Kosong atau 0 = tanpa batas harian. Reset pukul 00.00 UTC (07.00 WIB)."
                >
                  <Input name="daily" inputMode="decimal" placeholder="250" />
                </Field>
                <label className="checkbox-row full-width">
                  <input
                    type="checkbox"
                    checked={whitelist}
                    onChange={(e) => setWhitelist(e.target.checked)}
                  />
                  <span>
                    Batasi ke daftar alamat merchant tertentu
                    <br />
                    <small>Merchant tetap harus terverifikasi dan sesuai kategori.</small>
                  </span>
                </label>
                {whitelist && (
                  <div className="full-width">
                    <Field
                      label="Daftar alamat merchant"
                      help="Pisahkan dengan koma atau baris baru. Maksimal 32 alamat."
                    >
                      <Textarea name="merchants" placeholder="0x…" required />
                    </Field>
                  </div>
                )}
              </div>
            </section>
            <Message text={message} />
            <TransactionStatus state={tx.state} />
            <div className="form-actions">
              <Button variant="secondary" asChild>
                <Link href="/parent">Batal</Link>
              </Button>
              <Button disabled={!address || !configured || formBusy || tx.busy} type="submit">
                {formBusy ? "Menunggu proses dompet…" : "Setujui & buat budget"}
                <ArrowUpRight size={16} />
              </Button>
            </div>
          </form>
        </Card>
        <Card className="card-padding sticky-card">
          <span className="category-icon category-0">
            <ShieldCheck size={24} />
          </span>
          <h3 style={{ marginTop: 18 }}>Aturan bukan sekadar janji.</h3>
          <p className="section-description">
            Kontrak memeriksa setiap pembayaran sebelum token berpindah.
          </p>
          <ul className="rule-list">
            <li>
              <Wallet size={18} />
              <div>
                <strong>Dua konfirmasi dompet</strong>
                <small>
                  Persetujuan DCR, lalu pembuatan budget sekaligus deposit. Jika tahap kedua gagal,
                  token tetap di dompet.
                </small>
              </div>
            </li>
            <li>
              <LockKeyhole size={18} />
              <div>
                <strong>Hanya untuk penerima yang dipilih</strong>
                <small>Penerima tidak dapat menarik dana atau mengubah aturan.</small>
              </div>
            </li>
            <li>
              <CalendarDays size={18} />
              <div>
                <strong>Penarikan yang terlihat</strong>
                <small>
                  Pemberi hanya dapat menarik dana yang tidak terpakai saat budget dijeda atau
                  berakhir. Aktivitasnya tercatat.
                </small>
              </div>
            </li>
          </ul>
          <p className="section-description">
            Biaya gas testnet mungkin berlaku untuk kedua transaksi.
          </p>
        </Card>
      </div>
    </>
  );
}
