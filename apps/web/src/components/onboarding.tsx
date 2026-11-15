"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, GraduationCap, Store, Users, Fingerprint } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { chainId } from "@/lib/config";
import { errorMessage, shortAddress } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, Field, Message, PageHeading, WalletButton } from "./shared";

export type ProfileResponse = {
  wallet: string;
  profile: { display_name: string; role: "parent" | "child" | "merchant" } | null;
};
export function useProfile() {
  const { address } = useAccount();
  return useQuery({
    queryKey: ["profile", address],
    enabled: !!address,
    queryFn: () => apiRequest<ProfileResponse>("profile", address),
    retry: false,
  });
}
export function Onboarding() {
  const { address, chainId: currentChain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<"parent" | "child" | "merchant">("parent");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      if (!address || currentChain !== chainId)
        throw new Error("Hubungkan dompet pada jaringan yang dipilih.");
      const { message: challenge } = await apiRequest<{ message: string }>(
        "auth/nonce",
        address,
        "POST",
        { wallet: address, chainId },
      );
      const signature = await signMessageAsync({ message: challenge });
      await apiRequest("auth/verify", address, "POST", { signature });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setMessage("Dompet berhasil diverifikasi. Lengkapi profil Anda.");
      setSuccess(true);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSuccess(false);
    try {
      await apiRequest("profile", address, "POST", { display_name: name, role });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSuccess(true);
      setMessage("Profil tersimpan. Anda siap memulai.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connect-flow">
      <PageHeading
        eyebrow="SELAMAT DATANG"
        title="Rencana Anda dimulai di sini."
        description="Hubungkan dompet dan perkenalkan diri Anda."
      />
      <Card className="card-padding">
        <div className="row between">
          <div>
            <h3>01 / Hubungkan dompet</h3>
            <p className="section-description" style={{ marginBottom: 0 }}>
              {address
                ? shortAddress(address)
                : "Kami tidak pernah meminta seed phrase atau private key."}
            </p>
          </div>
          <WalletButton />
        </div>
        <div className="divider" />
        <h3>02 / Verifikasi kepemilikan</h3>
        <p className="section-description">
          Tanda tangani pesan sekali pakai untuk menyimpan nama, penerima, dan pengajuan merchant.
          Tanda tangan masuk tidak mengirim token atau memerlukan gas.
        </p>
        {profile.data ? (
          <div className="notice success">
            <CheckCircle2 size={18} />
            Sesi dompet aktif selama maksimal 8 jam.
          </div>
        ) : (
          <Button
            variant="secondary"
            disabled={!address || busy || currentChain !== chainId}
            onClick={signIn}
          >
            <Fingerprint size={16} />
            {busy ? "Menunggu tanda tangan…" : "Masuk dengan tanda tangan"}
          </Button>
        )}
        <div className="divider" />
        <h3>03 / Tentukan peran Anda</h3>
        <p className="section-description">
          Peran hanya mengatur tampilan. Hak akses ditentukan oleh kontrak dan sesi dompet, bukan
          pilihan ini.
        </p>
        <form onSubmit={save}>
          <div className="onboarding-roles">
            {(
              [
                { value: "parent", label: "Pemberi dana", icon: Users },
                { value: "child", label: "Penerima", icon: GraduationCap },
                { value: "merchant", label: "Merchant", icon: Store },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className={`role-card ${role === value ? "active" : ""}`}
                onClick={() => setRole(value)}
                aria-pressed={role === value}
              >
                <Icon size={23} />
                <strong>{label}</strong>
              </button>
            ))}
          </div>
          <Field label="Nama tampilan">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              required
              placeholder={profile.data?.profile?.display_name || "Nama Anda"}
            />
          </Field>
          <div className="form-actions" style={{ marginTop: 25 }}>
            <Button disabled={!profile.data || busy}>
              Simpan profil <ArrowUpRight size={16} />
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/${role}`}>Lanjut ke dashboard</Link>
            </Button>
          </div>
        </form>
        <Message text={message} success={success} />
      </Card>
      <p className="section-description">
        Belum menyiapkan Supabase? Anda tetap dapat menggunakan fungsi blockchain melalui dashboard.
        Penyimpanan profil dan pengajuan merchant memerlukan database yang terhubung.
      </p>
    </div>
  );
}
