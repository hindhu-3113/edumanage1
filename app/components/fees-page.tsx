"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/components/icons";
import ExportActions from "@/app/components/export-actions";
import { useCurrentRole } from "@/lib/use-current-role";

type Department = { name: string };
type Student = {
  id: string;
  name: string;
  registerNo: string;
  academicYear: string;
  department: Department;
};
type ClassRecord = { id: string; name: string; academicYear: string; section: string };
type FeeStatus = "PAID" | "PARTIALLY_PAID" | "PENDING";
type FeeRecord = {
  id: string;
  totalAmountPaise: number;
  amountPaidPaise: number;
  dueDate: string;
  isSample: boolean;
  status: FeeStatus;
  student: Student;
  class: ClassRecord | null;
};
type FeeDashboard = {
  totalExpectedPaise: number;
  totalCollectedPaise: number;
  totalPendingPaise: number;
  fullyPaidStudents: number;
  partiallyPaidStudents: number;
  pendingStudents: number;
};
type FeeResponse = {
  fees: FeeRecord[];
  payableFees: FeeRecord[];
  feeStudentIds: string[];
  dashboard: FeeDashboard;
};
type Payment = {
  id: string;
  amountPaise: number;
  paymentDate: string;
  paymentMethod: string;
  transactionReference: string | null;
  description: string | null;
  receiptNumber: string;
  statusAfter: FeeStatus;
  feeRecord: {
    isSample: boolean;
    student: Student;
    class: ClassRecord | null;
  };
};
type PaymentFilters = { search: string; from: string; to: string; status: string };

const emptyDashboard: FeeDashboard = {
  totalExpectedPaise: 0,
  totalCollectedPaise: 0,
  totalPendingPaise: 0,
  fullyPaidStudents: 0,
  partiallyPaidStudents: 0,
  pendingStudents: 0,
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function futureDateString(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

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
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

async function readJson(response: Response, fallback: string): Promise<unknown> {
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      value && typeof value === "object" && "error" in value && typeof value.error === "string"
        ? value.error
        : fallback;
    throw new Error(message);
  }
  return value;
}

function statusLabel(status: FeeStatus) {
  if (status === "PAID") return "Paid";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  return "Pending";
}

export default function FeesPage() {
  const { isAdmin } = useCurrentRole();
  const router = useRouter();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [payableFees, setPayableFees] = useState<FeeRecord[]>([]);
  const [feeStudentIds, setFeeStudentIds] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [feeSearch, setFeeSearch] = useState("");
  const [feeStatus, setFeeStatus] = useState("");
  const [paymentFilters, setPaymentFilters] = useState<PaymentFilters>({
    search: "",
    from: "",
    to: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeRecord | null>(null);
  const [correctingPayment, setCorrectingPayment] = useState<Payment | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [feeForm, setFeeForm] = useState({
    studentId: "",
    classId: "",
    totalAmount: "",
    dueDate: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    feeRecordId: "",
    amount: "",
    paymentDate: "",
    paymentMethod: "UPI",
    transactionReference: "",
    description: "",
    idempotencyKey: "",
  });

  const loadFees = useCallback(async () => {
    const params = new URLSearchParams();
    if (feeSearch.trim()) params.set("search", feeSearch.trim());
    if (feeStatus) params.set("status", feeStatus);
    const response = await fetch(`/api/fees?${params}`);
    const result = await readJson(response, "Could not load fee records.");
    if (!result || typeof result !== "object" || !("fees" in result) || !("dashboard" in result) || !("payableFees" in result) || !("feeStudentIds" in result)) {
      throw new Error("The fee list response was invalid.");
    }
    return result as FeeResponse;
  }, [feeSearch, feeStatus]);

  const loadPayments = useCallback(async () => {
    const params = new URLSearchParams();
    if (paymentFilters.search.trim()) params.set("search", paymentFilters.search.trim());
    if (paymentFilters.from) params.set("from", paymentFilters.from);
    if (paymentFilters.to) params.set("to", paymentFilters.to);
    if (paymentFilters.status) params.set("status", paymentFilters.status);
    const response = await fetch(`/api/payments?${params}`);
    const result = await readJson(response, "Could not load payment history.");
    if (!Array.isArray(result)) throw new Error("The payment history response was invalid.");
    return result as Payment[];
  }, [paymentFilters]);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [feeResult, paymentResult] = await Promise.all([loadFees(), loadPayments()]);
      setFees(feeResult.fees);
      setPayableFees(feeResult.payableFees);
      setFeeStudentIds(feeResult.feeStudentIds);
      setDashboard(feeResult.dashboard);
      setPayments(paymentResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh fee information.");
    }
  }, [loadFees, loadPayments]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/students").then((response) => readJson(response, "Could not load students.")),
      fetch("/api/classes").then((response) => readJson(response, "Could not load classes.")),
    ])
      .then(([studentResult, classResult]) => {
        if (!Array.isArray(studentResult) || !Array.isArray(classResult)) {
          throw new Error("Student or class list response was invalid.");
        }
        if (active) {
          setStudents(studentResult as Student[]);
          setClasses(classResult as ClassRecord[]);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load fee information.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setPaymentsLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    loadFees()
      .then((result) => {
        if (active) {
          setFees(result.fees);
          setPayableFees(result.payableFees);
          setFeeStudentIds(result.feeStudentIds);
          setDashboard(result.dashboard);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load fee records.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadFees]);

  useEffect(() => {
    let active = true;
    loadPayments()
      .then((result) => {
        if (active) {
          setPayments(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load payment history.");
      })
      .finally(() => { if (active) setPaymentsLoading(false); });
    return () => { active = false; };
  }, [loadPayments]);

  const studentsWithoutFees = useMemo(() => {
    const feeIds = new Set(feeStudentIds);
    return students.filter((student) => !feeIds.has(student.id));
  }, [feeStudentIds, students]);

  const feesWithBalance = useMemo(
    () => payableFees.filter((fee) => fee.totalAmountPaise > fee.amountPaidPaise),
    [payableFees],
  );

  function updatePaymentFilters(update: Partial<PaymentFilters>) {
    setPaymentsLoading(true);
    setPaymentFilters((current) => ({ ...current, ...update }));
  }

  function openFeeForm(fee?: FeeRecord) {
    setFormError("");
    setEditingFee(fee ?? null);
    setFeeForm({
      studentId: fee?.student.id ?? studentsWithoutFees[0]?.id ?? "",
      classId: fee?.class?.id ?? "",
      totalAmount: fee ? (fee.totalAmountPaise / 100).toFixed(2) : "",
      dueDate: fee ? dateInputValue(fee.dueDate) : futureDateString(30),
    });
    setFeeModalOpen(true);
  }

  function openPaymentForm() {
    const fee = feesWithBalance[0];
    if (!fee) return;
    setFormError("");
    setPaymentForm({
      feeRecordId: fee.id,
      amount: "",
      paymentDate: todayString(),
      paymentMethod: "UPI",
      transactionReference: "",
      description: "",
      idempotencyKey: window.crypto.randomUUID(),
    });
    setPaymentModalOpen(true);
  }

  async function submitFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editingFee ? `/api/fees/${editingFee.id}` : "/api/fees", {
        method: editingFee ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feeForm),
      });
      await readJson(response, editingFee ? "Could not update fee record." : "Could not create fee record.");
      setFeeModalOpen(false);
      setEditingFee(null);
      setToast(editingFee ? "Fee record updated successfully." : "Fee record saved successfully.");
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not create fee record.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFee(fee: FeeRecord) {
    if (!window.confirm(`Delete the fee record for ${fee.student.name}? Records with payment history cannot be deleted.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/fees/${fee.id}`, { method: "DELETE" });
      await readJson(response, "Could not delete fee record.");
      setToast("Fee record deleted successfully.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete fee record.");
    }
  }

  function openPaymentCorrection(payment: Payment) {
    setCorrectingPayment(payment);
    setCorrectedAmount((payment.amountPaise / 100).toFixed(2));
    setCorrectionReason("");
    setFormError("");
  }

  async function submitPaymentCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctingPayment) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(`/api/payments/${correctingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctedAmount, reason: correctionReason }),
      });
      await readJson(response, "Could not correct payment.");
      setCorrectingPayment(null);
      setToast("Payment correction recorded in the audit history.");
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not correct payment.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const payment = await readJson(response, "Could not record payment.") as Payment;
      setPaymentModalOpen(false);
      setToast("Payment saved. Receipt generated.");
      await refresh();
      router.push(`/fees/receipt/${payment.id}`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  const selectedFee = feesWithBalance.find((fee) => fee.id === paymentForm.feeRecordId);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> FINANCE</div>
          <h1>Fee Management</h1>
          <p>Track fee collections, outstanding balances, and student payment history.</p>
        </div>
        <div className="fee-heading-actions">
          {isAdmin && <button className="button button-outline" onClick={() => openFeeForm()} disabled={!studentsWithoutFees.length}>
            <Icon name="plus" size={17} /> Add fee record
          </button>}
          {isAdmin && (
            <button className="button button-primary" onClick={openPaymentForm} disabled={!feesWithBalance.length}>
              <Icon name="plus" size={17} /> Record payment
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast-message" role="status">
          <Icon name="check" size={17} />{toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button>
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="fee-summary-grid" aria-label="Fee dashboard">
        <FeeStat title="Total fees expected" amount={formatMoney(dashboard.totalExpectedPaise)} detail={`${dashboard.fullyPaidStudents + dashboard.partiallyPaidStudents + dashboard.pendingStudents} fee records`} />
        <FeeStat title="Amount collected" amount={formatMoney(dashboard.totalCollectedPaise)} detail="Payments recorded to date" />
        <FeeStat title="Pending balance" amount={formatMoney(dashboard.totalPendingPaise)} detail="Outstanding across all fee records" />
        <FeeStat title="Fully paid students" amount={String(dashboard.fullyPaidStudents)} detail="Fee balance cleared" />
        <FeeStat title="Partially paid" amount={String(dashboard.partiallyPaidStudents)} detail="Payment received, balance due" />
        <FeeStat title="Pending fees" amount={String(dashboard.pendingStudents)} detail="No payment recorded" />
      </section>

      <section className="panel fee-panel">
        <div className="student-toolbar">
          <div className="directory-title">
            <div><h2>Student fee records</h2><p>Balances, due dates, and current payment status</p></div>
          </div>
          <div className="toolbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input value={feeSearch} onChange={(event) => { setLoading(true); setFeeSearch(event.target.value); }} placeholder="Search student or ID…" aria-label="Search fee records by student name or ID" />
            </label>
            <label className="select-filter" aria-label="Filter fee records by status">
              <Icon name="filter" size={17} />
              <select value={feeStatus} onChange={(event) => { setLoading(true); setFeeStatus(event.target.value); }}>
                <option value="">All statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </label>
            <ExportActions report="fees" filters={{ search: feeSearch.trim(), status: feeStatus }} />
          </div>
        </div>
        {loading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading fee records…</div>
        ) : fees.length ? (
          <div className="table-scroll">
            <table className="data-table fee-table">
              <thead><tr><th>STUDENT</th><th>CLASS</th><th>TOTAL FEE</th><th>PAID</th><th>BALANCE</th><th>DUE DATE</th><th>STATUS</th>{isAdmin && <th>ACTIONS</th>}</tr></thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id}>
                    <td>
                      <div className="fee-student">
                        <strong>{fee.student.name}</strong>
                        <span>{fee.student.registerNo} · {fee.student.department.name}</span>
                        {fee.isSample && <span className="sample-chip">Sample / test</span>}
                      </div>
                    </td>
                    <td>{fee.class ? `${fee.class.name} · ${fee.class.section}` : <span className="muted-cell">Unassigned</span>}<small className="fee-academic-year">{fee.student.academicYear}</small></td>
                    <td>{formatMoney(fee.totalAmountPaise)}</td>
                    <td>{formatMoney(fee.amountPaidPaise)}</td>
                    <td className={fee.totalAmountPaise > fee.amountPaidPaise ? "fee-balance-due" : "fee-balance-clear"}>{formatMoney(fee.totalAmountPaise - fee.amountPaidPaise)}</td>
                    <td>{formatDate(fee.dueDate)}</td>
                    <td><span className={`fee-status fee-status-${fee.status.toLowerCase()}`}>{statusLabel(fee.status)}</span></td>
                    {isAdmin && <td><div className="row-actions"><button className="icon-button" aria-label={`Edit fee for ${fee.student.name}`} onClick={() => openFeeForm(fee)}><Icon name="edit" size={16} /></button><button className="icon-button icon-danger" aria-label={`Delete fee for ${fee.student.name}`} onClick={() => void deleteFee(fee)}><Icon name="trash" size={16} /></button></div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="building" /></span>
            <strong>{feeSearch || feeStatus ? "No matching fee records" : "No fee records yet"}</strong>
            <p>{feeSearch || feeStatus ? "Try changing the search or status filter." : "Create a fee record for a student to start tracking payments."}</p>
            {!feeSearch && !feeStatus && isAdmin && studentsWithoutFees.length > 0 && <button className="button button-primary button-small" onClick={() => openFeeForm()}><Icon name="plus" size={16} /> Add fee record</button>}
          </div>
        )}
      </section>

      <section className="panel fee-panel fee-history-panel">
        <div className="student-toolbar">
          <div className="directory-title">
            <div><h2>Payment history</h2><p>Recorded payments with receipt references and resulting fee status</p></div>
          </div>
          <div className="toolbar-actions fee-history-filters">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input value={paymentFilters.search} onChange={(event) => updatePaymentFilters({ search: event.target.value })} placeholder="Student, ID, or receipt…" aria-label="Search payment history" />
            </label>
            <label className="fee-date-filter"><span className="sr-only">Payments from date</span><input type="date" value={paymentFilters.from} onChange={(event) => updatePaymentFilters({ from: event.target.value })} /></label>
            <label className="fee-date-filter"><span className="sr-only">Payments to date</span><input type="date" value={paymentFilters.to} onChange={(event) => updatePaymentFilters({ to: event.target.value })} /></label>
            <label className="select-filter" aria-label="Filter payment status">
              <Icon name="filter" size={17} />
              <select value={paymentFilters.status} onChange={(event) => updatePaymentFilters({ status: event.target.value })}>
                <option value="">All statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </label>
            <ExportActions report="fees" filters={{
              view: "payments",
              search: paymentFilters.search.trim(),
              from: paymentFilters.from,
              to: paymentFilters.to,
              status: paymentFilters.status,
            }} />
          </div>
        </div>
        {paymentsLoading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading payment history…</div>
        ) : payments.length ? (
          <div className="table-scroll">
            <table className="data-table fee-table payment-table">
              <thead><tr><th>STUDENT</th><th>AMOUNT</th><th>PAYMENT DATE</th><th>METHOD</th><th>REFERENCE / RECEIPT</th><th>STATUS AFTER PAYMENT</th><th aria-label="Actions"></th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <div className="fee-student">
                        <strong>{payment.feeRecord.student.name}</strong>
                        <span>{payment.feeRecord.student.registerNo}</span>
                        {payment.feeRecord.isSample && <span className="sample-chip">Sample / test</span>}
                      </div>
                    </td>
                    <td className="fee-payment-amount">{formatMoney(payment.amountPaise)}</td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>{payment.paymentMethod.replaceAll("_", " ")}</td>
                    <td><div className="fee-reference">{payment.transactionReference || "—"}<small>{payment.receiptNumber}</small></div></td>
                    <td><span className={`fee-status fee-status-${payment.statusAfter.toLowerCase()}`}>{statusLabel(payment.statusAfter)}</span></td>
                    <td><div className="row-actions">{isAdmin && payment.paymentMethod !== "ADJUSTMENT" && <button className="button button-outline button-small" onClick={() => openPaymentCorrection(payment)}>Correct</button>}<button className="button button-outline button-small" onClick={() => router.push(`/fees/receipt/${payment.id}`)}>Receipt</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state fee-history-empty">
            <strong>{paymentFilters.search || paymentFilters.from || paymentFilters.to || paymentFilters.status ? "No matching payments" : "No payments recorded yet"}</strong>
            <p>{paymentFilters.search || paymentFilters.from || paymentFilters.to || paymentFilters.status ? "Adjust the filters to see other payments." : "Successful payments will appear here with their receipt numbers."}</p>
          </div>
        )}
      </section>

      {isAdmin && feeModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFeeModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="fee-modal-title">
            <div className="modal-header">
              <div><span className="modal-icon"><Icon name="building" size={19} /></span><h2 id="fee-modal-title">{editingFee ? "Edit fee record" : "Add a fee record"}</h2><p>{editingFee ? "Update the fee amount or due date. Collected payments cannot be changed here." : "Set the student’s total fee amount and due date."}</p></div>
              <button className="icon-button" onClick={() => setFeeModalOpen(false)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitFee}>
              <div className="form-grid">
                <label className="form-field form-full"><span>Student <b>*</b></span>
                  <select required disabled={!!editingFee} value={feeForm.studentId} onChange={(event) => setFeeForm({ ...feeForm, studentId: event.target.value })}>
                    <option value="">Select a student</option>
                    {(editingFee ? [editingFee.student] : studentsWithoutFees).map((student) => <option key={student.id} value={student.id}>{student.name} · {student.registerNo} · {student.academicYear}</option>)}
                  </select>
                </label>
                <label className="form-field"><span>Class (optional)</span>
                  <select value={feeForm.classId} onChange={(event) => setFeeForm({ ...feeForm, classId: event.target.value })}>
                    <option value="">Unassigned</option>
                    {classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classRecord.name} · {classRecord.section} · {classRecord.academicYear}</option>)}
                  </select>
                </label>
                <label className="form-field"><span>Total fee (INR) <b>*</b></span><input type="number" min="0.01" step="0.01" required value={feeForm.totalAmount} onChange={(event) => setFeeForm({ ...feeForm, totalAmount: event.target.value })} placeholder="e.g. 45000.00" /></label>
                <label className="form-field form-full"><span>Payment due date <b>*</b></span><input type="date" required value={feeForm.dueDate} onChange={(event) => setFeeForm({ ...feeForm, dueDate: event.target.value })} /></label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => setFeeModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="button button-primary" disabled={saving || !feeForm.studentId}>{saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name="check" size={17} /> {editingFee ? "Save changes" : "Save fee record"}</>}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAdmin && paymentModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPaymentModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
            <div className="modal-header">
              <div><span className="modal-icon"><Icon name="check" size={19} /></span><h2 id="payment-modal-title">Record fee payment</h2><p>Payment is saved to the database before its receipt is shown.</p></div>
              <button className="icon-button" onClick={() => setPaymentModalOpen(false)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitPayment}>
              <div className="form-grid">
                <label className="form-field form-full"><span>Student <b>*</b></span>
                  <select required value={paymentForm.feeRecordId} onChange={(event) => setPaymentForm({ ...paymentForm, feeRecordId: event.target.value })}>
                    {feesWithBalance.map((fee) => <option key={fee.id} value={fee.id}>{fee.student.name} · {fee.student.registerNo} · Balance {formatMoney(fee.totalAmountPaise - fee.amountPaidPaise)}</option>)}
                  </select>
                </label>
                {selectedFee && <div className="fee-balance-callout form-full"><span>Remaining balance</span><strong>{formatMoney(selectedFee.totalAmountPaise - selectedFee.amountPaidPaise)}</strong></div>}
                <label className="form-field"><span>Payment amount (INR) <b>*</b></span><input type="number" min="0.01" max={selectedFee ? (selectedFee.totalAmountPaise - selectedFee.amountPaidPaise) / 100 : undefined} step="0.01" required value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="e.g. 10000.00" /></label>
                <label className="form-field"><span>Payment date <b>*</b></span><input type="date" required value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} /></label>
                <label className="form-field"><span>Payment method <b>*</b></span>
                  <select required value={paymentForm.paymentMethod} onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}>
                    <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CARD">Card</option>
                  </select>
                </label>
                <label className="form-field"><span>Transaction / reference number</span><input maxLength={100} value={paymentForm.transactionReference} onChange={(event) => setPaymentForm({ ...paymentForm, transactionReference: event.target.value })} placeholder="Optional" /></label>
                <label className="form-field form-full"><span>Description</span><input maxLength={500} value={paymentForm.description} onChange={(event) => setPaymentForm({ ...paymentForm, description: event.target.value })} placeholder="Optional payment note" /></label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => setPaymentModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="button button-primary" disabled={saving || !feesWithBalance.length}>{saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name="check" size={17} /> Save payment</>}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAdmin && correctingPayment && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCorrectingPayment(null); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-correction-title">
            <div className="modal-header">
              <div><span className="modal-icon"><Icon name="edit" size={19} /></span><h2 id="payment-correction-title">Correct payment</h2><p>The original payment remains in history. A signed adjustment is appended for auditability.</p></div>
              <button className="icon-button" onClick={() => setCorrectingPayment(null)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitPaymentCorrection}>
              <div className="form-grid">
                <div className="fee-balance-callout form-full"><span>Receipt {correctingPayment.receiptNumber}</span><strong>Current amount {formatMoney(correctingPayment.amountPaise)}</strong></div>
                <label className="form-field form-full"><span>Correct amount (INR) <b>*</b></span><input type="number" min="0.01" step="0.01" required value={correctedAmount} onChange={(event) => setCorrectedAmount(event.target.value)} /></label>
                <label className="form-field form-full"><span>Correction reason <b>*</b></span><textarea minLength={5} maxLength={500} required rows={3} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions"><button type="button" className="button button-outline" disabled={saving} onClick={() => setCorrectingPayment(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving correction…" : "Record correction"}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function FeeStat({ title, amount, detail }: { title: string; amount: string; detail: string }) {
  return (
    <article className="fee-stat panel">
      <span>{title}</span>
      <strong>{amount}</strong>
      <small>{detail}</small>
    </article>
  );
}
