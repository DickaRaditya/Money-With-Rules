"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  CircleHelp,
  LayoutDashboard,
  Store,
  ArrowLeftRight,
  Settings2,
  Moon,
  Sun,
  Menu,
  X,
  Plus,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Logo, WalletButton, NetworkNotice, DemoDisclaimer } from "./shared";
import { cn } from "@/lib/utils";
import { chain } from "@/lib/config";
import { Button } from "./ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const role =
    path.startsWith("/child") || path.startsWith("/pay")
      ? "child"
      : path.startsWith("/merchant/") || path === "/merchant"
        ? "merchant"
        : path.startsWith("/admin")
          ? "admin"
          : "parent";
  const links = [
    { href: `/${role}`, icon: LayoutDashboard, label: "Ringkasan" },
    {
      href: role === "child" ? "/pay" : "/budgets/new",
      icon: role === "child" ? ArrowUpRight : Plus,
      label: role === "child" ? "Bayar merchant" : "Buat budget",
    },
    { href: "/merchants", icon: Store, label: "Jelajahi merchant" },
    { href: "/history", icon: ArrowLeftRight, label: "Riwayat aktivitas" },
  ];
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Langsung ke konten
      </a>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Tutup navigasi"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("sidebar", open && "sidebar-open")}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="mobile-only icon-button"
            onClick={() => setOpen(false)}
            aria-label="Tutup navigasi"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-avatar">MW</span>
          <div>
            <strong>Ruang keluarga</strong>
            <span>Uang saku, penuh tujuan.</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">RUANG ANDA</p>
        <nav aria-label="Navigasi utama">
          {links.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn("nav-link", path === href && "active")}
            >
              <Icon size={19} />
              {label}
              {path === href && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <ShieldCheck size={21} />
            </span>
            <h4>
              Sedikit aturan.
              <br />
              Banyak ketenangan.
            </h4>
            <p>Kenali cara kerja budget yang terlindungi smart contract.</p>
            <Link href="/settings#help">
              Pelajari caranya <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link href="/settings" className={cn("nav-link", path === "/settings" && "active")}>
            <Settings2 size={18} />
            Pengaturan & bantuan
          </Link>
          <div className="network-line">
            <span className="status-dot" />
            <span>{chain.id === 31337 ? "Hardhat lokal" : "Base Sepolia"}</span>
            <span>Jaringan uji</span>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="row gap-3">
            <button
              className="icon-button mobile-only"
              aria-label="Buka navigasi"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="topbar-breadcrumb">
              Ruang keluarga <span>/</span>{" "}
              <strong>
                {path === "/merchants"
                  ? "Merchant"
                  : path === "/history"
                    ? "Aktivitas"
                    : path === "/settings"
                      ? "Pengaturan"
                      : "Dompet terencana"}
              </strong>
            </span>
          </div>
          <div className="row gap-3">
            <Link className="icon-button desktop-only" href="/settings#help" aria-label="Bantuan">
              <CircleHelp size={19} />
            </Link>
            <button
              className="icon-button"
              aria-label="Ganti tema terang atau gelap"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun size={19} className="theme-sun" />
              <Moon size={19} className="theme-moon" />
            </button>
            <WalletButton />
          </div>
        </header>
        <main id="main" className="app-main">
          <div className="role-bar">
            <span>
              <span className="status-dot" /> ATUR DENGAN TUJUAN
            </span>
            <label>
              Tampilan{" "}
              <select
                aria-label="Pilih tampilan peran"
                value={role}
                onChange={(e) => router.push(`/${e.target.value}`)}
              >
                <option value="parent">Pemberi dana</option>
                <option value="child">Penerima</option>
                <option value="merchant">Merchant</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <NetworkNotice />
          {children}
          <DemoDisclaimer />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Money With Rules</span>
          <span>Your Money. Your Rules.</span>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings#help">
              Tentang demo <ArrowUpRight size={13} />
            </Link>
          </Button>
        </footer>
      </div>
    </div>
  );
}
