import { Prisma } from "@prisma/client-report";
import { reportPrisma as prisma } from "@/lib/report-prisma";
import { timetablePrisma } from "@/lib/timetable-prisma";
import { validateSubject } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

const subjectRelations = {
  classes: { include: { class: true } },
  teachers: { include: { teacher: true } },
} satisfies Prisma.SubjectInclude;

async function validateAssociations(classIds: string[], teacherIds: string[]) {
  const [classes, teachers] = await Promise.all([
    classIds.length ? prisma.class.count({ where: { id: { in: classIds } } }) : 0,
    teacherIds.length ? prisma.teacher.count({ where: { id: { in: teacherIds } } }) : 0,
  ]);
  if (classes !== classIds.length) return "One or more selected classes no longer exist.";
  if (teachers !== teacherIds.length) return "One or more selected teachers no longer exist.";
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const subject = await prisma.subject.findUnique({ where: { id }, include: subjectRelations });
    if (!subject) return Response.json({ error: "Subject not found." }, { status: 404 });
    return Response.json(subject);
  } catch (error) {
    console.error("Failed to load subject:", error);
    return Response.json({ error: "Could not load subject." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    console.error("Failed to read subject request:", error);
    return Response.json({ error: "Could not read subject details." }, { status: 400 });
  }

  const result = validateSubject(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  try {
    const associationError = await validateAssociations(result.data.classIds, result.data.teacherIds);
    if (associationError) return Response.json({ error: associationError }, { status: 400 });
    const { id } = await context.params;
    const timetableAssignments = await timetablePrisma.timetableEntry.findMany({
      where: { subjectId: id },
      select: { classId: true, teacherId: true },
    });
    if (timetableAssignments.some((entry) =>
      !result.data.classIds.includes(entry.classId) || !result.data.teacherIds.includes(entry.teacherId)
    )) {
      return Response.json(
        { error: "Keep the class and teacher assignments used by existing timetable entries, or remove those entries first." },
        { status: 409 },
      );
    }
    const { classIds, teacherIds, ...data } = result.data;
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        ...data,
        classes: {
          deleteMany: {},
          create: classIds.map((classId) => ({ class: { connect: { id: classId } } })),
        },
        teachers: {
          deleteMany: {},
          create: teacherIds.map((teacherId) => ({ teacher: { connect: { id: teacherId } } })),
        },
      },
      include: subjectRelations,
    });
    return Response.json(subject);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A subject with that code already exists." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return Response.json({ error: "Subject not found, or a selected class or teacher no longer exists." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "One or more selected classes or teachers no longer exist." }, { status: 400 });
      }
    }
    console.error("Failed to update subject:", error);
    return Response.json({ error: "Could not update subject." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const timetableEntries = await timetablePrisma.timetableEntry.count({ where: { subjectId: id } });
    if (timetableEntries) {
      return Response.json({ error: "Remove this subject's timetable entries before deleting it." }, { status: 409 });
    }
    await prisma.subject.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Subject not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json({ error: "Could not delete the subject while assignments, timetable entries, or performance records are attached." }, { status: 409 });
    }
    console.error("Failed to delete subject:", error);
    return Response.json({ error: "Could not delete subject." }, { status: 500 });
  }
}
