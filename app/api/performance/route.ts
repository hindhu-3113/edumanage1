import { Prisma } from "@prisma/client-performance";
import { performancePrisma as prisma } from "@/lib/performance-prisma";
import { validatePerformanceRecord } from "@/lib/performance-validation";

const recordRelations = {
  student: { select: { id: true, name: true, registerNo: true, academicYear: true } },
  subject: { select: { id: true, name: true, code: true } },
} satisfies Prisma.PerformanceRecordInclude;

function percentage(marks: number, maximum: number) {
  return Math.round((marks / maximum) * 10000) / 100;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLocaleLowerCase();
    const subjectId = searchParams.get("subjectId")?.trim();
    const exam = searchParams.get("exam")?.trim().toLocaleLowerCase();
    const sort = searchParams.get("sort") ?? "date_desc";
    const sortOrders: Record<string, Prisma.PerformanceRecordOrderByWithRelationInput[]> = {
      date_desc: [{ createdAt: "desc" }, { examName: "asc" }],
      student_asc: [{ student: { name: "asc" } }, { examName: "asc" }],
      subject_asc: [{ subject: { name: "asc" } }, { examName: "asc" }],
      exam_asc: [{ examName: "asc" }, { student: { name: "asc" } }],
    };
    const orderBy = sortOrders[sort];
    if (!orderBy) return Response.json({ error: "Performance sort option is invalid." }, { status: 400 });

    const records = await prisma.performanceRecord.findMany({
      where: {
        ...(subjectId ? { subjectId } : {}),
        ...(exam ? { examName: { contains: exam } } : {}),
        ...(search
          ? {
              student: {
                name: { contains: search },
              },
            }
          : {}),
      },
      include: recordRelations,
      orderBy,
    });
    return Response.json(records.map((record) => ({
      ...record,
      percentage: percentage(record.marksObtainedHundredths, record.maximumMarksHundredths),
    })));
  } catch (error) {
    console.error("Failed to load performance records:", error);
    return Response.json({ error: "Could not load performance records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to read performance request:", error);
    return Response.json({ error: "Could not read performance details." }, { status: 400 });
  }

  const result = validatePerformanceRecord(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  try {
    const record = await prisma.performanceRecord.create({
      data: result.data,
      include: recordRelations,
    });
    return Response.json({
      ...record,
      percentage: percentage(record.marksObtainedHundredths, record.maximumMarksHundredths),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A performance record for this student, subject, and exam already exists." }, { status: 409 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "Select an existing student and subject." }, { status: 400 });
      }
    }
    console.error("Failed to create performance record:", error);
    return Response.json({ error: "Could not create performance record." }, { status: 500 });
  }
}
