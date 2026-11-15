"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Fingerprint, ShieldCheck } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { useTransaction } from "@/hooks/use-transaction";
import { useProfile } from "./onboarding";
import { addresses, chain, chainId, configured, demoWallets } from "@/lib/config";
import { amount, dcr, wallet } from "@/lib/utils";
import { apiRequest } from "@/lib/api-client";
import { MockTokenAbi as tokenAbi } from "@/generated/MockToken";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Badge,
  Card,
  Field,
  Message,
  PageHeading,
  TransactionStatus,
  WalletButton,
} from "./shared";

const help = [
  [
    "Apa itu Demo Credits (DCR)?",
    "DCR adalah token ERC-20 khusus demonstrasi. DCR tidak memiliki nilai uang nyata, bukan stablecoin, tidak mewakili rupiah, dan tidak dapat ditukar atau ditebus menjadi uang. MVP ini bukan bank atau lembaga pembayaran berizin.",
  ],
  [
    "Aturan apa saja yang diperiksa kontrak?",
    "Kontrak memeriksa identitas penerima, status budget, waktu mulai dan akhir, saldo, kategori merchant, status verifikasi, daftar alamat yang diizinkan, serta batas per transaksi dan harian. Pemeriksaan diulang saat transaksi dieksekusi; melewati tampilan aplikasi tidak dapat melewati aturan kontrak.",
  ],
  [
    "Apakah seluruh saldo dompet ikut dibatasi?",
    "Tidak. Aturan hanya membatasi DCR yang tersimpan di vault Money With Rules. Token di luar vault, dana yang sudah diterima merchant, dan saldo dompet lain tidak dikendalikan aplikasi ini.",
  ],
  [
    "Siapa yang boleh mengubah aturan atau menarik dana?",
    "Hanya pemberi dana budget tersebut. Pemberi dapat menjeda, memperbarui aturan, atau menambah dana. Penarikan hanya boleh saat budget dijeda atau sudah berakhir dan selalu kembali ke dompet pemberi. Realokasi hanya boleh dari budget dijeda ke budget aktif milik pemberi dan penerima yang sama. Penerima dapat melihat perubahan dan penarikan pada riwayat.",
  ],
  [
    "Apakah admin dapat mengambil token pengguna?",
    "Tidak ada fungsi admin untuk menarik atau membelanjakan saldo vault. Admin registry hanya mengelola klasifikasi merchant dan kategori aktif. Pemilik kontrak token dapat mencetak DCR demo dengan batas total suplai. Hak ini tidak memberi akses ke saldo budget.",
  ],
  [
    "Apa batas dari verifikasi merchant?",
    "Verifikasi bergantung pada proses pemeriksaan tepercaya di luar blockchain. Kontrak tidak mengetahui barang yang sebenarnya dibeli, tidak mencegah kolusi merchant atau pengembalian uang tunai di luar aplikasi, dan bukan sistem anti-penipuan yang sempurna. QR aplikasi ini tidak terhubung dengan QRIS atau merchant QRIS yang sudah ada.",
  ],
  [
    "Mengapa transaksi bisa gagal setelah pratinjau berhasil?",
    "Saldo, aturan, waktu, atau status merchant mungkin berubah sebelum transaksi masuk blok. Kontrak memeriksa ulang seluruh kebijakan. Transaksi yang revert tidak memindahkan dana atau menyimpan event pembayaran, tetapi biaya gas jaringan mungkin tetap dikenakan.",
  ],
  [
    "Kapan batas harian direset?",
    "Batas harian memakai hari UTC, dimulai pada pukul 00.00 UTC atau 07.00 WIB. Waktu budget disimpan sebagai detik Unix dan diperiksa menggunakan block.timestamp. Tanggal ditampilkan sesuai zona waktu perangkat. Mengubah aturan atau menjeda budget tidak mereset pengeluaran harian.",
  ],
  [
    "Bagaimana keamanan sesi masuk?",
    "Tanda tangan EIP-4361 terikat domain, jaringan, nonce acak, dan masa berlaku lima menit. Nonce hanya dapat dipakai sekali. Server menyimpan hash token sesi dan memeriksa dompet pada setiap permintaan. Sesi berlaku maksimal delapan jam. Kami tidak meminta, menyimpan, atau menerima seed phrase maupun private key.",
  ],
  [
    "Apa yang disimpan di database?",
    "Supabase menyimpan nama profil, label penerima, informasi usaha, pengajuan verifikasi, sesi, serta catatan percobaan. Saldo, kepemilikan, izin merchant, dan aturan selalu mengacu ke blockchain. Mengubah profil atau memilih tampilan Admin tidak memberikan hak admin.",
  ],
];
export function Settings() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const data = useChainData();
  const profile = useProfile();
  const query = useQueryClient();
  const tx = useTransaction();
  const [message, setMessage] = useState("");
  const tokenOwner = address?.toLowerCase() === data.data?.tokenOwner.toLowerCase() && !!address;
  return (
    <>
      <PageHeading
        title="Kenali dompet. Pahami aturannya."
        description="Informasi akun, jaringan, dan panduan untuk menggunakan Money With Rules."
      />
      <div className="content-grid">
        <div className="stack">
          <Card className="card-padding">
            <div className="row between">
              <h3>Akun & dompet</h3>
              <WalletButton />
            </div>
            <dl className="settings-list">
              <div>
                <dt>Dompet aktif</dt>
                <dd className="mono">{address || "Belum terhubung"}</dd>
              </div>
              <div>
                <dt>Profil tersimpan</dt>
                <dd>{profile.data?.profile?.display_name || "Belum ada profil"}</dd>
              </div>
              <div>
                <dt>Sesi metadata</dt>
                <dd>
                  {profile.data ? "Aktif · maksimal 8 jam" : "Belum masuk dengan tanda tangan"}
                </dd>
              </div>
              <div>
                <dt>Saldo di luar vault</dt>
                <dd>{data.data ? dcr(data.data.walletBalance) : "—"} DCR</dd>
              </div>
              <div>
                <dt>Jaringan yang digunakan</dt>
                <dd>
                  {chain.id === 31337 ? "Hardhat lokal" : chain.name} · ID {chainId}{" "}
                  <Badge>JARINGAN UJI</Badge>
                </dd>
              </div>
            </dl>
            <div className="row gap-3" style={{ marginTop: 20, flexWrap: "wrap" }}>
              <Button variant="secondary" asChild>
                <Link href="/connect">
                  <Fingerprint size={15} />
                  {profile.data ? "Ubah profil" : "Masuk & lengkapi profil"}
                </Link>
              </Button>
              {address && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await apiRequest("auth/logout", address, "POST", {});
                      disconnect();
                      query.clear();
                      setMessage("");
                    } catch (error) {
                      setMessage((error as Error).message);
                    }
                  }}
                >
                  Keluar dari sesi & dompet
                </Button>
              )}
            </div>
            <Message text={message} />
          </Card>
          <Card className="card-padding">
            <h3>Alamat kontrak</h3>
            <p className="section-description">
              Alamat ini menentukan deployment yang dibaca aplikasi.
            </p>
            <dl className="settings-list">
              {Object.entries(addresses).map(([key, value]) => (
                <div key={key}>
                  <dt>
                    {
                      (
                        {
                          token: "Token Demo Credits",
                          registry: "Registry merchant",
                          vault: "Vault budget",
                        } as Record<string, string>
                      )[key]
                    }
                  </dt>
                  <dd className="mono">
                    {configured ? (
                      <>
                        {value}{" "}
                        {chainId === 84532 && (
                          <a
                            href={`https://sepolia.basescan.org/address/${value}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Buka ${key} di explorer`}
                          >
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </>
                    ) : (
                      "Belum dikonfigurasi"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {address && configured && (
              <details className="details-panel">
                <summary>Cabut persetujuan deposit yang tersisa</summary>
                <p className="section-description">
                  Mengatur allowance token untuk vault menjadi nol. Saldo yang sudah didepositkan
                  tidak berubah.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={tx.busy}
                  onClick={() =>
                    tx.execute(
                      {
                        address: addresses.token,
                        abi: tokenAbi,
                        functionName: "approve",
                        args: [addresses.vault, 0n],
                      },
                      "Pencabutan persetujuan",
                    )
                  }
                >
                  Cabut persetujuan DCR
                </Button>
              </details>
            )}
            <TransactionStatus state={tx.state} />
          </Card>
          {tokenOwner && (
            <Card className="card-padding">
              <h3>Cetak token demo</h3>
              <p className="section-description">
                Hanya pemilik kontrak DCR. Total suplai dibatasi 1.000.000 DCR. Token ini tidak
                bernilai uang nyata.
              </p>
              <form
                className="stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    await tx.execute(
                      {
                        address: addresses.token,
                        abi: tokenAbi,
                        functionName: "mint",
                        args: [wallet(String(f.get("to"))), amount(String(f.get("amount")))],
                      },
                      "Pencetakan DCR demo",
                    );
                  } catch (error) {
                    setMessage((error as Error).message);
                  }
                }}
              >
                <Field label="Dompet penerima token">
                  <Input name="to" required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" />
                </Field>
                <Field label="Jumlah DCR">
                  <Input name="amount" required inputMode="decimal" placeholder="1000" />
                </Field>
                <Button disabled={tx.busy}>Cetak DCR demo</Button>
              </form>
            </Card>
          )}
        </div>
        <div className="stack">
          <Card className="card-padding">
            <ShieldCheck size={25} color="var(--green)" />
            <h3 style={{ marginTop: 15 }}>Mulai dalam 5 langkah</h3>
            <ol className="section-description" style={{ paddingLeft: 18, lineHeight: 2.1 }}>
              <li>Hubungkan dompet pemberi yang memiliki DCR.</li>
              <li>Buat budget, setujui token, lalu konfirmasi deposit.</li>
              <li>Ganti ke dompet penerima pada aplikasi dompet Anda.</li>
              <li>Pilih budget dan merchant terverifikasi, lalu periksa aturan.</li>
              <li>Bayar dan lihat bukti pada riwayat atau dashboard merchant.</li>
            </ol>
            <Button variant="secondary" asChild>
              <Link href="/parent">Buka dashboard</Link>
            </Button>
          </Card>
          <Card className="card-padding">
            <h3>Pengaturan lingkungan demo</h3>
            <p className="section-description">
              Panduan lengkap tersedia di README proyek. Jalankan perintah berikut dari folder
              proyek pada terminal terpisah.
            </p>
            <pre className="code-block">
              {
                "npm install\nnpm run compile\nnpm run chain\n# Terminal kedua\nnpm run deploy:local\nnpm run demo\nnpm run dev"
              }
            </pre>
            <p className="section-description">
              Konfigurasikan jaringan lokal dompet ke RPC http://127.0.0.1:8545, ID 31337. Gunakan
              dompet pengujian terpisah. Jangan gunakan dompet yang menyimpan aset nyata.
            </p>
            {Object.keys(demoWallets).length > 0 && (
              <details className="details-panel">
                <summary>Alamat dompet demo lokal</summary>
                <dl className="settings-list">
                  {Object.entries(demoWallets).map(([role, value]) => (
                    <div key={role}>
                      <dt>
                        {
                          (
                            { admin: "Admin", parent: "Pemberi dana", child: "Penerima" } as Record<
                              string,
                              string
                            >
                          )[role]
                        }
                      </dt>
                      <dd className="mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <p className="muted text-xs">
              Supabase memerlukan migrasi SQL, URL proyek, dan kunci server pada lingkungan server.
              Konfigurasi tidak dilakukan melalui kolom di browser.
            </p>
          </Card>
        </div>
      </div>
      <section id="help" style={{ marginTop: 40 }}>
        <PageHeading
          eyebrow="PERTANYAAN YANG SERING DITANYAKAN"
          title="Jelas sejak awal."
          description="Pahami perlindungan dan keterbatasan sebelum menggunakan aplikasi."
        />
        <Card className="card-padding">
          {help.map(([question, answer]) => (
            <details className="help-item" key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </Card>
      </section>
    </>
  );
}
