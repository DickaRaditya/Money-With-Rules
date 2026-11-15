"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <h1>Ada yang belum berjalan.</h1>
      <p>Muat ulang halaman. Jika ada transaksi terkirim, periksa hash-nya sebelum mencoba lagi.</p>
      <button className="button button-primary" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
