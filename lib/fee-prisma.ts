import { PrismaClient } from "@prisma/client-fee";

const globalForFeePrisma = globalThis as typeof globalThis & {
  feePrisma?: PrismaClient;
};

export const feePrisma =
  globalForFeePrisma.feePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForFeePrisma.feePrisma = feePrisma;
}
