import { PrismaClient } from "@prisma/client-timetable";

const prisma = new PrismaClient();
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const periods = [
  { startTime: "09:00", endTime: "10:00" },
  { startTime: "10:15", endTime: "11:15" },
];
const plan = [
  [0, 0], [1, 1],
  [2, 0], [3, 1],
  [4, 0], [5, 1],
  [0, 0], [2, 1],
  [1, 0], [3, 1],
];

async function main() {
  const assignments = await prisma.subject.findMany({
    where: { isSample: true },
    include: {
      classes: { include: { class: true } },
      teachers: { include: { teacher: true } },
    },
    orderBy: { code: "asc" },
  });
  const validPairs = assignments.flatMap((subject) =>
    subject.classes.flatMap(({ class: classRecord }) =>
      subject.teachers.map(({ teacher }) => ({ subject, classRecord, teacher })),
    ),
  );
  if (validPairs.length < 6) {
    throw new Error("Timetable sample seed requires at least six sample subject/class/teacher assignments.");
  }

  let created = 0;
  for (const [index, [assignmentIndex, periodIndex]] of plan.entries()) {
    const { subject, classRecord, teacher } = validPairs[assignmentIndex % validPairs.length];
    const dayOfWeek = days[Math.floor(index / 2)];
    const { startTime, endTime } = periods[periodIndex];
    const duplicate = await prisma.timetableEntry.findFirst({
      where: {
        isSample: true,
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek,
        startTime,
      },
      select: { id: true },
    });
    if (duplicate) continue;

    const conflict = await prisma.timetableEntry.findFirst({
      where: {
        dayOfWeek,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        OR: [{ classId: classRecord.id }, { teacherId: teacher.id }],
      },
      select: { id: true },
    });
    if (conflict) {
      console.warn(`Skipped ${dayOfWeek} ${startTime} sample entry because it overlaps an existing schedule.`);
      continue;
    }

    await prisma.timetableEntry.create({
      data: {
        classId: classRecord.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek,
        startTime,
        endTime,
        roomNumber: `Room ${201 + assignmentIndex}`,
        academicYear: classRecord.academicYear,
        isSample: true,
      },
    });
    created += 1;
  }

  const sampleCount = await prisma.timetableEntry.count({ where: { isSample: true } });
  const totalCount = await prisma.timetableEntry.count();
  console.log(`Created ${created} sample timetable entry(s); ${sampleCount} sample and ${totalCount} total timetable entries now exist.`);
}

main()
  .catch((error) => {
    console.error("Could not seed sample timetable:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
