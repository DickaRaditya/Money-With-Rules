"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { apiRequest } from "@/lib/api-client";
import { dcr, shortAddress } from "@/lib/utils";
import { explorer } from "@/lib/config";
import { ActivityList, Badge, Card, DataNotice, Empty, PageHeading } from "./shared";
import { Input, Select } from "./ui/input";
type Attempt = {
  id: string;
  budget_id: string;
  status: string;
  amount: string;
  tx_hash: string | null;
  reason?: string;
  created_at: string;
};
const attemptNames: Record<string, string> = {
  submitted: "Menunggu konfirmasi",
  confirmed: "Terkonfirmasi",
  reverted: "Ditolak kontrak",
  failed: "Percobaan tidak terkirim",
};
export function History() {
  const { address } = useAccount();
  const chain = useChainData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const attempts = useQuery({
    queryKey: ["attempts", address],
    queryFn: () => apiRequest<{ attempts: Attempt[] }>("attempts", address),
    enabled: !!address,
    retry: false,
    refetchInterval: 30_000,
  });
  const activities = (chain.data?.activities || []).filter(
    (a) =>
      (filter === "all" ||
        filter === "confirmed" ||
        (filter === "payments"
          ? a.event === "PaymentCompleted"
          : filter === "withdrawals"
            ? a.event === "ParentWithdrawal" || a.event === "FundsReallocated"
            : false)) &&
      `${a.args.budgetId || ""} ${a.hash} ${a.args.merchant || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const logs = (attempts.data?.attempts || []).filter(
    (a) =>
      (filter === "all" ||
        (filter === "pending"
          ? a.status === "submitted"
          : filter === "failed"
            ? a.status === "failed" || a.status === "reverted"
            : filter === "confirmed"
              ? a.status === "confirmed"
              : false)) &&
      `${a.budget_id} ${a.tx_hash || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Semua jejak, terlihat jelas."
        description="Bedakan bukti transaksi blockchain dari catatan percobaan aplikasi."
      />
      <DataNotice error={chain.error} loading={chain.isLoading} retry={() => chain.refetch()} />
      <div className="filters">
        <div className="search-field">
          <Search size={17} />
          <Input
            aria-label="Cari ID budget atau hash"
            placeholder="Cari ID budget, merchant, atau hash transaksi…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter aktivitas"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Semua aktivitas</option>
          <option value="payments">Pembayaran berhasil</option>
          <option value="withdrawals">Penarikan & realokasi</option>
          <option value="confirmed">Terkonfirmasi</option>
          <option value="pending">Menunggu konfirmasi</option>
          <option value="failed">Percobaan gagal</option>
        </Select>
      </div>
      <div className="section-title">
        <h2>Catatan blockchain</h2>
        <Badge className="badge-green">SUMBER UTAMA</Badge>
      </div>
      <Card>
        <ActivityList activities={activities} />
      </Card>
      <div className="section-title">
        <h2>Percobaan aplikasi</h2>
        <Badge>METADATA OFF-CHAIN</Badge>
      </div>
      <Card>
        {logs.length ? (
          <div className="table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Budget</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th>Transaksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created_at).toLocaleString("id-ID")}</td>
                    <td>#{a.budget_id}</td>
                    <td>{dcr(BigInt(a.amount))} DCR</td>
                    <td>
                      <Badge className={a.status === "confirmed" ? "badge-green" : ""}>
                        {attemptNames[a.status]}
                      </Badge>
                      {a.reason && <p className="muted text-xs">{a.reason}</p>}
                    </td>
                    <td>
                      {a.tx_hash ? (
                        explorer(a.tx_hash) ? (
                          <a href={explorer(a.tx_hash)} target="_blank" rel="noreferrer">
                            {shortAddress(a.tx_hash)} <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span title={a.tx_hash} className="mono">
                            {shortAddress(a.tx_hash)}
                          </span>
                        )
                      ) : (
                        "Tidak terkirim"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Belum ada catatan percobaan"
            description={
              attempts.error
                ? "Masuk dengan tanda tangan dan hubungkan Supabase untuk menyimpan percobaan aplikasi. Bukti blockchain tetap tersedia di atas."
                : "Catatan percobaan tersedia untuk dompet dan deployment yang sedang digunakan."
            }
          />
        )}
      </Card>
      <div className="subtle-card">
        <h3>Percobaan gagal bukan pembayaran berhasil.</h3>
        <p>
          Transaksi yang revert tidak menyimpan perubahan saldo atau event pembayaran. Catatan
          aplikasi hanya menjelaskan percobaan; status transaksi dengan hash diverifikasi server
          dari receipt blockchain. Menunggu terlalu lama tidak berarti transaksi gagal. Biaya gas
          bisa tetap berlaku saat transaksi revert.
        </p>
      </div>
    </>
  );
}
