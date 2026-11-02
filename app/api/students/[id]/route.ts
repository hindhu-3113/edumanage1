import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateStudent } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!student) return Response.json({ error: "Student not found." }, { status: 404 });
    return Response.json(student);
  } catch (error) {
    console.error("Failed to load student:", error);
    return Response.json({ error: "Could not load student." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = validateStudent(await request.json());
    if (!result.success) {
      return Response.json({ error: result.message }, { status: 400 });
    }

    const student = await prisma.student.update({
      where: { id },
      data: result.data,
      include: { department: true },
    });
    return Response.json(student);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json(
          { error: "That register number or email is already in use." },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return Response.json({ error: "Student not found." }, { status: 404 });
      }
      if (error.code === "P2003") {
        return Response.json({ error: "Choose a valid department." }, { status: 400 });
      }
    }
    console.error("Failed to update student:", error);
    return Response.json({ error: "Could not update student." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await prisma.student.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Student not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json(
        { error: "This student has financial or academic records and cannot be deleted without preserving that history." },
        { status: 409 },
      );
    }
    console.error("Failed to delete student:", error);
    return Response.json({ error: "Could not delete student." }, { status: 500 });
  }
}
