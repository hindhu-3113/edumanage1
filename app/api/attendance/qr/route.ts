import { Prisma } from "@prisma/client-qr";
import { qrPrisma as prisma } from "@/lib/qr-prisma";
import { validateQrAttendanceRequest } from "@/lib/qr-validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to read QR attendance request:", error);
    return Response.json({ error: "Could not read attendance details." }, { status: 400 });
  }

  const validation = validateQrAttendanceRequest(body);
  if (!validation.success) return Response.json({ error: validation.message }, { status: 400 });

  try {
    const classRecord = await prisma.class.findUnique({
      where: { id: validation.data.classId },
      select: { id: true },
    });
    if (!classRecord) return Response.json({ error: "The selected class no longer exists." }, { status: 400 });

    const student = "qrToken" in validation.data
      ? await prisma.student.findUnique({
          where: { qrToken: validation.data.qrToken },
          select: { id: true, name: true, registerNo: true },
        })
      : await prisma.student.findUnique({
          where: { id: validation.data.studentId },
          select: { id: true, name: true, registerNo: true },
        });
    if (!student) {
      return Response.json(
        { error: "This QR code is unknown or invalid. Use the manual student lookup if needed." },
        { status: 404 },
      );
    }

    const existing = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId: student.id, date: validation.data.date } },
      select: { status: true },
    });
    if (existing) {
      return Response.json(
        { error: `${student.name} already has ${existing.status.toLowerCase()} attendance for this date.` },
        { status: 409 },
      );
    }

    const attendance = await prisma.attendance.create({
      data: { studentId: student.id, date: validation.data.date, status: "PRESENT" },
      select: { id: true, date: true, status: true },
    });
    return Response.json({
      success: true,
      attendance,
      student,
      source: "qrToken" in validation.data ? "QR" : "MANUAL_LOOKUP",
      classMembershipVerified: false,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "This student already has an attendance record for that date." }, { status: 409 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "The selected student or class no longer exists." }, { status: 400 });
      }
    }
    console.error("Failed to record QR attendance:", error);
    return Response.json({ error: "Could not record attendance." }, { status: 500 });
  }
}
