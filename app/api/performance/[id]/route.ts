import { Prisma } from "@prisma/client-performance";
import { performancePrisma as prisma } from "@/lib/performance-prisma";
import { validatePerformanceRecord } from "@/lib/performance-validation";

type RouteContext = { params: Promise<{ id: string }> };

const recordRelations = {
  student: { select: { id: true, name: true, registerNo: true, academicYear: true } },
  subject: { select: { id: true, name: true, code: true } },
} satisfies Prisma.PerformanceRecordInclude;

function percentage(marks: number, maximum: number) {
  return Math.round((marks / maximum) * 10000) / 100;
}

export async function PUT(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Failed to read performance update:", error);
    return Response.json({ error: "Could not read performance details." }, { status: 400 });
  }

  const result = validatePerformanceRecord(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  try {
    const { id } = await context.params;
    const record = await prisma.performanceRecord.update({
      where: { id },
      data: { ...result.data, isSample: false },
      include: recordRelations,
    });
    return Response.json({
      ...record,
      percentage: percentage(record.marksObtainedHundredths, record.maximumMarksHundredths),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A performance record for this student, subject, and exam already exists." }, { status: 409 });
      }
      if (error.code === "P2025") return Response.json({ error: "Performance record not found." }, { status: 404 });
      if (error.code === "P2003") return Response.json({ error: "Select an existing student and subject." }, { status: 400 });
    }
    console.error("Failed to update performance record:", error);
    return Response.json({ error: "Could not update performance record." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await prisma.performanceRecord.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Performance record not found." }, { status: 404 });
    }
    console.error("Failed to delete performance record:", error);
    return Response.json({ error: "Could not delete performance record." }, { status: 500 });
  }
}
