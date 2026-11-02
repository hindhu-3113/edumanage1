import { PrismaClient } from "@prisma/client-performance";

const prisma = new PrismaClient();

async function main() {
  const [students, subjects] = await Promise.all([
    prisma.student.findMany({ orderBy: { name: "asc" }, take: 5, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: { name: "asc" }, take: 2, select: { id: true, name: true } }),
  ]);

  if (!students.length || !subjects.length) {
    console.log("Performance sample data skipped: add at least one student and one subject first.");
    return;
  }

  const entries = [
    { student: students[0], subject: subjects[0], examName: "SAMPLE TEST - Midterm Examination", marks: 86, maximum: 100 },
    { student: students[0], subject: subjects[Math.min(1, subjects.length - 1)], examName: "SAMPLE TEST - Midterm Examination", marks: 78, maximum: 100 },
    { student: students[Math.min(1, students.length - 1)], subject: subjects[0], examName: "SAMPLE TEST - Unit Test 1", marks: 69, maximum: 80 },
    { student: students[Math.min(2, students.length - 1)], subject: subjects[Math.min(1, subjects.length - 1)], examName: "SAMPLE TEST - Quiz 1", marks: 17, maximum: 20 },
    { student: students[Math.min(3, students.length - 1)], subject: subjects[0], examName: "SAMPLE TEST - Midterm Examination", marks: 61, maximum: 100 },
  ];

  let created = 0;
  for (const entry of entries) {
    const existing = await prisma.performanceRecord.findUnique({
      where: {
        studentId_subjectId_examName: {
          studentId: entry.student.id,
          subjectId: entry.subject.id,
          examName: entry.examName,
        },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.performanceRecord.create({
      data: {
        studentId: entry.student.id,
        subjectId: entry.subject.id,
        examName: entry.examName,
        marksObtainedHundredths: entry.marks * 100,
        maximumMarksHundredths: entry.maximum * 100,
        isSample: true,
      },
    });
    created += 1;
  }
  console.log(`Created ${created} sample performance record(s); existing records were left unchanged.`);
}

main()
  .catch((error) => {
    console.error("Could not seed sample performance data:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
