import { PrismaClient } from "@prisma/client-announcement";

const globalForAnnouncementPrisma = globalThis as typeof globalThis & {
  announcementPrisma?: PrismaClient;
};

export const announcementPrisma =
  globalForAnnouncementPrisma.announcementPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForAnnouncementPrisma.announcementPrisma = announcementPrisma;
}
