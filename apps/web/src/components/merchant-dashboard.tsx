"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode, ShieldCheck, Store } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { apiRequest } from "@/lib/api-client";
import { addresses, chainId } from "@/lib/config";
import { amount, categories, dcr, shortAddress } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import {
  ActivityList,
  Badge,
  Card,
  DataNotice,
  Empty,
  Field,
  Message,
  PageHeading,
  WalletButton,
} from "./shared";

export type Application = {
  wallet: string;
  name: string;
  category: number;
  location: string;
  description: string;
  status: string;
  review_note?: string;
};
export function MerchantDashboard() {
  const { address } = useAccount();
  const chain = useChainData();
  const query = useQueryClient();
  const application = useQuery({
    queryKey: ["application", address],
    queryFn: () => apiRequest<{ application: Application | null }>("applications", address),
    enabled: !!address,
    retry: false,
  });
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState("");
  const [qr, setQr] = useState<{ wallet: string; payload: string }>();
  const merchant = chain.data?.merchants.find(
    (m) => m.address.toLowerCase() === address?.toLowerCase(),
  );
  const receipts =
    chain.data?.activities.filter(
      (a) =>
        a.event === "PaymentCompleted" &&
        String(a.args.merchant).toLowerCase() === address?.toLowerCase(),
    ) || [];
  const received = receipts.reduce((sum, receipt) => sum + BigInt(String(receipt.args.amount)), 0n);
  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSuccess(false);
    const form = new FormData(e.currentTarget);
    try {
      await apiRequest("applications", address, "POST", {
        name: form.get("name"),
        location: form.get("location"),
        category: Number(form.get("category")),
        description: form.get("description"),
        logo_url: form.get("logo"),
      });
      setSuccess(true);
      setMessage("Pengajuan dikirim. Verifikasi on-chain menunggu keputusan admin.");
      await query.invalidateQueries({ queryKey: ["application"] });
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="RUANG USAHA ANDA"
        title="Transaksi baik, usaha bertumbuh."
        description="Ajukan verifikasi, buat permintaan pembayaran, dan lihat penerimaan DCR."
      />
      <DataNotice error={chain.error} loading={chain.isLoading} retry={() => chain.refetch()} />
      {!address ? (
        <Card>
          <Empty
            title="Hubungkan dompet merchant"
            description="Gunakan dompet yang akan menerima pembayaran."
            action={<WalletButton />}
          />
        </Card>
      ) : (
        <>
          <div className="metric-grid">
            <Card className="metric">
              <span>Status di registry</span>
              <strong style={{ fontSize: 19 }}>
                {merchant?.verified
                  ? "Terverifikasi"
                  : merchant?.suspended
                    ? "Ditangguhkan"
                    : "Belum disetujui"}
              </strong>
            </Card>
            <Card className="metric">
              <span>Total penerimaan vault</span>
              <strong>
                {dcr(received)} <small>DCR</small>
              </strong>
            </Card>
            <Card className="metric">
              <span>Pembayaran berhasil</span>
              <strong>
                {receipts.length} <small>transaksi</small>
              </strong>
            </Card>
          </div>
          <div className="content-grid">
            <div className="stack">
              <Card className="card-padding">
                <div className="row gap-3">
                  <Store size={23} color="var(--green)" />
                  <h3>Profil & verifikasi merchant</h3>
                </div>
                <p className="section-description">
                  Nama dan lokasi disimpan di Supabase. Persetujuan kategori diberikan melalui
                  transaksi admin di blockchain.{" "}
                  <Link className="text-link" href="/connect">
                    Masuk dengan tanda tangan.
                  </Link>
                </p>
                {merchant?.verified && (
                  <div className="notice success">
                    <ShieldCheck size={18} />
                    Kategori disetujui:{" "}
                    {categories.filter((_, i) => !!(merchant.mask & (1 << i))).join(", ")}
                  </div>
                )}
                {application.data?.application && (
                  <div className="notice">
                    <span>
                      Pengajuan:{" "}
                      {
                        (
                          {
                            pending: "Menunggu tinjauan",
                            approved: "Disetujui",
                            rejected: "Perlu diperbaiki",
                          } as Record<string, string>
                        )[application.data.application.status]
                      }
                      {application.data.application.review_note &&
                        ` · ${application.data.application.review_note}`}
                    </span>
                  </div>
                )}
                <form
                  className="stack"
                  onSubmit={apply}
                  key={application.data?.application?.wallet}
                >
                  <Field label="Nama usaha">
                    <Input
                      name="name"
                      required
                      maxLength={100}
                      defaultValue={application.data?.application?.name}
                      placeholder="Contoh: Kantin Nusantara"
                    />
                  </Field>
                  <div className="form-grid">
                    <Field label="Kategori usaha">
                      <Select
                        name="category"
                        defaultValue={application.data?.application?.category ?? 0}
                      >
                        {categories.map((c, i) => (
                          <option key={c} value={i}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Lokasi">
                      <Input
                        name="location"
                        maxLength={200}
                        defaultValue={application.data?.application?.location}
                        placeholder="Contoh: Kampus Anggrek"
                      />
                    </Field>
                  </div>
                  <Field label="Deskripsi usaha">
                    <Textarea
                      name="description"
                      required
                      maxLength={1000}
                      defaultValue={application.data?.application?.description}
                      placeholder="Jelaskan produk atau layanan usaha Anda."
                    />
                  </Field>
                  <Field
                    label="URL logo (opsional)"
                    help="Gunakan URL HTTPS. Logo adalah metadata; tidak menentukan verifikasi."
                  >
                    <Input name="logo" type="url" placeholder="https://…" maxLength={500} />
                  </Field>
                  <Button disabled={busy} variant="secondary">
                    {busy ? "Menyimpan…" : "Kirim pengajuan verifikasi"}
                  </Button>
                </form>
                <Message text={message} success={success} />
              </Card>
              <section>
                <div className="section-title">
                  <h2>Bukti pembayaran masuk</h2>
                  <Badge>TERKONFIRMASI</Badge>
                </div>
                <Card>
                  <ActivityList activities={receipts} />
                </Card>
              </section>
            </div>
            <Card className="card-padding sticky-card">
              <QrCode size={27} color="var(--green)" />
              <h3 style={{ marginTop: 17 }}>Minta pembayaran</h3>
              <p className="section-description">
                QR Money With Rules hanya berisi permintaan pembayaran. Penerima tetap harus memilih
                budget, memeriksa aturan, dan menyetujui transaksi.
              </p>
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    amount(requested);
                    if (!address) return;
                    setQr({
                      wallet: address,
                      payload: JSON.stringify({
                        v: 1,
                        chainId,
                        vault: addresses.vault,
                        merchant: address,
                        amount: requested,
                      }),
                    });
                    setMessage("");
                  } catch (error) {
                    setSuccess(false);
                    setMessage((error as Error).message);
                  }
                }}
              >
                <Field label="Jumlah yang diminta (DCR)">
                  <Input
                    value={requested}
                    onChange={(e) => {
                      setRequested(e.target.value);
                      setQr(undefined);
                    }}
                    inputMode="decimal"
                    placeholder="45"
                    required
                  />
                </Field>
                <Button disabled={!merchant?.verified}>
                  <QrCode size={16} />
                  Buat QR pembayaran
                </Button>
              </form>
              {qr?.wallet === address && (
                <div className="qr-preview" style={{ marginTop: 25 }}>
                  <QRCodeSVG
                    value={qr.payload}
                    size={190}
                    level="M"
                    title="QR permintaan pembayaran Money With Rules"
                  />
                  <strong>{requested} DCR</strong>
                  <p>
                    {shortAddress(address)}
                    <br />
                    Jaringan {chainId} · Bukan QRIS
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(qr.payload);
                        setSuccess(true);
                        setMessage("Isi QR disalin.");
                      } catch {
                        setSuccess(false);
                        setMessage(
                          "Penyalinan tidak tersedia. Salin data QR melalui kolom di bawah.",
                        );
                      }
                    }}
                  >
                    <Copy size={13} />
                    Salin isi QR
                  </Button>
                  <Textarea
                    aria-label="Isi QR untuk disalin"
                    readOnly
                    value={qr.payload}
                    className="mono text-xs"
                  />
                </div>
              )}
              <p className="section-description">
                Jika merchant ditangguhkan, permintaan yang sudah dibuat tidak dapat melewati
                pemeriksaan kontrak.
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
