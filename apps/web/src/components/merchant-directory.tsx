"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { useChainData } from "@/hooks/use-chain-data";
import { apiRequest } from "@/lib/api-client";
import { categories, shortAddress } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { Badge, Card, CategoryIcon, DataNotice, Empty, PageHeading } from "./shared";
export type MerchantMetadata = {
  wallet: string;
  name: string;
  location: string;
  logo_url?: string;
};
export function useMerchantMetadata() {
  return useQuery({
    queryKey: ["merchant-metadata"],
    queryFn: () => apiRequest<{ merchants: MerchantMetadata[] }>("merchants"),
    retry: false,
    staleTime: 60_000,
  });
}
export function MerchantDirectory() {
  const { data, isLoading, error, refetch } = useChainData();
  const metadata = useMerchantMetadata();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const merchants =
    data?.merchants
      .filter((m) => m.verified)
      .map((m) => ({
        ...m,
        ...metadata.data?.merchants.find(
          (meta) => meta.wallet.toLowerCase() === m.address.toLowerCase(),
        ),
      }))
      .filter(
        (m) =>
          (category === "all" ||
            (!!(m.mask & (1 << Number(category))) && data!.enabledCategories[Number(category)])) &&
          `${m.name} ${m.address} ${m.location}`.toLowerCase().includes(search.toLowerCase()),
      ) || [];
  return (
    <>
      <PageHeading
        eyebrow="PILIHAN YANG SESUAI TUJUAN"
        title="Temukan merchant Anda."
        description="Status verifikasi dibaca dari blockchain. Aturan setiap budget tetap berlaku."
        action={
          <Button asChild variant="secondary">
            <Link href="/merchant">
              Daftarkan usaha <ArrowUpRight size={15} />
            </Link>
          </Button>
        }
      />
      <DataNotice loading={isLoading} error={error} retry={() => refetch()} />
      <div className="filters">
        <div className="search-field">
          <Search size={17} />
          <Input
            aria-label="Cari merchant"
            placeholder="Cari nama, lokasi, atau alamat dompet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          aria-label="Filter kategori merchant"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Semua kategori</option>
          {categories.map((c, i) => (
            <option key={c} value={i}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      {merchants.length ? (
        <div className="merchant-grid">
          {merchants.map((m) => (
            <Card className="merchant-card" key={m.address}>
              <div className="row between">
                <CategoryIcon category={categories.findIndex((_, i) => !!(m.mask & (1 << i)))} />
                <Badge className="badge-green">
                  <ShieldCheck size={12} />
                  Terverifikasi
                </Badge>
              </div>
              <h3>{m.name}</h3>
              <p>{m.location || "Lokasi belum ditambahkan"}</p>
              <div className="tags">
                {categories.map(
                  (c, i) =>
                    !!(m.mask & (1 << i)) && (
                      <Badge key={c}>
                        {c}
                        {!data!.enabledCategories[i] ? " · Dijeda" : ""}
                      </Badge>
                    ),
                )}
              </div>
              <p className="mono" title={m.address}>
                {shortAddress(m.address)}
              </p>
              <Button variant="secondary" asChild>
                <Link href={`/pay?merchant=${m.address}`}>
                  Pilih merchant <ArrowUpRight size={14} />
                </Link>
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title={
              search || category !== "all"
                ? "Belum ada hasil yang cocok"
                : "Merchant terverifikasi akan muncul di sini"
            }
            description="Coba kategori lain atau tunggu verifikasi merchant oleh admin."
          />
        </Card>
      )}
      <div className="subtle-card">
        <h3>Verifikasi kategori, bukan verifikasi isi keranjang.</h3>
        <p>
          Smart contract memeriksa alamat dan kategori merchant. Barang yang dibeli, kolusi
          merchant, dan pengembalian tunai di luar aplikasi tetap memerlukan pengawasan di dunia
          nyata. Pembayaran ini tidak menggunakan QRIS.
        </p>
      </div>
    </>
  );
}
