export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type TimetableInput = {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: (typeof DAYS_OF_WEEK)[number];
  startTime: string;
  endTime: string;
  roomNumber: string;
  academicYear: string | null;
};

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTimetableEntry(value: unknown): Validation<TimetableInput> {
  if (!isRecord(value)) return { success: false, message: "Timetable details must be an object." };

  const classId = typeof value.classId === "string" ? value.classId.trim() : "";
  const subjectId = typeof value.subjectId === "string" ? value.subjectId.trim() : "";
  const teacherId = typeof value.teacherId === "string" ? value.teacherId.trim() : "";
  const dayOfWeek = value.dayOfWeek;
  const startTime = typeof value.startTime === "string" ? value.startTime.trim() : "";
  const endTime = typeof value.endTime === "string" ? value.endTime.trim() : "";
  const roomNumber = typeof value.roomNumber === "string" ? value.roomNumber.trim() : "";
  const academicYear = value.academicYear === undefined || value.academicYear === null
    ? null
    : typeof value.academicYear === "string" && value.academicYear.trim()
      ? value.academicYear.trim()
      : null;

  if (!classId || !subjectId || !teacherId) return { success: false, message: "Select an existing class, subject, and teacher." };
  if (typeof dayOfWeek !== "string" || !DAYS_OF_WEEK.includes(dayOfWeek as (typeof DAYS_OF_WEEK)[number])) {
    return { success: false, message: "Choose a valid day of the week." };
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)) {
    return { success: false, message: "Enter start and end times in 24-hour HH:MM format." };
  }
  if (endTime <= startTime) return { success: false, message: "End time must be after start time." };
  if (!roomNumber || roomNumber.length > 50) return { success: false, message: "Room number is required and must be 50 characters or fewer." };
  if (academicYear && academicYear.length > 30) return { success: false, message: "Academic year must be 30 characters or fewer." };

  return {
    success: true,
    data: {
      classId,
      subjectId,
      teacherId,
      dayOfWeek: dayOfWeek as TimetableInput["dayOfWeek"],
      startTime,
      endTime,
      roomNumber,
      academicYear,
    },
  };
}
