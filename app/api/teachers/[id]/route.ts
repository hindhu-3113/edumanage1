import { Prisma } from "@prisma/client-report";
import { reportPrisma as prisma } from "@/lib/report-prisma";
import { timetablePrisma } from "@/lib/timetable-prisma";
import { validateTeacher } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const teacher = await prisma.teacher.findUnique({ where: { id }, include: { department: true } });
    if (!teacher) return Response.json({ error: "Teacher not found." }, { status: 404 });
    return Response.json(teacher);
  } catch (error) {
    console.error("Failed to load teacher:", error);
    return Response.json({ error: "Could not load teacher." }, { status: 500 });
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
    console.error("Failed to read teacher request:", error);
    return Response.json({ error: "Could not read teacher details." }, { status: 400 });
  }

  const result = validateTeacher(body);
  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const teacher = await prisma.teacher.update({
      where: { id },
      data: result.data,
      include: { department: true },
    });
    return Response.json(teacher);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A teacher with that email address already exists." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return Response.json({ error: "Teacher not found." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "Choose an existing department." }, { status: 400 });
      }
    }
    console.error("Failed to update teacher:", error);
    return Response.json({ error: "Could not update teacher." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const timetableEntries = await timetablePrisma.timetableEntry.count({ where: { teacherId: id } });
    if (timetableEntries) {
      return Response.json({ error: "Remove this teacher's timetable entries before deleting them." }, { status: 409 });
    }
    const assignedSubjects = await prisma.subjectTeacher.count({ where: { teacherId: id } });
    if (assignedSubjects) {
      return Response.json(
        { error: "Remove this teacher from assigned subjects and timetable entries before deleting them." },
        { status: 409 },
      );
    }
    await prisma.teacher.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Teacher not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json(
        { error: "Remove this teacher from assigned subjects and timetable entries before deleting them." },
        { status: 409 },
      );
    }
    console.error("Failed to delete teacher:", error);
    return Response.json({ error: "Could not delete teacher." }, { status: 500 });
  }
}
