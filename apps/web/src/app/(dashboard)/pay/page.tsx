import { Suspense } from "react";
import { Payment } from "@/components/payment";
export default function PayPage() {
  return (
    <Suspense fallback={<p role="status">Menyiapkan pembayaran…</p>}>
      <Payment />
    </Suspense>
  );
}
