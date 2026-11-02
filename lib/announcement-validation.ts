export const ANNOUNCEMENT_CATEGORIES = [
  "General",
  "Academics",
  "Fees",
  "Attendance",
  "Events",
  "Holidays",
  "Assignments",
] as const;

export const ANNOUNCEMENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export type AnnouncementInput = {
  title: string;
  description: string;
  category: (typeof ANNOUNCEMENT_CATEGORIES)[number];
  priority: (typeof ANNOUNCEMENT_PRIORITIES)[number];
  publishedAt: Date;
  expiresAt: Date | null;
};

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function validateAnnouncement(value: unknown): Validation<AnnouncementInput> {
  if (!isRecord(value)) return { success: false, message: "Announcement details must be an object." };

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const description = typeof value.description === "string" ? value.description.trim() : "";
  const category = value.category;
  const priority = value.priority;
  const publishedAt = parseDate(value.publishedAt);
  const expiresAt = value.expiresAt === "" || value.expiresAt === null || value.expiresAt === undefined
    ? null
    : parseDate(value.expiresAt);

  if (!title || title.length > 140) return { success: false, message: "Title is required and must be 140 characters or fewer." };
  if (!description || description.length > 5000) return { success: false, message: "Description is required and must be 5,000 characters or fewer." };
  if (typeof category !== "string" || !ANNOUNCEMENT_CATEGORIES.includes(category as AnnouncementInput["category"])) {
    return { success: false, message: "Choose a valid announcement category." };
  }
  if (typeof priority !== "string" || !ANNOUNCEMENT_PRIORITIES.includes(priority as AnnouncementInput["priority"])) {
    return { success: false, message: "Choose a valid priority." };
  }
  if (!publishedAt) return { success: false, message: "Choose a valid published date." };
  if (value.expiresAt !== "" && value.expiresAt !== null && value.expiresAt !== undefined && !expiresAt) {
    return { success: false, message: "Choose a valid expiry date or leave it blank." };
  }
  if (expiresAt && expiresAt < publishedAt) {
    return { success: false, message: "Expiry date cannot be before the published date." };
  }

  return {
    success: true,
    data: {
      title,
      description,
      category: category as AnnouncementInput["category"],
      priority: priority as AnnouncementInput["priority"],
      publishedAt,
      expiresAt,
    },
  };
}

export function isAnnouncementExpired(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return expiresAt < todayStart;
}
