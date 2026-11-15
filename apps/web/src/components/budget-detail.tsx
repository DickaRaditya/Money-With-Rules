"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CirclePause,
  Play,
  ShieldCheck,
  Users,
  LockKeyhole,
} from "lucide-react";
import { useChainData, type Budget } from "@/hooks/use-chain-data";
import { useTransaction } from "@/hooks/use-transaction";
import { addresses, publicClient } from "@/lib/config";
import { amount, categories, dcr, localDate, wallet, shortAddress } from "@/lib/utils";
import { MoneyWithRulesVaultAbi as vaultAbi } from "@/generated/MoneyWithRulesVault";
import { MockTokenAbi as tokenAbi } from "@/generated/MockToken";
import {
  ActivityList,
  Badge,
  Card,
  CategoryIcon,
  DataNotice,
  Empty,
  Field,
  Message,
  PageHeading,
  TransactionStatus,
} from "./shared";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";

function dateValue(timestamp: bigint) {
  const date = new Date(Number(timestamp) * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function BudgetDetail({ id }: { id: string }) {
  const { address } = useAccount();
  const { data, error, isLoading, refetch } = useChainData();
  const budget = data?.budgets.find((b) => b.id.toString() === id);
  const day = data ? data.timestamp / 86400n : 0n;
  const spent = useQuery({
    queryKey: ["daily-spent", id, day.toString(), data?.block.toString()],
    enabled: !!budget,
    queryFn: () =>
      publicClient.readContract({
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "dailySpent",
        args: [BigInt(id), day],
      }),
  });
  if (!budget)
    return (
      <>
        <PageHeading title="Detail budget" />
        <DataNotice loading={isLoading} error={error} retry={() => refetch()} />
        {!isLoading && !error && (
          <Card>
            <Empty
              title="Budget belum dapat ditampilkan"
              description="Hubungkan dompet pemberi atau penerima budget ini. Periksa ID dan jaringan yang digunakan."
              action={
                <Button asChild>
                  <Link href="/parent">Kembali ke ringkasan</Link>
                </Button>
              }
            />
          </Card>
        )}
      </>
    );
  const isParent = address?.toLowerCase() === budget.parent.toLowerCase();
  const relevant = data!.activities.filter(
    (a) =>
      a.args.budgetId === budget.id ||
      a.args.fromBudgetId === budget.id ||
      a.args.toBudgetId === budget.id,
  );
  const allowed = new Map<string, boolean>();
  [...relevant]
    .reverse()
    .filter((a) => a.event === "MerchantWhitelistUpdated")
    .forEach((a) => allowed.set(String(a.args.merchant), Boolean(a.args.allowed)));
  const basis = budget.totalFunded + budget.movedIn;
  return (
    <>
      <Link
        href={isParent ? "/parent" : "/child"}
        className="text-link"
        style={{ marginBottom: 20 }}
      >
        <ArrowLeft size={14} />
        Kembali ke ringkasan
      </Link>
      <PageHeading
        eyebrow={`BUDGET #${id}`}
        title={budget.name}
        description={`Untuk ${shortAddress(budget.beneficiary)} · Dibuat oleh ${shortAddress(budget.parent)}`}
        action={
          <Badge className={budget.paused ? "badge-amber" : "badge-green"}>
            {budget.paused
              ? "Dijeda"
              : data!.timestamp > budget.rules.endsAt
                ? "Berakhir"
                : data!.timestamp < budget.rules.startsAt
                  ? "Terjadwal"
                  : "Aktif"}
          </Badge>
        }
      />
      <DataNotice error={error} retry={() => refetch()} />
      <div className="metric-grid">
        <Card className="metric">
          <span>Saldo tersisa</span>
          <strong>
            {dcr(budget.balance)} <small>DCR</small>
          </strong>
        </Card>
        <Card className="metric">
          <span>Total didanai</span>
          <strong>
            {dcr(budget.totalFunded)} <small>DCR</small>
          </strong>
        </Card>
        <Card className="metric">
          <span>Sudah digunakan</span>
          <strong>
            {basis ? Number((budget.totalSpent * 100n) / basis) : 0}%{" "}
            <small>· {dcr(budget.totalSpent)} DCR</small>
          </strong>
        </Card>
      </div>
      <div className="content-grid">
        <div className="stack">
          <Card className="card-padding">
            <div className="row gap-3">
              <CategoryIcon category={budget.rules.category} />
              <div>
                <h3>Aturan penggunaan</h3>
                <p className="muted text-xs">Diperiksa di blockchain setiap kali membayar.</p>
              </div>
            </div>
            <ul className="rule-list">
              <li>
                <ShieldCheck size={18} />
                <div>
                  <strong>Merchant kategori {categories[budget.rules.category]}</strong>
                  <small>Hanya merchant yang masih aktif dan terverifikasi.</small>
                </div>
              </li>
              <li>
                <LockKeyhole size={18} />
                <div>
                  <strong>Maksimal {dcr(budget.rules.maxPerPayment)} DCR per pembayaran</strong>
                  <small>
                    {budget.rules.dailyLimit
                      ? `Batas harian ${dcr(budget.rules.dailyLimit)} DCR.`
                      : "Tanpa batas harian tambahan."}{" "}
                    Terpakai hari ini: {spent.data !== undefined ? dcr(spent.data) : "—"} DCR. Reset
                    00.00 UTC.
                  </small>
                </div>
              </li>
              <li>
                <CalendarDays size={18} />
                <div>
                  <strong>
                    {localDate(budget.rules.startsAt)} — {localDate(budget.rules.endsAt)}
                  </strong>
                  <small>
                    Waktu ditampilkan sesuai zona perangkat. Validasi menggunakan waktu blok.
                  </small>
                </div>
              </li>
              <li>
                <Users size={18} />
                <div>
                  <strong>
                    {budget.whitelistEnabled
                      ? "Daftar merchant khusus aktif"
                      : "Semua merchant terverifikasi dalam kategori"}
                  </strong>
                  <small>
                    {budget.whitelistEnabled
                      ? [...allowed]
                          .filter(([, value]) => value)
                          .map(([key]) => shortAddress(key))
                          .join(", ") || "Daftar kosong: semua pembayaran ditolak."
                      : "Tidak ada pembatasan alamat tambahan."}
                  </small>
                </div>
              </li>
            </ul>
          </Card>
          <section>
            <div className="section-title">
              <h2>Jejak budget</h2>
              <Badge>ON-CHAIN</Badge>
            </div>
            <Card>
              <ActivityList activities={relevant} />
            </Card>
          </section>
        </div>
        <div className="stack">
          {isParent ? (
            <BudgetControls budget={budget} budgets={data!.budgets} timestamp={data!.timestamp} />
          ) : (
            <Card className="card-padding">
              <h3>Siap untuk digunakan?</h3>
              <p className="section-description">
                Pilih merchant yang sesuai dan periksa aturan sebelum mengonfirmasi pembayaran.
              </p>
              <Button asChild>
                <Link href={`/pay?budget=${id}`}>
                  Bayar dengan budget ini <ArrowUpRight size={16} />
                </Link>
              </Button>
            </Card>
          )}
          <Card className="card-padding">
            <h3>Transparansi dana</h3>
            <div className="summary-line">
              <span>Ditarik pemberi dana</span>
              <strong>{dcr(budget.totalWithdrawn)} DCR</strong>
            </div>
            <div className="summary-line">
              <span>Realokasi masuk</span>
              <strong>{dcr(budget.movedIn)} DCR</strong>
            </div>
            <div className="summary-line">
              <span>Realokasi keluar</span>
              <strong>{dcr(budget.movedOut)} DCR</strong>
            </div>
            <p className="section-description">
              Pemberi dapat memperbarui aturan. Penarikan hanya tersedia saat dijeda atau berakhir,
              dan kembali ke dompet pemberi. Semua perubahan terlihat pada jejak budget.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
function BudgetControls({
  budget: b,
  budgets,
  timestamp,
}: {
  budget: Budget;
  budgets: Budget[];
  timestamp: bigint;
}) {
  const tx = useTransaction();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (name: string, args: readonly unknown[], label: string) =>
    tx.execute({ address: addresses.vault, abi: vaultAbi, functionName: name, args }, label);
  async function formAction(
    e: React.FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<unknown>,
  ) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action(new FormData(e.currentTarget));
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || tx.busy;
  return (
    <Card className="card-padding">
      <h3>Kelola budget</h3>
      <p className="section-description">
        Hanya dompet pemberi dana yang bisa mengubah pengaturan ini.
      </p>
      <Button
        variant="secondary"
        disabled={disabled}
        onClick={() =>
          run("setPaused", [b.id, !b.paused], b.paused ? "Mengaktifkan budget" : "Menjeda budget")
        }
      >
        {b.paused ? <Play size={15} /> : <CirclePause size={15} />}
        {b.paused ? "Aktifkan kembali" : "Jeda budget"}
      </Button>
      <div style={{ height: 20 }} />
      <details className="details-panel">
        <summary>Tambah dana</summary>
        <form
          className="stack"
          onSubmit={(e) =>
            formAction(e, async (f) => {
              const value = amount(String(f.get("amount")));
              if (
                await tx.execute(
                  {
                    address: addresses.token,
                    abi: tokenAbi,
                    functionName: "approve",
                    args: [addresses.vault, value],
                  },
                  "Persetujuan token",
                )
              )
                await run("addFunds", [b.id, value], "Penambahan dana");
            })
          }
        >
          <Field label="Jumlah tambahan (DCR)">
            <Input name="amount" required inputMode="decimal" placeholder="100" />
          </Field>
          <p className="muted text-xs">Memerlukan persetujuan token dan konfirmasi deposit.</p>
          <Button size="sm" disabled={disabled}>
            Setujui & tambah dana
          </Button>
        </form>
      </details>
      <details className="details-panel">
        <summary>Ubah aturan</summary>
        <form
          className="stack"
          key={`${b.rules.maxPerPayment}-${b.rules.endsAt}-${b.rules.category}-${b.rules.dailyLimit}`}
          onSubmit={(e) =>
            formAction(e, async (f) => {
              await run(
                "updateRules",
                [
                  b.id,
                  {
                    category: Number(f.get("category")),
                    startsAt: BigInt(Math.floor(new Date(String(f.get("start"))).getTime() / 1000)),
                    endsAt: BigInt(Math.floor(new Date(String(f.get("end"))).getTime() / 1000)),
                    maxPerPayment: amount(String(f.get("max"))),
                    dailyLimit: amount(String(f.get("daily") || "0"), true),
                  },
                ],
                "Perubahan aturan",
              );
            })
          }
        >
          <Field label="Kategori merchant">
            <Select name="category" defaultValue={b.rules.category}>
              {categories.map((c, i) => (
                <option key={c} value={i}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mulai berlaku">
            <Input
              type="datetime-local"
              name="start"
              defaultValue={dateValue(b.rules.startsAt)}
              required
            />
          </Field>
          <Field label="Berlaku sampai">
            <Input
              type="datetime-local"
              name="end"
              defaultValue={dateValue(b.rules.endsAt)}
              required
            />
          </Field>
          <Field label="Maksimal per pembayaran (DCR)">
            <Input name="max" defaultValue={formatUnits(b.rules.maxPerPayment, 18)} required />
          </Field>
          <Field
            label="Batas harian (DCR)"
            help="Pengeluaran hari ini tidak direset saat aturan diubah."
          >
            <Input name="daily" defaultValue={formatUnits(b.rules.dailyLimit, 18)} />
          </Field>
          <Button size="sm" disabled={disabled}>
            Simpan aturan di blockchain
          </Button>
        </form>
      </details>
      <details className="details-panel">
        <summary>Daftar izin merchant</summary>
        <div className="stack">
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() =>
              run("setWhitelistEnabled", [b.id, !b.whitelistEnabled], "Perubahan daftar izin")
            }
          >
            {b.whitelistEnabled ? "Nonaktifkan daftar khusus" : "Aktifkan daftar khusus"}
          </Button>
          <p className="muted text-xs">
            Daftar kosong yang diaktifkan akan menolak semua pembayaran.
          </p>
          <form
            className="stack"
            onSubmit={(e) =>
              formAction(e, async (f) => {
                await run(
                  "setMerchantAllowed",
                  [b.id, wallet(String(f.get("merchant"))), f.get("action") === "allow"],
                  "Pembaruan izin merchant",
                );
              })
            }
          >
            <Field label="Alamat merchant">
              <Input name="merchant" pattern="0x[0-9a-fA-F]{40}" required placeholder="0x…" />
            </Field>
            <Select name="action" aria-label="Tindakan daftar izin">
              <option value="allow">Tambahkan izin</option>
              <option value="deny">Hapus izin</option>
            </Select>
            <Button size="sm" disabled={disabled}>
              Perbarui izin
            </Button>
          </form>
        </div>
      </details>
      <details className="details-panel">
        <summary>Realokasi dana tersisa</summary>
        <p className="section-description">
          Jeda budget sumber terlebih dahulu. Tujuan harus aktif, belum berakhir, dan dimiliki
          pemberi serta penerima yang sama.
        </p>
        <form
          className="stack"
          onSubmit={(e) =>
            formAction(e, async (f) => {
              await run(
                "reallocate",
                [b.id, BigInt(String(f.get("target"))), amount(String(f.get("amount")))],
                "Realokasi dana",
              );
            })
          }
        >
          <Field label="Budget tujuan">
            <Select name="target" required>
              <option value="">Pilih budget</option>
              {budgets
                .filter(
                  (other) =>
                    other.id !== b.id &&
                    other.parent === b.parent &&
                    other.beneficiary === b.beneficiary &&
                    !other.paused &&
                    timestamp <= other.rules.endsAt,
                )
                .map((other) => (
                  <option key={other.id.toString()} value={other.id.toString()}>
                    {other.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Jumlah (DCR)">
            <Input name="amount" required inputMode="decimal" />
          </Field>
          <Button size="sm" disabled={disabled || !b.paused}>
            Realokasi dana
          </Button>
        </form>
      </details>
      <details className="details-panel">
        <summary>Tarik dana tidak terpakai</summary>
        <p className="section-description">
          Dana kembali ke dompet Anda. Penerima akan melihat penarikan pada aktivitas budget.
        </p>
        <form
          className="stack"
          onSubmit={(e) =>
            formAction(e, async (f) => {
              await run(
                "withdrawUnused",
                [b.id, amount(String(f.get("amount")))],
                "Penarikan dana tersisa",
              );
            })
          }
        >
          <Field label="Jumlah penarikan (DCR)">
            <Input name="amount" inputMode="decimal" required />
          </Field>
          <label className="checkbox-row">
            <input type="checkbox" required />
            Saya memahami saldo penerima akan berkurang.
          </label>
          <Button
            size="sm"
            variant="destructive"
            disabled={disabled || (!b.paused && timestamp <= b.rules.endsAt)}
          >
            Tarik ke dompet pemberi
          </Button>
          {!b.paused && timestamp <= b.rules.endsAt && (
            <p className="muted text-xs">Jeda budget untuk mengaktifkan penarikan.</p>
          )}
        </form>
      </details>
      <Message text={message} />
      <TransactionStatus state={tx.state} />
    </Card>
  );
}
