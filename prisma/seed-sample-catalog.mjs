import { PrismaClient } from "@prisma/client-report";

const prisma = new PrismaClient();

const teacherSamples = [
  { name: "Dr. Kavita Rao", email: "kavita.rao.sample@edumanage.local", phone: "+91 98765 41001", qualification: "Ph.D. Computer Science", departmentCode: "CSE" },
  { name: "Prof. Arjun Desai", email: "arjun.desai.sample@edumanage.local", phone: "+91 98765 41002", qualification: "M.Tech. Information Technology", departmentCode: "IT" },
  { name: "Dr. Nisha Menon", email: "nisha.menon.sample@edumanage.local", phone: "+91 98765 41003", qualification: "Ph.D. Electronics", departmentCode: "ECE" },
  { name: "Prof. Vikram Joshi", email: "vikram.joshi.sample@edumanage.local", phone: "+91 98765 41004", qualification: "M.E. Mechanical Engineering", departmentCode: "ME" },
  { name: "Dr. Priya Kulkarni", email: "priya.kulkarni.sample@edumanage.local", phone: "+91 98765 41005", qualification: "Ph.D. Business Administration", departmentCode: "MBA" },
];

const subjectSamples = [
  { name: "Database Management Systems", code: "SAMPLE-DBMS" },
  { name: "Web Application Development", code: "SAMPLE-WEB" },
  { name: "Computer Networks", code: "SAMPLE-NET" },
  { name: "Digital Electronics", code: "SAMPLE-DIGI" },
  { name: "Engineering Mathematics", code: "SAMPLE-MATH" },
  { name: "Principles of Management", code: "SAMPLE-MGMT" },
];

async function main() {
  const departments = await prisma.department.findMany({ select: { id: true, code: true } });
  if (!departments.length) {
    throw new Error("Sample catalog seed requires existing departments.");
  }
  const departmentByCode = new Map(departments.map((department) => [department.code, department]));
  let teachersCreated = 0;
  for (const [index, sample] of teacherSamples.entries()) {
    const existing = await prisma.teacher.findUnique({
      where: { email: sample.email },
      select: { id: true },
    });
    if (existing) continue;

    const department = departmentByCode.get(sample.departmentCode) ?? departments[index % departments.length];
    await prisma.teacher.create({
      data: {
        name: sample.name,
        email: sample.email,
        phone: sample.phone,
        qualification: sample.qualification,
        departmentId: department.id,
        isSample: true,
      },
    });
    teachersCreated += 1;
  }

  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ academicYear: "asc" }, { name: "asc" }, { section: "asc" }] }),
    prisma.teacher.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!classes.length || !teachers.length) {
    throw new Error("Sample subject seed requires at least one existing class and one teacher.");
  }

  let subjectsCreated = 0;
  for (const [index, sample] of subjectSamples.entries()) {
    const existing = await prisma.subject.findUnique({
      where: { code: sample.code },
      select: { id: true },
    });
    if (existing) continue;

    const classRecord = classes[index % classes.length];
    const teacher = teachers[index % teachers.length];
    await prisma.subject.create({
      data: {
        name: sample.name,
        code: sample.code,
        isSample: true,
        classes: { create: [{ class: { connect: { id: classRecord.id } } }] },
        teachers: { create: [{ teacher: { connect: { id: teacher.id } } }] },
      },
    });
    subjectsCreated += 1;
  }

  const sampleTeachers = await prisma.teacher.count({ where: { isSample: true } });
  const sampleSubjects = await prisma.subject.count({ where: { isSample: true } });
  console.log(`Created ${teachersCreated} teacher and ${subjectsCreated} subject sample(s); now ${sampleTeachers} sample teachers and ${sampleSubjects} sample subjects exist.`);
}

main()
  .catch((error) => {
    console.error("Could not seed sample teachers and subjects:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
