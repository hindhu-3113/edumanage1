import { PrismaClient } from "@prisma/client-qr";

const globalForQrPrisma = globalThis as typeof globalThis & {
  qrPrisma?: PrismaClient;
};

export const qrPrisma =
  globalForQrPrisma.qrPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForQrPrisma.qrPrisma = qrPrisma;
}
