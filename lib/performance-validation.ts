type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMarksHundredths(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const hundredths = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(hundredths) ? hundredths : null;
}

export function validatePerformanceRecord(value: unknown): Validation<{
  studentId: string;
  subjectId: string;
  examName: string;
  marksObtainedHundredths: number;
  maximumMarksHundredths: number;
}> {
  if (!isRecord(value)) return { success: false, message: "Performance details must be an object." };

  const studentId = typeof value.studentId === "string" ? value.studentId.trim() : "";
  const subjectId = typeof value.subjectId === "string" ? value.subjectId.trim() : "";
  const examName = typeof value.examName === "string" ? value.examName.trim() : "";
  const marksObtainedHundredths = parseMarksHundredths(value.marksObtained);
  const maximumMarksHundredths = parseMarksHundredths(value.maximumMarks);

  if (!studentId) return { success: false, message: "Select a student." };
  if (!subjectId) return { success: false, message: "Select a subject." };
  if (!examName || examName.length > 100) return { success: false, message: "Exam name is required and must be 100 characters or fewer." };
  if (marksObtainedHundredths === null || maximumMarksHundredths === null) {
    return { success: false, message: "Marks must be valid non-negative numbers with up to two decimal places." };
  }
  if (maximumMarksHundredths === 0) return { success: false, message: "Maximum marks must be greater than zero." };
  if (marksObtainedHundredths > maximumMarksHundredths) {
    return { success: false, message: "Marks obtained cannot exceed maximum marks." };
  }

  return {
    success: true,
    data: {
      studentId,
      subjectId,
      examName,
      marksObtainedHundredths,
      maximumMarksHundredths,
    },
  };
}
