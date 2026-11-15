import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">404</span>
      <h1>Halaman tidak ditemukan.</h1>
      <p>Yuk, kembali ke tempat uang saku punya tujuan.</p>
      <Link className="button button-primary" href="/">
        Kembali ke beranda
      </Link>
    </main>
  );
}
