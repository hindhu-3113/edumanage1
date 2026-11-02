import { Prisma } from "@prisma/client-auth";
import { authPrisma as prisma } from "@/lib/auth-prisma";
import { isUserRole } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return Response.json({ error: "User changes must be sent as an object." }, { status: 400 });
  }

  const { id } = await params;
  const role = body.role;
  const isActive = body.isActive;
  if (!isUserRole(role) || typeof isActive !== "boolean") {
    return Response.json({ error: "Choose a valid role and active status." }, { status: 400 });
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) return Response.json({ error: "User not found." }, { status: 404 });

    const currentUserId = request.headers.get("x-edumanage-user-id");
    if (currentUserId === id && (role !== "ADMIN" || !isActive)) {
      return Response.json({ error: "You cannot demote or deactivate your own account." }, { status: 409 });
    }

    const removesActiveAdmin =
      target.role === "ADMIN" &&
      target.isActive &&
      (role !== "ADMIN" || !isActive);
    if (removesActiveAdmin) {
      const activeAdmins = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (activeAdmins <= 1) {
        return Response.json({ error: "The last active administrator cannot be demoted or deactivated." }, { status: 409 });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    if (!isActive) await prisma.authSession.deleteMany({ where: { userId: id } });
    return Response.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "User not found." }, { status: 404 });
    }
    console.error("Failed to update user account:", error);
    return Response.json({ error: "Could not update the user account." }, { status: 500 });
  }
}
