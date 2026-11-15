"use client";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  Utensils,
  GraduationCap,
  Bus,
  Shapes,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge, Card } from "./ui/card";
import { categories, cn, dcr, shortAddress } from "@/lib/utils";
import { chain, chainId, configured, explorer } from "@/lib/config";
import type { TxState } from "@/hooks/use-transaction";
import type { Activity, Budget } from "@/hooks/use-chain-data";

export const categoryIcons = [Utensils, GraduationCap, Bus, Shapes];
export function CategoryIcon({
  category = 0,
  small = false,
}: {
  category?: number;
  small?: boolean;
}) {
  const Icon = categoryIcons[category] || Shapes;
  return (
    <span className={cn("category-icon", `category-${category}`, small && "small")}>
      <Icon size={small ? 18 : 23} />
    </span>
  );
}
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="Money With Rules, beranda">
      <span className="logo-mark">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span>
          Money<span className="logo-light"> With Rules</span>
        </span>
      )}
    </Link>
  );
}
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain: connectedChain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        if (!mounted || !account)
          return (
            <Button onClick={openConnectModal} size="sm">
              <Wallet size={16} />
              Hubungkan dompet
            </Button>
          );
        if (connectedChain?.unsupported)
          return (
            <Button variant="destructive" size="sm" onClick={openChainModal}>
              Ganti jaringan
            </Button>
          );
        return (
          <Button variant="secondary" size="sm" onClick={openAccountModal}>
            <span className="status-dot" />
            {shortAddress(account.address)}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
export function NetworkNotice() {
  const { isConnected, chainId: current } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!isConnected || current === chainId) return null;
  return (
    <div className="notice warning" role="alert">
      <CircleAlert size={18} />
      <div>
        Dompet Anda berada di jaringan lain. Gunakan {chain.name}.
        {error && <p>Perubahan jaringan dibatalkan. Coba lagi melalui dompet.</p>}
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() => switchChain({ chainId })}
      >
        Ganti jaringan
      </Button>
    </div>
  );
}
export function DataNotice({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (!configured)
    return (
      <div className="notice">
        <ShieldCheck size={20} />
        <div>
          <strong>Vault belum dihubungkan</strong>
          <p>Siapkan kontrak di jaringan uji untuk mulai menggunakan budget.</p>
        </div>
        <Link href="/settings" className="text-link">
          Panduan pengaturan <ArrowUpRight size={15} />
        </Link>
      </div>
    );
  if (error)
    return (
      <div className="notice warning" role="alert">
        <CircleAlert size={20} />
        <div>
          <strong>Data blockchain belum tersedia</strong>
          <p>Periksa koneksi RPC dan pastikan kontrak sudah dideploy di jaringan yang dipilih.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={retry}>
          Coba lagi
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="notice" role="status">
        <Loader2 size={18} className="spin" />
        Membaca data langsung dari blockchain…
      </div>
    );
  return null;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Wallet size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
export function Message({ text, success = false }: { text?: string; success?: boolean }) {
  return text ? (
    <div
      role={success ? "status" : "alert"}
      className={cn("notice", success ? "success" : "warning")}
    >
      {success ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}
      <span>{text}</span>
    </div>
  ) : null;
}
export function TransactionStatus({ state }: { state: TxState }) {
  if (state.stage === "idle") return null;
  const busy = ["checking", "signature", "submitted"].includes(state.stage);
  const href = state.hash ? explorer(state.hash) : undefined;
  return (
    <div
      className={cn(
        "notice tx-status",
        state.stage === "failed" && "warning",
        state.stage === "confirmed" && "success",
      )}
      role="status"
      aria-live="polite"
    >
      {busy ? (
        <Loader2 size={20} className="spin" />
      ) : state.stage === "confirmed" ? (
        <CheckCircle2 size={20} />
      ) : (
        <CircleAlert size={20} />
      )}
      <div>
        <strong>{state.message}</strong>
        {state.hash && (
          <p className="mono break-all">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer">
                {shortAddress(state.hash)} <ExternalLink size={12} />
              </a>
            ) : (
              `Hash lokal: ${state.hash}`
            )}
          </p>
        )}
      </div>
    </div>
  );
}
export function BudgetCard({ budget, timestamp }: { budget: Budget; timestamp: bigint }) {
  const basis = budget.totalFunded + budget.movedIn;
  const used = basis ? Number((budget.totalSpent * 100n) / basis) : 0;
  const status = budget.paused
    ? "Dijeda"
    : timestamp > budget.rules.endsAt
      ? "Berakhir"
      : timestamp < budget.rules.startsAt
        ? "Terjadwal"
        : "Aktif";
  return (
    <Link href={`/budgets/${budget.id}`} className="budget-card card">
      <div className="row between">
        <CategoryIcon category={budget.rules.category} />
        <Badge className={status === "Aktif" ? "badge-green" : ""}>
          {status === "Aktif" && <span className="status-dot" />}
          {status}
        </Badge>
      </div>
      <h3>{budget.name}</h3>
      <p className="muted text-sm">
        {categories[budget.rules.category]} <span className="dot-separator">•</span>{" "}
        {shortAddress(budget.beneficiary)}
      </p>
      <div className="budget-amount">
        {dcr(budget.balance)} <span>DCR</span>
      </div>
      <div className="progress">
        <span
          className={`progress-${budget.rules.category}`}
          style={{ width: `${Math.min(100, used)}%` }}
        />
      </div>
      <div className="row between text-xs muted">
        <span>{used}% terpakai</span>
        <span>
          Lihat aturan <ArrowUpRight size={13} />
        </span>
      </div>
    </Link>
  );
}
const eventNames: Record<string, string> = {
  BudgetCreated: "Budget dibuat",
  PaymentCompleted: "Pembayaran berhasil",
  BudgetFunded: "Saldo ditambahkan",
  ParentWithdrawal: "Dana ditarik pemberi",
  FundsReallocated: "Dana dialokasikan ulang",
  BudgetPaused: "Status jeda diperbarui",
  RulesUpdated: "Aturan diperbarui",
  WhitelistModeUpdated: "Mode daftar izin diubah",
  MerchantWhitelistUpdated: "Daftar merchant diubah",
};
export function ActivityList({
  activities,
  compact = false,
}: {
  activities: Activity[];
  compact?: boolean;
}) {
  if (!activities.length)
    return (
      <Empty
        title="Belum ada aktivitas"
        description="Aktivitas yang telah dikonfirmasi akan muncul di sini."
      />
    );
  return (
    <div className="activity-list">
      {activities.slice(0, compact ? 5 : undefined).map((a) => (
        <div className="activity-row" key={a.key}>
          <span className={cn("activity-icon", a.event === "PaymentCompleted" && "is-payment")}>
            {a.event === "PaymentCompleted" ? (
              <ArrowUpRight size={19} />
            ) : (
              <ShieldCheck size={18} />
            )}
          </span>
          <div className="activity-description">
            <strong>{eventNames[a.event] || a.event}</strong>
            <p>
              {a.args.budgetId ? `Budget #${a.args.budgetId}` : "Perubahan alokasi"}{" "}
              <span className="dot-separator">•</span> Blok {a.block.toString()}
              {a.args.paymentId ? ` • Bukti #${a.args.paymentId}` : ""}
            </p>
          </div>
          <div className="activity-right">
            {typeof a.args.amount === "bigint" && (
              <strong>
                {a.event === "PaymentCompleted" || a.event === "ParentWithdrawal" ? "−" : "+"}
                {dcr(a.args.amount)} <small>DCR</small>
              </strong>
            )}
            <span className="confirmed">
              <Check size={12} />
              Terkonfirmasi
            </span>
          </div>
          {explorer(a.hash) && (
            <a
              aria-label="Lihat transaksi di explorer"
              href={explorer(a.hash)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
export function DemoDisclaimer() {
  return (
    <div className="demo-disclaimer">
      <ShieldCheck size={17} />
      <span>
        <strong>Ruang aman untuk belajar.</strong> Demo Credits (DCR) adalah token uji tanpa nilai
        uang nyata.
      </span>
    </div>
  );
}
export { Card, Badge };
