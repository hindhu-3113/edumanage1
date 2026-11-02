import { isDateKey } from "@/lib/validation";

export type QrAttendanceRequest =
  | { qrToken: string; studentId?: never; date: string; classId: string }
  | { studentId: string; qrToken?: never; date: string; classId: string };

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateQrAttendanceRequest(value: unknown): Validation<QrAttendanceRequest> {
  if (!isRecord(value)) return { success: false, message: "Attendance details are required." };
  const date = typeof value.date === "string" ? value.date : "";
  const classId = typeof value.classId === "string" ? value.classId.trim() : "";
  if (!isDateKey(date)) return { success: false, message: "Choose a valid attendance date." };
  if (!classId || classId.length > 100) return { success: false, message: "Select a valid class." };

  if (typeof value.qrToken === "string") {
    const qrToken = value.qrToken.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(qrToken)) {
      return { success: false, message: "This QR code is invalid or unreadable." };
    }
    return { success: true, data: { qrToken, date, classId } };
  }

  if (typeof value.studentId === "string" && value.studentId.trim()) {
    return { success: true, data: { studentId: value.studentId.trim(), date, classId } };
  }

  return { success: false, message: "Scan a student QR code or choose a student for manual lookup." };
}
