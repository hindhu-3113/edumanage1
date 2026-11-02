import { Prisma } from "@prisma/client-announcement";
import { announcementPrisma as prisma } from "@/lib/announcement-prisma";
import { isAnnouncementExpired, validateAnnouncement } from "@/lib/announcement-validation";

function presentAnnouncement<T extends { expiresAt: Date | null }>(announcement: T) {
  return { ...announcement, status: isAnnouncementExpired(announcement.expiresAt) ? "EXPIRED" : "ACTIVE" };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim();
  const category = searchParams.get("category") || undefined;
  const priority = searchParams.get("priority") || undefined;

  try {
    const announcements = await prisma.announcement.findMany({
      where: {
        category,
        priority,
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { description: { contains: search } },
                { category: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return Response.json(announcements.map(presentAnnouncement));
  } catch (error) {
    console.error("Failed to load announcements:", error);
    return Response.json({ error: "Could not load announcements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    const announcement = await prisma.announcement.create({ data: validation.data });
    return Response.json(presentAnnouncement(announcement), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "An announcement with these unique details already exists." }, { status: 409 });
    }
    console.error("Failed to create announcement:", error);
    return Response.json({ error: "Could not create announcement." }, { status: 500 });
  }
}
