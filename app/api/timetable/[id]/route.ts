import { timetablePrisma as prisma } from "@/lib/timetable-prisma";
import { TimetableRequestError } from "@/lib/timetable-errors";
import { validateTimetableEntry } from "@/lib/timetable-validation";

const entryInclude = {
  class: true,
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, name: true, email: true } },
} as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to read timetable update:", error);
    return Response.json({ error: "Could not read timetable details." }, { status: 400 });
  }

  const validation = validateTimetableEntry(body);
  if (!validation.success) return Response.json({ error: validation.message }, { status: 400 });

  try {
    const entry = await prisma.$transaction(async (transaction) => {
      const current = await transaction.timetableEntry.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw new TimetableRequestError("Timetable entry not found.", 404);

      const [classSubject, subjectTeacher] = await Promise.all([
        transaction.classSubject.findUnique({
          where: {
            classId_subjectId: {
              classId: validation.data.classId,
              subjectId: validation.data.subjectId,
            },
          },
        }),
        transaction.subjectTeacher.findUnique({
          where: {
            teacherId_subjectId: {
              teacherId: validation.data.teacherId,
              subjectId: validation.data.subjectId,
            },
          },
        }),
      ]);
      if (!classSubject || !subjectTeacher) {
        throw new TimetableRequestError("The selected subject must be assigned to the class and teacher.", 400);
      }

      const conflict = await transaction.timetableEntry.findFirst({
        where: {
          id: { not: id },
          dayOfWeek: validation.data.dayOfWeek,
          startTime: { lt: validation.data.endTime },
          endTime: { gt: validation.data.startTime },
          OR: [{ classId: validation.data.classId }, { teacherId: validation.data.teacherId }],
        },
        select: { id: true },
      });
      if (conflict) {
        throw new TimetableRequestError("This time overlaps an existing class or teacher schedule.", 409);
      }

      return transaction.timetableEntry.update({
        where: { id },
        data: validation.data,
        include: entryInclude,
      });
    });
    return Response.json(entry);
  } catch (error) {
    if (error instanceof TimetableRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to update timetable entry:", error);
    return Response.json({ error: "Could not update timetable entry." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    await prisma.timetableEntry.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return Response.json({ error: "Timetable entry not found." }, { status: 404 });
    }
    console.error("Failed to delete timetable entry:", error);
    return Response.json({ error: "Could not delete timetable entry." }, { status: 500 });
  }
}
