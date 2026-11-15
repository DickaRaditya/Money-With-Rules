"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CirclePause, Play, ShieldCheck, X } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { useTransaction } from "@/hooks/use-transaction";
import { MerchantRegistryAbi as abi } from "@/generated/MerchantRegistry";
import { addresses } from "@/lib/config";
import { apiRequest } from "@/lib/api-client";
import { categories, shortAddress, wallet } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  WalletButton,
} from "./shared";
import type { Application } from "./merchant-dashboard";

export function AdminDashboard() {
  const { address } = useAccount();
  const chain = useChainData();
  const tx = useTransaction();
  const query = useQueryClient();
  const isAdmin = !!address && address.toLowerCase() === chain.data?.admin.toLowerCase();
  const applications = useQuery({
    queryKey: ["admin-applications", address],
    queryFn: () => apiRequest<{ applications: Application[] }>("admin/applications", address),
    enabled: isAdmin,
    retry: false,
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = (functionName: string, args: readonly unknown[], label: string) =>
    tx.execute({ address: addresses.registry, abi, functionName, args }, label);
  async function review(application: Application, approve: boolean) {
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      if (approve) {
        const existingMask =
          chain.data?.merchants.find((m) => m.address.toLowerCase() === application.wallet)?.mask ||
          0;
        if (
          !(await run(
            "setMerchant",
            [wallet(application.wallet), existingMask | (1 << application.category)],
            "Persetujuan kategori merchant",
          ))
        )
          return;
      }
      await apiRequest("admin/applications", address, "PATCH", {
        wallet: application.wallet,
        action: approve ? "approve" : "reject",
        review_note: approve
          ? "Kategori diverifikasi di blockchain."
          : "Pengajuan belum memenuhi verifikasi. Perbarui informasi usaha.",
      });
      await query.invalidateQueries({ queryKey: ["admin-applications"] });
      await query.invalidateQueries({ queryKey: ["merchant-metadata"] });
      setSuccess(true);
      setMessage(
        approve ? "Persetujuan merchant tersimpan." : "Pengajuan ditandai perlu perbaikan.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRASI REGISTRY"
        title="Kepercayaan dimulai dari verifikasi."
        description="Kelola kategori merchant. Admin tidak memiliki akses untuk membelanjakan saldo vault."
      />
      <DataNotice loading={chain.isLoading} error={chain.error} retry={() => chain.refetch()} />
      {!isAdmin ? (
        <Card>
          <Empty
            title={address ? "Dompet ini bukan admin registry" : "Hubungkan dompet admin"}
            description={`Hak admin dibaca langsung dari kontrak${chain.data ? `: ${shortAddress(chain.data.admin)}` : "."}. Pilihan peran tidak memberikan hak tambahan.`}
            action={<WalletButton />}
          />
        </Card>
      ) : (
        <>
          <div className="notice">
            <ShieldCheck size={20} />
            <span>
              Verifikasi identitas dan kategori usaha di luar aplikasi sebelum menyetujui.
              Persetujuan tidak menjamin barang yang dibeli atau mencegah kolusi.
            </span>
          </div>
          <TransactionStatus state={tx.state} />
          <Message text={message} success={success} />
          <div className="content-grid">
            <div className="stack">
              <section>
                <div className="section-title" style={{ marginTop: 0 }}>
                  <h2>Antrean verifikasi</h2>
                  <Badge>
                    {applications.data?.applications.filter((a) => a.status === "pending").length ||
                      0}{" "}
                    menunggu
                  </Badge>
                </div>
                <Card>
                  {applications.error ? (
                    <Empty
                      title="Masuk untuk membuka antrean"
                      description={(applications.error as Error).message}
                      action={
                        <Button variant="secondary" asChild>
                          <Link href="/connect">Verifikasi sesi admin</Link>
                        </Button>
                      }
                    />
                  ) : applications.data?.applications.some((a) => a.status === "pending") ? (
                    applications.data.applications
                      .filter((a) => a.status === "pending")
                      .map((a) => (
                        <div className="registry-row" key={a.wallet}>
                          <CategoryIcon category={a.category} small />
                          <div>
                            <h4>{a.name}</h4>
                            <p>
                              {a.location} · {categories[a.category]}
                            </p>
                            <p className="mono">{shortAddress(a.wallet)}</p>
                            <p>{a.description}</p>
                          </div>
                          <div className="registry-actions">
                            <Button
                              size="sm"
                              disabled={busy || tx.busy}
                              onClick={() => review(a, true)}
                            >
                              <Check size={13} />
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy || tx.busy}
                              onClick={() => review(a, false)}
                            >
                              <X size={13} />
                              Tolak
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <Empty
                      title="Antrean sudah bersih"
                      description="Pengajuan baru dari merchant akan muncul di sini."
                    />
                  )}
                </Card>
              </section>
              <section>
                <div className="section-title">
                  <h2>Registry merchant</h2>
                  <Badge>ON-CHAIN</Badge>
                </div>
                <Card>
                  {chain.data?.merchants
                    .filter((m) => m.mask > 0)
                    .map((m) => (
                      <div className="registry-row" key={m.address}>
                        <CategoryIcon
                          small
                          category={categories.findIndex((_, i) => !!(m.mask & (1 << i)))}
                        />
                        <div>
                          <h4>
                            {m.name}{" "}
                            {m.suspended && <Badge className="badge-amber">Ditangguhkan</Badge>}
                          </h4>
                          <p>{categories.filter((_, i) => !!(m.mask & (1 << i))).join(", ")}</p>
                          <p className="mono" title={m.address}>
                            {shortAddress(m.address)}
                          </p>
                        </div>
                        <div className="registry-actions">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={tx.busy || busy}
                            onClick={() =>
                              run(
                                "setSuspended",
                                [m.address, !m.suspended],
                                "Perubahan status merchant",
                              )
                            }
                          >
                            {m.suspended ? <Play size={13} /> : <CirclePause size={13} />}
                            {m.suspended ? "Aktifkan" : "Tangguhkan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={tx.busy || busy}
                            onClick={() =>
                              run("revokeMerchant", [m.address], "Pencabutan merchant")
                            }
                          >
                            Cabut izin
                          </Button>
                        </div>
                      </div>
                    ))}
                  {!chain.data?.merchants.some((m) => m.mask > 0) && (
                    <Empty
                      title="Registry belum memiliki merchant"
                      description="Tambahkan merchant melalui formulir atau setujui pengajuan."
                    />
                  )}
                </Card>
              </section>
              <section>
                <div className="section-title">
                  <h2>Aktivitas sistem</h2>
                </div>
                <Card>
                  <ActivityList activities={chain.data?.activities || []} compact />
                </Card>
              </section>
            </div>
            <div className="stack">
              <Card className="card-padding">
                <h3>Kelola kategori merchant</h3>
                <p className="section-description">
                  Masukkan alamat dan pilih seluruh kategori yang ingin dipertahankan. Penyimpanan
                  mengganti daftar kategori; penangguhan tetap berlaku.
                </p>
                <form
                  className="stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setMessage("");
                    const form = new FormData(e.currentTarget);
                    try {
                      const destination = wallet(String(form.get("wallet")));
                      const mask = form
                        .getAll("categories")
                        .reduce<number>((value, item) => value | (1 << Number(item)), 0);
                      if (!mask)
                        throw new Error("Pilih setidaknya satu kategori atau gunakan cabut izin.");
                      await run("setMerchant", [destination, mask], "Pembaruan kategori merchant");
                    } catch (error) {
                      setSuccess(false);
                      setMessage((error as Error).message);
                    }
                  }}
                >
                  <Field label="Alamat dompet merchant">
                    <Input name="wallet" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" />
                  </Field>
                  {categories.map((c, i) => (
                    <label className="checkbox-row" key={c}>
                      <input type="checkbox" name="categories" value={i} />
                      {c}
                    </label>
                  ))}
                  <Button disabled={tx.busy || busy}>Simpan di blockchain</Button>
                </form>
              </Card>
              <Card className="card-padding">
                <h3>Jenis merchant aktif</h3>
                <p className="section-description">
                  Menonaktifkan kategori menolak semua pembayaran untuk jenis tersebut.
                </p>
                {categories.map((c, i) => (
                  <div className="summary-line" key={c}>
                    <span>{c}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={tx.busy || busy}
                      onClick={() =>
                        run(
                          "setCategoryEnabled",
                          [i, !chain.data?.enabledCategories[i]],
                          "Perubahan kategori sistem",
                        )
                      }
                    >
                      {chain.data?.enabledCategories[i] ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
