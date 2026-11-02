import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { students: true } } },
    });
    return Response.json(departments);
  } catch (error) {
    console.error("Failed to load departments:", error);
    return Response.json({ error: "Could not load departments." }, { status: 500 });
  }
}
