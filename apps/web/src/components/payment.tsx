"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowUpRight, Check, CheckCircle2, QrCode, ShieldCheck, X } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { useTransaction } from "@/hooks/use-transaction";
import { addresses, chainId, publicClient, configured } from "@/lib/config";
import { amount, categories, dcr, reasons, shortAddress, wallet } from "@/lib/utils";
import { parsePaymentRequest } from "@/lib/qr";
import { MoneyWithRulesVaultAbi as vaultAbi } from "@/generated/MoneyWithRulesVault";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";
import {
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

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
export function Payment() {
  const params = useSearchParams();
  const { address, chainId: walletChain } = useAccount();
  const chain = useChainData();
  const tx = useTransaction();
  const [selected, setSelected] = useState(params.get("budget") || "");
  const [merchant, setMerchant] = useState(params.get("merchant") || "");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ key: string; code: number }>();
  const [checking, setChecking] = useState(false);
  const [qr, setQr] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const budgets =
    chain.data?.budgets.filter((b) => b.beneficiary.toLowerCase() === address?.toLowerCase()) || [];
  const budget =
    budgets.find((b) => b.id.toString() === selected) || (!selected ? budgets[0] : undefined);
  const key = `${address}-${walletChain}-${budget?.id}-${merchant}-${value}`;
  const validPreview = preview?.key === key && preview.code === 0;
  function applyQr(input: string) {
    try {
      const request = parsePaymentRequest(input, chainId, addresses.vault);
      setMerchant(request.merchant);
      setValue(request.amount);
      setMessage("");
      setScanning(false);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        const Constructor = (window as unknown as { BarcodeDetector?: DetectorConstructor })
          .BarcodeDetector;
        if (!Constructor)
          throw new Error(
            "Pemindai kamera belum didukung browser ini. Gunakan Chrome Android atau tempel isi QR.",
          );
        const detector = new Constructor({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        const scan = async () => {
          if (stopped) return;
          try {
            const results =
              video.current && video.current.readyState >= 2
                ? await detector.detect(video.current)
                : [];
            if (results.length) {
              const request = parsePaymentRequest(results[0].rawValue, chainId, addresses.vault);
              if (!stopped) {
                setMerchant(request.merchant);
                setValue(request.amount);
                setMessage("");
                setScanning(false);
              }
              return;
            }
          } catch (error) {
            if (!stopped) {
              setMessage((error as Error).message);
              setScanning(false);
            }
            return;
          }
          timer = setTimeout(scan, 250);
        };
        await scan();
      } catch (error) {
        if (!stopped) {
          setMessage((error as Error).message);
          setScanning(false);
        }
      }
    }
    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning]);
  async function check(pay = false) {
    setMessage("");
    setChecking(true);
    try {
      if (!address || !budget) throw new Error("Pilih budget milik Anda terlebih dahulu.");
      if (walletChain !== chainId) throw new Error("Ganti jaringan dompet terlebih dahulu.");
      const destination = wallet(merchant);
      const quantity = amount(value);
      const code = await publicClient.readContract({
        address: addresses.vault,
        abi: vaultAbi,
        functionName: "checkPayment",
        args: [budget.id, address, destination, quantity],
      });
      setPreview({ key, code });
      if (code !== 0) return;
      if (pay)
        await tx.execute(
          {
            address: addresses.vault,
            abi: vaultAbi,
            functionName: "pay",
            args: [budget.id, destination, quantity],
          },
          "Pembayaran",
          { budgetId: budget.id.toString(), merchant: destination, amount: quantity.toString() },
        );
    } catch (error) {
      setPreview(undefined);
      setMessage((error as Error).message);
    } finally {
      setChecking(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="UNTUK HAL-HAL YANG BERARTI"
        title="Bayar dengan tujuan."
        description="Pilih budget, periksa aturan, lalu konfirmasi melalui dompet."
      />
      <DataNotice error={chain.error} loading={chain.isLoading} retry={() => chain.refetch()} />
      {!address ? (
        <Card>
          <Empty
            title="Dompet penerima, silakan masuk."
            description="Pembayaran hanya dapat dimulai oleh penerima yang tercatat dalam budget."
            action={<WalletButton />}
          />
        </Card>
      ) : !budgets.length && !chain.isLoading ? (
        <Card>
          <Empty
            title="Belum ada budget untuk dibelanjakan"
            description="Minta pemberi dana membuat budget untuk alamat dompet Anda."
            action={
              <Button variant="secondary" asChild>
                <Link href="/child">Lihat ringkasan</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="payment-steps">
            <span className="active">
              <b>1</b>Pilih pembayaran
            </span>
            <span className={validPreview ? "active" : ""}>
              <b>2</b>Periksa aturan
            </span>
            <span className={tx.state.stage === "confirmed" ? "active" : ""}>
              <b>3</b>Konfirmasi dompet
            </span>
          </div>
          <div className="content-grid">
            <Card className="card-padding">
              <div className="stack">
                <Field label="Gunakan budget">
                  <Select
                    value={budget?.id.toString() || ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="" disabled>
                      Pilih budget
                    </option>
                    {budgets.map((b) => (
                      <option key={b.id.toString()} value={b.id.toString()}>
                        {b.name} · {dcr(b.balance)} DCR{b.paused ? " · Dijeda" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <div className="section-title" style={{ marginTop: 4 }}>
                    <h3>Pilih merchant</h3>
                    <Button variant="ghost" size="sm" onClick={() => setScanning(!scanning)}>
                      <QrCode size={16} />
                      {scanning ? "Tutup kamera" : "Pindai QR"}
                    </Button>
                  </div>
                  {scanning && (
                    <div>
                      <video
                        ref={video}
                        className="camera"
                        playsInline
                        muted
                        aria-label="Pemindai QR merchant"
                      />
                      <Button variant="ghost" size="sm" onClick={() => setScanning(false)}>
                        <X size={13} />
                        Tutup kamera
                      </Button>
                    </div>
                  )}
                  <div className="merchant-picker">
                    {chain.data?.merchants
                      .filter((m) => m.verified)
                      .map((m) => (
                        <button
                          type="button"
                          key={m.address}
                          className={`merchant-option ${merchant.toLowerCase() === m.address.toLowerCase() ? "selected" : ""}`}
                          onClick={() => setMerchant(m.address)}
                        >
                          <CategoryIcon
                            small
                            category={categories.findIndex((_, i) => !!(m.mask & (1 << i)))}
                          />
                          <div>
                            <strong>{m.name}</strong>
                            <small>
                              {categories.filter((_, i) => !!(m.mask & (1 << i))).join(" · ")} ·{" "}
                              {shortAddress(m.address)}
                            </small>
                          </div>
                          {merchant.toLowerCase() === m.address.toLowerCase() && (
                            <Check size={17} />
                          )}
                        </button>
                      ))}
                  </div>
                </div>
                <Field
                  label="Alamat dompet merchant"
                  help="Alamat tetap diperiksa oleh registry, meskipun dimasukkan secara manual."
                >
                  <Input
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="0x…"
                  />
                </Field>
                <Field
                  label="Jumlah pembayaran (DCR)"
                  help="Gunakan titik untuk desimal, misalnya 45.5. DCR tidak memiliki nilai uang nyata."
                >
                  <Input
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="45"
                  />
                </Field>
                <details className="details-panel">
                  <summary>Tempel isi QR pembayaran</summary>
                  <div className="stack">
                    <Field label="Data QR Money With Rules">
                      <Textarea
                        value={qr}
                        onChange={(e) => setQr(e.target.value)}
                        placeholder={'{"v":1,"chainId":…}'}
                      />
                    </Field>
                    <Button variant="secondary" size="sm" onClick={() => applyQr(qr)}>
                      Gunakan permintaan pembayaran
                    </Button>
                    <p className="muted text-xs">
                      QR hanya mengisi merchant dan jumlah. Tinjau tujuan dan periksa aturan sebelum
                      membayar.
                    </p>
                  </div>
                </details>
              </div>
            </Card>
            <Card className="card-padding sticky-card">
              <ShieldCheck size={25} color="var(--green)" />
              <h3 style={{ marginTop: 16 }}>Tinjau pembayaran Anda</h3>
              <p className="section-description">
                Token berpindah langsung dari vault ke merchant setelah aturan terpenuhi.
              </p>
              <div className="summary-line">
                <span>Budget</span>
                <strong>{budget?.name || "—"}</strong>
              </div>
              <div className="summary-line">
                <span>Merchant</span>
                <strong>{merchant ? shortAddress(merchant) : "Belum dipilih"}</strong>
              </div>
              <div className="summary-line">
                <span>Saldo tersedia</span>
                <strong>{budget ? dcr(budget.balance) : "—"} DCR</strong>
              </div>
              <div className="summary-line">
                <span>Batas pembayaran</span>
                <strong>{budget ? dcr(budget.rules.maxPerPayment) : "—"} DCR</strong>
              </div>
              <div className="payment-total">
                <span className="text-sm muted">Total bayar</span>
                <strong>
                  {value || "0"} <small>DCR</small>
                </strong>
              </div>
              <Message text={message} />
              {preview?.key === key && (
                <Message
                  success={preview.code === 0}
                  text={reasons[preview.code] || "Pembayaran ditolak."}
                />
              )}
              <div className="stack">
                <Button
                  variant="secondary"
                  disabled={!configured || !budget || checking || tx.busy}
                  onClick={() => check()}
                >
                  <ShieldCheck size={16} />
                  {checking ? "Memeriksa…" : "Periksa aturan di blockchain"}
                </Button>
                <Button disabled={!validPreview || checking || tx.busy} onClick={() => check(true)}>
                  Konfirmasi pembayaran <ArrowUpRight size={16} />
                </Button>
              </div>
              <TransactionStatus state={tx.state} />
              {tx.state.stage === "confirmed" && (
                <Link className="text-link" href="/history">
                  <CheckCircle2 size={15} />
                  Lihat bukti pembayaran
                </Link>
              )}
              <p className="section-description" style={{ marginBottom: 0 }}>
                Pratinjau bukan jaminan: aturan dapat berubah sebelum transaksi diproses. Transaksi
                yang ditolak di blockchain dapat tetap dikenai biaya gas.
              </p>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
