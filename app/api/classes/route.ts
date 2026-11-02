import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateClass } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const classes = await prisma.class.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { academicYear: { contains: search } },
              { section: { contains: search } },
            ],
          }
        : undefined,
      orderBy: [{ academicYear: "asc" }, { name: "asc" }, { section: "asc" }],
    });
    return Response.json(classes);
  } catch (error) {
    console.error("Failed to load classes:", error);
    return Response.json({ error: "Could not load classes." }, { status: 500 });
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
    console.error("Failed to read class request:", error);
    return Response.json({ error: "Could not read class details." }, { status: 400 });
  }

  const result = validateClass(body);
  if (!result.success) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  try {
    const classRecord = await prisma.class.create({ data: result.data });
    return Response.json(classRecord, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "A class with that name, academic year, and section already exists." },
        { status: 409 },
      );
    }
    console.error("Failed to create class:", error);
    return Response.json({ error: "Could not create class." }, { status: 500 });
  }
}
