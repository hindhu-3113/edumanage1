import { PrismaClient } from "@prisma/client-performance";

const globalForPerformancePrisma = globalThis as typeof globalThis & {
  performancePrisma?: PrismaClient;
};

export const performancePrisma =
  globalForPerformancePrisma.performancePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPerformancePrisma.performancePrisma = performancePrisma;
}
