import { PrismaClient } from "@prisma/client-auth";

const globalForAuthPrisma = globalThis as typeof globalThis & {
  authPrisma?: PrismaClient;
};

export const authPrisma =
  globalForAuthPrisma.authPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuthPrisma.authPrisma = authPrisma;
}
