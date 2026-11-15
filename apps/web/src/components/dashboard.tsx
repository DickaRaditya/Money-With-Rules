"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Plus, ShieldCheck, Users, Wallet, ArrowRight } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { dcr, categories, shortAddress } from "@/lib/utils";
import { apiRequest } from "@/lib/api-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ActivityList,
  Badge,
  BudgetCard,
  Card,
  DataNotice,
  Empty,
  Field,
  Message,
  PageHeading,
  WalletButton,
} from "./shared";

type ChildRow = { child_wallet: string; label: string };
export function Dashboard({ role }: { role: "parent" | "child" }) {
  const { address } = useAccount();
  const { data, isLoading, error, refetch } = useChainData();
  const [filter, setFilter] = useState("all");
  const children = useQuery({
    queryKey: ["children", address],
    queryFn: () => apiRequest<{ children: ChildRow[] }>("children", address),
    enabled: !!address && role === "parent",
    retry: false,
  });
  const budgets =
    data?.budgets.filter(
      (b) =>
        (role === "parent" ? b.parent : b.beneficiary).toLowerCase() === address?.toLowerCase(),
    ) || [];
  const balance = budgets.reduce((sum, b) => sum + b.balance, 0n);
  const funded = budgets.reduce((sum, b) => sum + b.totalFunded, 0n);
  const spent = budgets.reduce((sum, b) => sum + b.totalSpent, 0n);
  const totals = categories.map((_, i) =>
    budgets.filter((b) => b.rules.category === i).reduce((sum, b) => sum + b.balance, 0n),
  );
  const colors = ["#afb98a", "#b5a8c9", "#9dbbca", "#d8b99a"];
  let cursor = 0;
  const stops = totals.map((value, i) => {
    const start = cursor;
    cursor += balance ? Number((value * 10000n) / balance) / 100 : 0;
    return `${colors[i]} ${start}% ${cursor}%`;
  });
  const childWallets = [
    ...new Set([
      ...budgets.map((b) => b.beneficiary),
      ...(children.data?.children.map((c) => c.child_wallet) || []),
    ]),
  ];
  const ids = new Set(budgets.map((b) => b.id));
  const activity =
    data?.activities.filter(
      (a) =>
        ids.has(a.args.budgetId as bigint) ||
        ids.has(a.args.fromBudgetId as bigint) ||
        ids.has(a.args.toBudgetId as bigint),
    ) || [];
  const displayBudgets = budgets.filter(
    (b) =>
      filter === "all" ||
      (filter === "active" ? !b.paused && (data?.timestamp || 0n) <= b.rules.endsAt : b.paused),
  );
  return (
    <>
      <PageHeading
        title={
          role === "parent" ? "Rencana baik, mulai hari ini." : "Hari baru, pilihan yang baik."
        }
        description={
          role === "parent"
            ? "Kelola uang saku dengan tujuan. Beri ruang untuk tumbuh."
            : "Budget Anda siap menemani hal-hal yang berarti."
        }
        action={
          <Button asChild>
            <Link href={role === "parent" ? "/budgets/new" : "/pay"}>
              {role === "parent" ? <Plus size={17} /> : <ArrowUpRight size={17} />}
              {role === "parent" ? "Buat budget" : "Bayar merchant"}
            </Link>
          </Button>
        }
      />
      <DataNotice loading={isLoading} error={error} retry={() => refetch()} />
      <div className="overview-grid">
        <section className="balance-card" aria-label="Saldo tersimpan di vault">
          <div className="row between">
            <span className="balance-label">
              {role === "parent" ? "Total saldo teralokasi" : "Saldo budget Anda"}
            </span>
            <Badge>
              <ShieldCheck size={12} /> TERLINDUNGI ATURAN
            </Badge>
          </div>
          <div className="balance-amount">
            {address && data ? dcr(balance) : "—"}
            <span>DCR</span>
          </div>
          <p className="balance-subtitle">
            Demo Credits · Tersimpan di vault, siap digunakan sesuai tujuan
          </p>
          <div className="balance-bottom">
            <div>
              <small>{role === "parent" ? "Total didanai" : "Total alokasi"}</small>
              <strong>{address && data ? dcr(funded) : "—"} DCR</strong>
            </div>
            <div>
              <small>Sudah digunakan</small>
              <strong>{address && data ? dcr(spent) : "—"} DCR</strong>
            </div>
            <Link href="/history" className="balance-arrow" aria-label="Lihat riwayat">
              <ArrowUpRight size={19} />
            </Link>
          </div>
        </section>
        <Card className="allocation-card">
          <div className="row between">
            <h3>Setiap token punya tujuan</h3>
            <span className="muted text-xs">Alokasi saat ini</span>
          </div>
          <div className="allocation-inner">
            <div
              className="donut"
              style={{
                background: balance ? `conic-gradient(${stops.join(",")})` : "var(--surface-soft)",
              }}
            >
              <div>
                <strong>{budgets.length}</strong>
                <small>budget terencana</small>
              </div>
            </div>
            <div className="allocation-legend">
              {categories.map((category, i) => (
                <div className="legend-line" key={category}>
                  <span style={{ background: colors[i] }} />
                  <span>{category}</span>
                  <strong>{balance ? `${Number((totals[i] * 100n) / balance)}%` : "—"}</strong>
                </div>
              ))}
            </div>
          </div>
          <p className="allocation-caption">
            Saldo setiap budget terpisah dan tidak saling tercampur.
          </p>
        </Card>
      </div>
      <div className="section-title">
        <div>
          <h2>
            Budget {role === "parent" ? "keluarga" : "saya"}
            <span>{budgets.length}</span>
          </h2>
          <p>Ruang untuk kebutuhan, batas untuk ketenangan.</p>
        </div>
        <div className="pill-tabs" aria-label="Filter budget">
          {[
            ["all", "Semua"],
            ["active", "Aktif"],
            ["paused", "Dijeda"],
          ].map(([value, label]) => (
            <button
              className={filter === value ? "active" : ""}
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {!address ? (
        <Card>
          <Empty
            title="Satu koneksi, banyak rencana."
            description="Hubungkan dompet untuk melihat saldo dan budget Anda langsung dari blockchain."
            action={<WalletButton />}
          />
        </Card>
      ) : !displayBudgets.length ? (
        <Card>
          <Empty
            title="Rencana pertama menanti"
            description={
              role === "parent"
                ? "Buat budget untuk memulai. Token akan tersimpan terpisah untuk setiap penerima dan tujuan."
                : "Budget dari pemberi dana akan muncul di sini. Pastikan alamat dompet penerima sudah benar."
            }
            action={
              role === "parent" && (
                <Button asChild>
                  <Link href="/budgets/new">
                    <Plus size={15} />
                    Buat budget pertama
                  </Link>
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="budgets-grid">
          {displayBudgets.map((b) => (
            <BudgetCard budget={b} timestamp={data!.timestamp} key={b.id.toString()} />
          ))}
        </div>
      )}
      <div className="lower-grid">
        <section>
          <div className="section-title">
            <h2>Aktivitas terbaru</h2>
            <Link className="text-link" href="/history">
              Lihat semua <ArrowUpRight size={14} />
            </Link>
          </div>
          <Card>
            <ActivityList activities={activity} compact />
          </Card>
        </section>
        <section>
          <div className="section-title">
            <h2>{role === "parent" ? "Penerima dana" : "Merchant pilihan"}</h2>
            <span className="muted text-xs">
              {role === "parent"
                ? `${childWallets.length} penerima`
                : "Terverifikasi di blockchain"}
            </span>
          </div>
          <Card>
            {role === "parent" ? (
              <>
                <div className="child-list">
                  {childWallets.length ? (
                    childWallets.map((child, i) => (
                      <div className="child-row" key={child}>
                        <span className="child-avatar">
                          {children.data?.children
                            .find((c) => c.child_wallet.toLowerCase() === child.toLowerCase())
                            ?.label.slice(0, 1)
                            .toUpperCase() || `0${i + 1}`}
                        </span>
                        <div>
                          <strong>
                            {children.data?.children.find(
                              (c) => c.child_wallet.toLowerCase() === child.toLowerCase(),
                            )?.label || "Penerima dana"}
                          </strong>
                          <p>{shortAddress(child)}</p>
                        </div>
                        <Badge>
                          {
                            budgets.filter(
                              (b) => b.beneficiary.toLowerCase() === child.toLowerCase(),
                            ).length
                          }{" "}
                          budget
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="Belum ada penerima"
                      description="Tambahkan dompet penerima saat membuat budget."
                    />
                  )}
                </div>
                <ChildManager address={address} saved={children.data?.children || []} />
              </>
            ) : (
              <div className="child-list">
                {data?.merchants
                  .filter((m) => m.verified)
                  .slice(0, 3)
                  .map((m) => (
                    <Link href={`/pay?merchant=${m.address}`} className="child-row" key={m.address}>
                      <span className="child-avatar">{m.name.slice(0, 1)}</span>
                      <div>
                        <strong>{m.name}</strong>
                        <p>{m.location}</p>
                      </div>
                      <ArrowUpRight size={15} />
                    </Link>
                  ))}
                {!data?.merchants.some((m) => m.verified) && (
                  <Empty
                    title="Merchant belum tersedia"
                    description="Merchant yang disetujui admin akan muncul di sini."
                  />
                )}
              </div>
            )}
          </Card>
          <div className="subtle-card">
            <ShieldCheck size={21} color="var(--green)" />
            <h3>Atur dengan jelas. Tumbuh dengan tenang.</h3>
            <p>
              Setiap pembayaran diperiksa oleh smart contract. Penerima hanya bisa memakai dana
              sesuai aturan budget.
            </p>
            <Link
              className="text-link"
              style={{ marginTop: 13, fontSize: 11 }}
              href="/settings#help"
            >
              Kenali cara kerjanya <ArrowRight size={13} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
function ChildManager({ address, saved }: { address?: string; saved: ChildRow[] }) {
  const query = useQueryClient();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <details className="details-panel" style={{ margin: "0 20px" }}>
      <summary>
        <Users size={14} /> Kelola nama penerima
      </summary>
      <p className="section-description">
        Nama disimpan melalui sesi dompet.{" "}
        <Link className="text-link" href="/connect">
          Masuk terlebih dahulu.
        </Link>
      </p>
      {saved.map((child) => (
        <div className="summary-line" key={child.child_wallet}>
          <span>{child.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={`Hapus label ${child.label}`}
            onClick={async () => {
              setBusy(true);
              setSuccess(false);
              try {
                await apiRequest("children", address, "DELETE", {
                  child_wallet: child.child_wallet,
                });
                await query.invalidateQueries({ queryKey: ["children"] });
                setSuccess(true);
                setMessage("Label dihapus. Budget dan hak penerima tetap tercatat di blockchain.");
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Hapus label
          </Button>
        </div>
      ))}
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setSuccess(false);
          const form = new FormData(e.currentTarget);
          try {
            await apiRequest("children", address, "POST", {
              child_wallet: form.get("child"),
              label: form.get("label"),
            });
            await query.invalidateQueries({ queryKey: ["children"] });
            setSuccess(true);
            setMessage("Nama penerima disimpan.");
          } catch (err) {
            setMessage((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nama penerima">
          <Input name="label" required maxLength={80} placeholder="Contoh: Alya" />
        </Field>
        <Field label="Alamat dompet">
          <Input name="child" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" />
        </Field>
        <Button variant="secondary" size="sm" disabled={busy || !address}>
          <Wallet size={14} />
          Simpan penerima
        </Button>
        <Message text={message} success={success} />
      </form>
    </details>
  );
}
