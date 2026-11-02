import { Suspense } from "react";
import PaymentReceipt from "@/app/components/payment-receipt";

type ReceiptRouteProps = { params: Promise<{ id: string }> };

export default function FeeReceiptRoute({ params }: ReceiptRouteProps) {
  return (
    <Suspense fallback={<div className="loading-panel"><span className="spinner" /> Loading receipt…</div>}>
      <ReceiptContent params={params} />
    </Suspense>
  );
}

async function ReceiptContent({ params }: ReceiptRouteProps) {
  const { id } = await params;
  return <PaymentReceipt id={id} />;
}
