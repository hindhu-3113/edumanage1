import { PrismaClient } from "@prisma/client-timetable";

const globalForTimetablePrisma = globalThis as typeof globalThis & {
  timetablePrisma?: PrismaClient;
};

export const timetablePrisma =
  globalForTimetablePrisma.timetablePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForTimetablePrisma.timetablePrisma = timetablePrisma;
}
