import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Money With Rules — Uang saku yang punya arah",
    template: "%s | Money With Rules",
  },
  description:
    "Atur uang saku, tetapkan tujuan, dan belajar bertanggung jawab dengan Demo Credits. Aplikasi demonstrasi di jaringan uji.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
