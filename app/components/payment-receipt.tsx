"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";

type ReceiptPayment = {
  id: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string | null;
  description: string | null;
  receiptNumber: string;
  balanceAfterPaise: number;
  feeRecord: {
    totalAmountPaise: number;
    student: {
      name: string;
      registerNo: string;
      email: string;
      phone: string;
      academicYear: string;
      department: { name: string };
    };
    class: { name: string; section: string; academicYear: string } | null;
  };
};

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function PaymentReceipt({ id }: { id: string }) {
  const [payment, setPayment] = useState<ReceiptPayment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/payments/${encodeURIComponent(id)}`)
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load receipt.";
          throw new Error(message);
        }
        if (active) setPayment(result as ReceiptPayment);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load receipt.");
      });
    return () => { active = false; };
  }, [id]);

  if (error) {
    return <div className="receipt-page"><div className="alert alert-error" role="alert">{error}</div><Link className="button button-outline" href="/fees">Back to fees</Link></div>;
  }
  if (!payment) {
    return <div className="loading-panel"><span className="spinner" /> Loading receipt…</div>;
  }

  const student = payment.feeRecord.student;
  const classLabel = payment.feeRecord.class
    ? `${payment.feeRecord.class.name} · ${payment.feeRecord.class.section} (${payment.feeRecord.class.academicYear})`
    : `${student.academicYear} · Class not assigned`;
  const isAdjustment = payment.paymentMethod === "ADJUSTMENT";

  return (
    <div className="receipt-page">
      <div className="receipt-actions no-print">
        <Link className="button button-outline" href="/fees"><Icon name="chevron" size={16} /> Back to Fee Management</Link>
        <button className="button button-primary" onClick={() => window.print()}><Icon name="download" size={16} /> Print receipt</button>
      </div>
      <article className="receipt-card">
        <header className="receipt-header">
          <div className="receipt-brand"><span className="receipt-mark"><Icon name="graduation" size={22} /></span><div><strong>EduManage</strong><small>{isAdjustment ? "STUDENT FEE ADJUSTMENT" : "STUDENT FEE RECEIPT"}</small></div></div>
          <div className="receipt-confirmed"><Icon name="check" size={15} />{isAdjustment ? "Audit adjustment" : "Payment received"}</div>
        </header>
        <div className="receipt-number-row"><span>Receipt number</span><strong>{payment.receiptNumber}</strong></div>
        <div className="receipt-amount"><span>{isAdjustment ? "Adjustment amount" : "Amount paid"}</span><strong>{formatMoney(payment.amountPaise)}</strong></div>
        <div className="receipt-details">
          <div><span>Student name</span><strong>{student.name}</strong></div>
          <div><span>Student ID</span><strong>{student.registerNo}</strong></div>
          <div><span>Email</span><strong>{student.email}</strong></div>
          <div><span>Phone</span><strong>{student.phone || "Not provided"}</strong></div>
          <div><span>Department</span><strong>{student.department.name}</strong></div>
          <div><span>Class / academic year</span><strong>{classLabel}</strong></div>
          <div><span>Payment date</span><strong>{formatDate(payment.paymentDate)}</strong></div>
          <div><span>Payment method</span><strong>{payment.paymentMethod.replaceAll("_", " ")}</strong></div>
          <div><span>Transaction reference</span><strong>{payment.transactionReference || "—"}</strong></div>
          <div><span>Total fee</span><strong>{formatMoney(payment.feeRecord.totalAmountPaise)}</strong></div>
          <div><span>Remaining balance</span><strong>{formatMoney(payment.balanceAfterPaise)}</strong></div>
        </div>
        {payment.description && <p className="receipt-description"><strong>Description:</strong> {payment.description}</p>}
        <footer className="receipt-footer">{isAdjustment ? "This audit adjustment refers to the original payment and does not replace or delete its receipt." : "This receipt confirms that the payment was saved in the EduManage fee ledger."}</footer>
      </article>
    </div>
  );
}
