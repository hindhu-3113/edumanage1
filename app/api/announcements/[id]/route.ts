import { Prisma } from "@prisma/client-announcement";
import { announcementPrisma as prisma } from "@/lib/announcement-prisma";
import { isAnnouncementExpired, validateAnnouncement } from "@/lib/announcement-validation";

type RouteContext = { params: Promise<{ id: string }> };

function presentAnnouncement<T extends { expiresAt: Date | null }>(announcement: T) {
  return { ...announcement, status: isAnnouncementExpired(announcement.expiresAt) ? "EXPIRED" : "ACTIVE" };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return Response.json({ error: "Announcement not found." }, { status: 404 });
    return Response.json(presentAnnouncement(announcement));
  } catch (error) {
    console.error("Failed to load announcement:", error);
    return Response.json({ error: "Could not load announcement." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    console.error("Failed to read announcement request:", error);
    return Response.json({ error: "Could not read announcement details." }, { status: 400 });
  }

  const validation = validateAnnouncement(body);
  if (!validation.success) return Response.json({ error: validation.message }, { status: 400 });

  try {
    const { id } = await params;
    const announcement = await prisma.announcement.update({
      where: { id },
      data: validation.data,
    });
    return Response.json(presentAnnouncement(announcement));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Announcement not found." }, { status: 404 });
    }
    console.error("Failed to update announcement:", error);
    return Response.json({ error: "Could not update announcement." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await prisma.announcement.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return Response.json({ error: "Announcement not found." }, { status: 404 });
    }
    console.error("Failed to delete announcement:", error);
    return Response.json({ error: "Could not delete announcement." }, { status: 500 });
  }
}
