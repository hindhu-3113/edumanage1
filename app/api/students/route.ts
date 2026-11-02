import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client-qr";
import { prisma } from "@/lib/prisma";
import { qrPrisma } from "@/lib/qr-prisma";
import { validateStudent } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const departmentId = searchParams.get("departmentId");
    const academicYear = searchParams.get("academicYear");

    const students = await prisma.student.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { registerNo: { contains: search } },
              ],
            }
          : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
      include: { department: true },
      orderBy: { name: "asc" },
    });
    return Response.json(students);
  } catch (error) {
    console.error("Failed to load students:", error);
    return Response.json({ error: "Could not load students." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const result = validateStudent(await request.json());
    if (!result.success) {
      return Response.json({ error: result.message }, { status: 400 });
    }

    const student = await qrPrisma.student.create({
      data: {
        ...result.data,
        qrToken: randomBytes(32).toString("base64url"),
      },
      include: { department: true },
    });
    return Response.json(student, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json(
          { error: "That register number or email is already in use." },
          { status: 409 },
        );
      }
      if (error.code === "P2003") {
        return Response.json({ error: "Choose a valid department." }, { status: 400 });
      }
    }
    console.error("Failed to create student:", error);
    return Response.json({ error: "Could not create student." }, { status: 500 });
  }
}
