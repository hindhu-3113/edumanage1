export const paymentMethods = ["CASH", "UPI", "BANK_TRANSFER", "CARD"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRupeesToPaise(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const rupees = Number(raw);
  const paise = Math.round(rupees * 100);
  return Number.isSafeInteger(paise) && paise > 0 && paise <= 2_147_483_647 ? paise : null;
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function validateFeeRecord(value: unknown): Validation<{
  studentId: string;
  classId: string | null;
  totalAmountPaise: number;
  dueDate: Date;
}> {
  if (!isRecord(value)) return { success: false, message: "Fee details must be an object." };
  const studentId = typeof value.studentId === "string" ? value.studentId.trim() : "";
  const classId = typeof value.classId === "string" && value.classId.trim() ? value.classId.trim() : null;
  const totalAmountPaise = parseRupeesToPaise(value.totalAmount);
  const dueDate = parseDateOnly(value.dueDate);

  if (!studentId) return { success: false, message: "Select a student." };
  if (totalAmountPaise === null) return { success: false, message: "Total fee must be a positive amount with up to two decimal places." };
  if (!dueDate) return { success: false, message: "Enter a valid payment due date." };
  return { success: true, data: { studentId, classId, totalAmountPaise, dueDate } };
}

export function validateFeePayment(value: unknown): Validation<{
  feeRecordId: string;
  amountPaise: number;
  paymentDate: Date;
  paymentMethod: PaymentMethod;
  transactionReference: string | null;
  description: string | null;
  idempotencyKey: string;
}> {
  if (!isRecord(value)) return { success: false, message: "Payment details must be an object." };

  const feeRecordId = typeof value.feeRecordId === "string" ? value.feeRecordId.trim() : "";
  const amountPaise = parseRupeesToPaise(value.amount);
  const paymentDate = parseDateOnly(value.paymentDate);
  const method = typeof value.paymentMethod === "string" ? value.paymentMethod : "";
  const idempotencyKey = typeof value.idempotencyKey === "string" ? value.idempotencyKey.trim() : "";
  const transactionReference =
    typeof value.transactionReference === "string" ? value.transactionReference.trim() || null : null;
  const description = typeof value.description === "string" ? value.description.trim() || null : null;

  if (!feeRecordId) return { success: false, message: "Select a student fee record." };
  if (amountPaise === null) return { success: false, message: "Payment amount must be positive and have up to two decimal places." };
  if (!paymentDate) return { success: false, message: "Enter a valid payment date." };
  if (!paymentMethods.includes(method as PaymentMethod)) {
    return { success: false, message: "Select a supported payment method." };
  }
  if (!/^[\w-]{16,100}$/.test(idempotencyKey)) {
    return { success: false, message: "Payment submission key is missing or invalid. Please reopen the payment form." };
  }
  if (transactionReference && transactionReference.length > 100) {
    return { success: false, message: "Transaction reference must be 100 characters or fewer." };
  }
  if (description && description.length > 500) {
    return { success: false, message: "Payment description must be 500 characters or fewer." };
  }

  return {
    success: true,
    data: {
      feeRecordId,
      amountPaise,
      paymentDate,
      paymentMethod: method as PaymentMethod,
      transactionReference,
      description,
      idempotencyKey,
    },
  };
}
