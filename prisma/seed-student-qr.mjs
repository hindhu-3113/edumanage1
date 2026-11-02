import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client-qr";

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    where: { qrToken: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let generated = 0;
  for (const student of students) {
    await prisma.student.update({
      where: { id: student.id },
      data: { qrToken: randomBytes(32).toString("base64url") },
    });
    generated += 1;
  }

  const total = await prisma.student.count();
  const generatedTotal = await prisma.student.count({ where: { qrToken: { not: null } } });
  console.log(`Generated ${generated} QR code identifier(s); ${generatedTotal} of ${total} existing students now have a QR code.`);
}

main()
  .catch((error) => {
    console.error("Could not generate student QR codes:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
