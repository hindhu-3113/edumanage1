import { PrismaClient } from "@prisma/client-announcement";

const prisma = new PrismaClient();
const samples = [
  {
    title: "College reopening after the mid-term break",
    description: "The college will reopen on 2 November. Students should report to their regular classes by 9:00 AM and carry their campus identity cards.",
    category: "General",
    priority: "HIGH",
    publishedAt: "2026-10-24",
    expiresAt: "2026-11-02",
  },
  {
    title: "Internal examination timetable published",
    description: "The internal examination timetable is available from the department offices. Please check your subject dates and reach the examination hall 15 minutes early.",
    category: "Academics",
    priority: "HIGH",
    publishedAt: "2026-10-25",
    expiresAt: "2026-11-20",
  },
  {
    title: "Fee payment last date reminder",
    description: "Please clear outstanding semester fees by 10 November to avoid late charges. Contact the accounts office if you need help with payment.",
    category: "Fees",
    priority: "HIGH",
    publishedAt: "2026-10-26",
    expiresAt: "2026-11-10",
  },
  {
    title: "Attendance shortage review",
    description: "Students whose attendance is below the required threshold should meet their class advisor this week and discuss their attendance plan.",
    category: "Attendance",
    priority: "MEDIUM",
    publishedAt: "2026-10-20",
    expiresAt: "2026-10-28",
  },
  {
    title: "Annual sports day registration",
    description: "Registration for annual sports day events is open at the student activity desk. Submit your event choices by 12 November.",
    category: "Events",
    priority: "MEDIUM",
    publishedAt: "2026-10-27",
    expiresAt: "2026-11-18",
  },
  {
    title: "Parent-teacher meeting",
    description: "Parents and guardians are invited to meet faculty on 7 November between 10:00 AM and 1:00 PM to discuss student progress.",
    category: "Events",
    priority: "MEDIUM",
    publishedAt: "2026-10-23",
    expiresAt: "2026-11-07",
  },
  {
    title: "Campus holiday on 12 November",
    description: "The campus will remain closed on 12 November. Regular classes and office hours will resume the following working day.",
    category: "Holidays",
    priority: "LOW",
    publishedAt: "2026-10-28",
    expiresAt: "2026-11-12",
  },
  {
    title: "Assignment submission deadline",
    description: "Submit outstanding practical assignments to your subject teachers by 5 November. Late submissions should include a note to the faculty member.",
    category: "Assignments",
    priority: "MEDIUM",
    publishedAt: "2026-10-22",
    expiresAt: "2026-11-05",
  },
];

function dateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  let created = 0;
  for (const sample of samples) {
    const existing = await prisma.announcement.findFirst({
      where: { title: sample.title },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.announcement.create({
      data: {
        ...sample,
        publishedAt: dateOnly(sample.publishedAt),
        expiresAt: dateOnly(sample.expiresAt),
        isSample: true,
      },
    });
    created += 1;
  }

  const sampleCount = await prisma.announcement.count({ where: { isSample: true } });
  const totalCount = await prisma.announcement.count();
  console.log(`Created ${created} sample announcement(s); ${sampleCount} sample and ${totalCount} total announcements now exist.`);
}

main()
  .catch((error) => {
    console.error("Could not seed sample announcements:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
