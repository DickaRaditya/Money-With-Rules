import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Logo, WalletButton, CategoryIcon, Badge } from "@/components/shared";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <nav>
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#aturan">Kenapa pakai aturan?</a>
          <Link href="/merchants">Merchant</Link>
        </nav>
        <WalletButton />
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span className="status-dot" /> UANG SAKU, SELANGKAH LEBIH BIJAK
            </div>
            <h1>
              Beri kebebasan.
              <br />
              Tetap punya
              <br />
              <span>arah.</span>
              <svg viewBox="0 0 210 18" aria-hidden="true">
                <path d="M3 12 Q90 -4 204 9" />
              </svg>
            </h1>
            <p>
              Uang saku untuk hal yang berarti. Tentukan budget, atur penggunaannya, dan tumbuhkan
              kebiasaan baik—bersama.
            </p>
            <div className="hero-actions">
              <Button asChild>
                <Link href="/parent">
                  Mulai atur budget <ArrowUpRight size={18} />
                </Link>
              </Button>
              <Link className="text-link" href="#cara-kerja">
                Lihat cara kerjanya <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-assurance">
              <span>
                <ShieldCheck size={15} /> Aturan di blockchain
              </span>
              <span>
                <CheckCircle2 size={15} /> Transparan untuk semua
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="art-spark">
              <Sparkles size={27} />
            </div>
            <div className="sample-vault">
              <div className="row between">
                <span className="sample-logo">
                  <Wallet size={18} /> Dompet terencana
                </span>
                <span className="sample-pill">ILUSTRASI DEMO</span>
              </div>
              <p>Setiap tujuan, punya tempat.</p>
              <div className="sample-total">
                2.500<span>DCR</span>
              </div>
              <div className="sample-meta">
                Demo Credits <span>•</span> Tanpa nilai uang nyata
              </div>
              <div className="sample-vault-footer">
                <span>Untuk masa depan yang lebih baik.</span>
                <span className="mini-logo">m.</span>
              </div>
            </div>
            <div className="sample-budgets">
              <div className="row between">
                <h3>Rencana kecil, dampak besar.</h3>
                <span>3 budget</span>
              </div>
              {[
                ["Makan & minum", "1.200", "60%", 0],
                ["Belajar & berkembang", "800", "35%", 1],
                ["Perjalanan harian", "500", "45%", 2],
              ].map(([name, value, width, category]) => (
                <div className="sample-budget" key={name}>
                  <CategoryIcon category={Number(category)} />
                  <div>
                    <div className="row between">
                      <strong>{name}</strong>
                      <span>
                        {value} <small>DCR</small>
                      </span>
                    </div>
                    <div className="progress">
                      <span className={`progress-${category}`} style={{ width: String(width) }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="floating-receipt">
              <span>
                <Check size={19} />
              </span>
              <div>
                <strong>Sesuai aturan. Siap dibayar.</strong>
                <p>Hanya ke merchant yang terverifikasi.</p>
              </div>
            </div>
          </div>
        </section>
        <div className="landing-proof">
          <span>Your Money. Your Rules.</span>
          <div>
            <Fingerprint size={22} />
            <strong>
              Dompet Anda.
              <br />
              <small>Kendali tetap di tangan Anda.</small>
            </strong>
          </div>
          <div>
            <LockKeyhole size={22} />
            <strong>
              Aturan nyata.
              <br />
              <small>Diperiksa oleh smart contract.</small>
            </strong>
          </div>
          <div>
            <ShieldCheck size={22} />
            <strong>
              Belajar tanpa risiko uang nyata.
              <br />
              <small>Eksklusif token demo DCR.</small>
            </strong>
          </div>
        </div>
        <section className="how-section" id="cara-kerja">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SESEDERHANA SATU, DUA, TIGA</span>
              <h2>
                Dari uang saku,
                <br />
                jadi kebiasaan baik.
              </h2>
            </div>
            <p>
              Lebih dari sekadar kirim token.
              <br />
              Beri setiap alokasi sebuah tujuan.
            </p>
          </div>
          <div className="how-grid">
            {[
              [
                "01",
                "Rencanakan bersama",
                "Hubungkan dompet, pilih penerima, lalu bagi Demo Credits untuk makan, belajar, dan perjalanan.",
              ],
              [
                "02",
                "Tentukan batasnya",
                "Atur kategori merchant, masa berlaku, batas per pembayaran, dan batas harian sesuai kebutuhan.",
              ],
              [
                "03",
                "Belanjakan dengan tenang",
                "Penerima membayar merchant yang sesuai. Kontrak memeriksa aturan dan mencatat pembayaran.",
              ],
            ].map(([number, title, description]) => (
              <article key={number}>
                <span className="step-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="aturan" className="rules-section">
          <div>
            <Badge className="badge-green">
              <ShieldCheck size={14} /> ATURAN YANG BEKERJA
            </Badge>
            <h2>
              Kepercayaan itu penting.
              <br />
              Batas yang jelas, juga.
            </h2>
            <p>
              Budget makanan hanya bisa dipakai ke merchant makanan terverifikasi. Pembayaran yang
              melanggar aturan akan ditolak oleh kontrak, bahkan jika aplikasi dilewati.
            </p>
            <Button variant="secondary" asChild>
              <Link href="/settings#help">
                Kenali perlindungan & batasannya <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>
          <div className="rule-preview">
            <div className="row gap-3">
              <CategoryIcon category={0} />
              <div>
                <h3>Budget makan siang</h3>
                <p>Contoh kebijakan budget</p>
              </div>
            </div>
            {[
              "Hanya merchant kategori makanan",
              "Maksimal 150 DCR per pembayaran",
              "Batas harian 250 DCR",
              "Tidak bisa dikirim ke dompet lain",
            ].map((text) => (
              <div className="rule-check" key={text}>
                <Check size={17} />
                {text}
              </div>
            ))}
            <div className="rule-note">
              Verifikasi merchant adalah proses tepercaya. Kontrak tidak dapat memastikan barang apa
              yang dibeli.
            </div>
          </div>
        </section>
        <section className="landing-cta">
          <span className="eyebrow">LANGKAH KECIL DIMULAI DI SINI</span>
          <h2>Beri uang saku sebuah tujuan.</h2>
          <Button asChild>
            <Link href="/connect">
              Hubungkan dompet Anda <ArrowUpRight size={17} />
            </Link>
          </Button>
          <p>Jaringan uji. Token demo. Kesempatan belajar yang nyata.</p>
        </section>
      </main>
      <footer className="landing-footer">
        <Logo />
        <p>
          Demo Credits tidak memiliki nilai uang nyata.
          <br />
          MVP ini bukan bank, layanan pembayaran berizin, atau integrasi QRIS.
        </p>
        <Link href="/settings#help">
          Bantuan <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
