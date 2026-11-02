import { PrismaClient } from "@prisma/client-report";

const globalForReportPrisma = globalThis as typeof globalThis & {
  reportPrisma?: PrismaClient;
};

export const reportPrisma =
  globalForReportPrisma.reportPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForReportPrisma.reportPrisma = reportPrisma;
}
