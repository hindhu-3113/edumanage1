import { Prisma } from "@prisma/client-report";
import { reportPrisma as prisma } from "@/lib/report-prisma";
import { validateTeacher } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const teachers = await prisma.teacher.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search.toLowerCase() } },
            ],
          }
        : undefined,
      include: { department: true },
      orderBy: { name: "asc" },
    });
    return Response.json(teachers);
  } catch (error) {
    console.error("Failed to load teachers:", error);
    return Response.json({ error: "Could not load teachers." }, { status: 500 });
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
    console.error("Failed to read teacher request:", error);
    return Response.json({ error: "Could not read teacher details." }, { status: 400 });
  }

  const result = validateTeacher(body);
  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  try {
    const teacher = await prisma.teacher.create({
      data: result.data,
      include: { department: true },
    });
    return Response.json(teacher, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "A teacher with that email address already exists." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json({ error: "Choose an existing department." }, { status: 400 });
    }
    console.error("Failed to create teacher:", error);
    return Response.json({ error: "Could not create teacher." }, { status: 500 });
  }
}
