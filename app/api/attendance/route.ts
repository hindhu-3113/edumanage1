import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentDateKey } from "@/lib/dates";
import { isDateKey } from "@/lib/validation";

type AttendanceInput = { studentId: string; status: "PRESENT" | "ABSENT" };

function isAttendanceInput(value: unknown): value is AttendanceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.studentId === "string" &&
    record.studentId.length > 0 &&
    (record.status === "PRESENT" || record.status === "ABSENT")
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? getCurrentDateKey();
    if (!isDateKey(date)) {
      return Response.json({ error: "Choose a valid date." }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      include: {
        department: true,
        attendance: { where: { date }, select: { status: true } },
      },
      orderBy: { name: "asc" },
    });
    return Response.json(
      students.map(({ attendance, ...student }) => ({
        ...student,
        status: attendance[0]?.status ?? null,
      })),
    );
  } catch (error) {
    console.error("Failed to load attendance:", error);
    return Response.json({ error: "Could not load attendance." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ error: "Attendance details are required." }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const date = typeof record.date === "string" ? record.date : "";
    const records = record.records;
    if (!isDateKey(date)) {
      return Response.json({ error: "Choose a valid date." }, { status: 400 });
    }
    if (
      !Array.isArray(records) ||
      records.length === 0 ||
      !records.every(isAttendanceInput)
    ) {
      return Response.json(
        { error: "Add at least one student with a Present or Absent status." },
        { status: 400 },
      );
    }
    if (new Set(records.map((item) => item.studentId)).size !== records.length) {
      return Response.json({ error: "Each student can only be included once." }, { status: 400 });
    }

    await prisma.$transaction(
      records.map((item) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: item.studentId, date } },
          update: { status: item.status },
          create: { studentId: item.studentId, date, status: item.status },
        }),
      ),
    );
    return Response.json({ success: true, saved: records.length });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json({ error: "One or more selected students no longer exist." }, { status: 400 });
    }
    console.error("Failed to save attendance:", error);
    return Response.json({ error: "Could not save attendance." }, { status: 500 });
  }
}
