import { qrPrisma as prisma } from "@/lib/qr-prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        registerNo: true,
        qrToken: true,
        department: { select: { name: true, code: true } },
      },
    });
    if (!student) return Response.json({ error: "Student not found." }, { status: 404 });
    if (!student.qrToken) {
      return Response.json({ error: "A QR code has not been generated for this student yet." }, { status: 409 });
    }

    return Response.json({
      id: student.id,
      name: student.name,
      registerNo: student.registerNo,
      department: student.department,
      qrToken: student.qrToken,
    });
  } catch (error) {
    console.error("Failed to load student QR code:", error);
    return Response.json({ error: "Could not load student QR code." }, { status: 500 });
  }
}
