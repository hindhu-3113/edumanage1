import { timetablePrisma as prisma } from "@/lib/timetable-prisma";
import { TimetableRequestError } from "@/lib/timetable-errors";
import { validateTimetableEntry } from "@/lib/timetable-validation";

const entryInclude = {
  class: true,
  subject: { select: { id: true, name: true, code: true } },
  teacher: { select: { id: true, name: true, email: true } },
} as const;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const classId = searchParams.get("classId") || undefined;
  const subjectId = searchParams.get("subjectId") || undefined;
  const teacherId = searchParams.get("teacherId") || undefined;
  const dayOfWeek = searchParams.get("dayOfWeek") || undefined;
  const search = searchParams.get("search")?.trim();

  try {
    const entries = await prisma.timetableEntry.findMany({
      where: {
        classId,
        subjectId,
        teacherId,
        dayOfWeek,
        ...(search
          ? {
              OR: [
                { roomNumber: { contains: search } },
                { academicYear: { contains: search } },
                { class: { name: { contains: search } } },
                { class: { section: { contains: search } } },
                { subject: { name: { contains: search } } },
                { subject: { code: { contains: search } } },
                { teacher: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: entryInclude,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return Response.json(entries);
  } catch (error) {
    console.error("Failed to load timetable:", error);
    return Response.json({ error: "Could not load timetable entries." }, { status: 500 });
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
    console.error("Failed to read timetable request:", error);
    return Response.json({ error: "Could not read timetable details." }, { status: 400 });
  }

  const validation = validateTimetableEntry(body);
  if (!validation.success) return Response.json({ error: validation.message }, { status: 400 });

  try {
    const entry = await prisma.$transaction(async (transaction) => {
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

      return transaction.timetableEntry.create({
        data: validation.data,
        include: entryInclude,
      });
    });
    return Response.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof TimetableRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to create timetable entry:", error);
    return Response.json({ error: "Could not create timetable entry." }, { status: 500 });
  }
}
