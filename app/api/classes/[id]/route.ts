import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { timetablePrisma } from "@/lib/timetable-prisma";
import { validateClass } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const classRecord = await prisma.class.findUnique({ where: { id } });
    if (!classRecord) return Response.json({ error: "Class not found." }, { status: 404 });
    return Response.json(classRecord);
  } catch (error) {
    console.error("Failed to load class:", error);
    return Response.json({ error: "Could not load class." }, { status: 500 });
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
    console.error("Failed to read class request:", error);
    return Response.json({ error: "Could not read class details." }, { status: 400 });
  }

  const result = validateClass(body);
  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const classRecord = await prisma.class.update({ where: { id }, data: result.data });
    return Response.json(classRecord);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json(
          { error: "A class with that name, academic year, and section already exists." },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return Response.json({ error: "Class not found." }, { status: 404 });
      }
    }
    console.error("Failed to update class:", error);
    return Response.json({ error: "Could not update class." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const timetableEntries = await timetablePrisma.timetableEntry.count({ where: { classId: id } });
    if (timetableEntries) {
      return Response.json({ error: "Remove this class's timetable entries before deleting it." }, { status: 409 });
    }
    const assignedSubjects = await prisma.classSubject.count({ where: { classId: id } });
    if (assignedSubjects) {
      return Response.json(
        { error: "Remove this class from its assigned subjects and timetable before deleting it." },
        { status: 409 },
      );
    }
    await prisma.class.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Class not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json(
        { error: "Remove this class from its assigned subjects and timetable before deleting it." },
        { status: 409 },
      );
    }
    console.error("Failed to delete class:", error);
    return Response.json({ error: "Could not delete class." }, { status: 500 });
  }
}
