import { Prisma } from "@prisma/client-report";
import { reportPrisma as prisma } from "@/lib/report-prisma";
import { validateSubject } from "@/lib/validation";

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

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams.get("search")?.trim();
    const subjects = await prisma.subject.findMany({
      where: search
        ? { OR: [{ name: { contains: search } }, { code: { contains: search.toUpperCase() } }] }
        : undefined,
      include: subjectRelations,
      orderBy: { name: "asc" },
    });
    return Response.json(subjects);
  } catch (error) {
    console.error("Failed to load subjects:", error);
    return Response.json({ error: "Could not load subjects." }, { status: 500 });
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
    console.error("Failed to read subject request:", error);
    return Response.json({ error: "Could not read subject details." }, { status: 400 });
  }

  const result = validateSubject(body);
  if (!result.success) return Response.json({ error: result.message }, { status: 400 });

  try {
    const associationError = await validateAssociations(result.data.classIds, result.data.teacherIds);
    if (associationError) return Response.json({ error: associationError }, { status: 400 });
    const { classIds, teacherIds, ...data } = result.data;
    const subject = await prisma.subject.create({
      data: {
        ...data,
        classes: {
          create: classIds.map((classId) => ({ class: { connect: { id: classId } } })),
        },
        teachers: {
          create: teacherIds.map((teacherId) => ({ teacher: { connect: { id: teacherId } } })),
        },
      },
      include: subjectRelations,
    });
    return Response.json(subject, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return Response.json({ error: "A subject with that code already exists." }, { status: 409 });
      }
      if (error.code === "P2003" || error.code === "P2025") {
        return Response.json({ error: "One or more selected classes or teachers no longer exist." }, { status: 400 });
      }
    }
    console.error("Failed to create subject:", error);
    return Response.json({ error: "Could not create subject." }, { status: 500 });
  }
}
