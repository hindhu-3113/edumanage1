import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const departments = [
  { name: "Computer Science", code: "CSE" },
  { name: "Information Technology", code: "IT" },
  { name: "Electronics & Communication", code: "ECE" },
  { name: "Mechanical Engineering", code: "ME" },
  { name: "Business Administration", code: "MBA" },
];

const students = [
  { name: "Aarav Sharma", registerNo: "EDU2024001", email: "aarav.sharma@example.edu", phone: "+91 98765 43210", department: "CSE", academicYear: "Year 3" },
  { name: "Diya Patel", registerNo: "EDU2024002", email: "diya.patel@example.edu", phone: "+91 98765 43211", department: "IT", academicYear: "Year 2" },
  { name: "Rohan Mehta", registerNo: "EDU2024003", email: "rohan.mehta@example.edu", phone: "+91 98765 43212", department: "ECE", academicYear: "Year 4" },
  { name: "Ananya Iyer", registerNo: "EDU2024004", email: "ananya.iyer@example.edu", phone: "+91 98765 43213", department: "CSE", academicYear: "Year 1" },
  { name: "Kabir Nair", registerNo: "EDU2024005", email: "kabir.nair@example.edu", phone: "+91 98765 43214", department: "ME", academicYear: "Year 3" },
  { name: "Meera Reddy", registerNo: "EDU2024006", email: "meera.reddy@example.edu", phone: "+91 98765 43215", department: "IT", academicYear: "Year 2" },
  { name: "Ishaan Kapoor", registerNo: "EDU2024007", email: "ishaan.kapoor@example.edu", phone: "+91 98765 43216", department: "MBA", academicYear: "Year 1" },
  { name: "Sana Khan", registerNo: "EDU2024008", email: "sana.khan@example.edu", phone: "+91 98765 43217", department: "ECE", academicYear: "Year 4" },
];

async function main() {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name },
      create: department,
    });
  }

  for (const student of students) {
    const department = await prisma.department.findUniqueOrThrow({
      where: { code: student.department },
    });
    await prisma.student.upsert({
      where: { registerNo: student.registerNo },
      update: {
        name: student.name,
        email: student.email,
        phone: student.phone,
        academicYear: student.academicYear,
        departmentId: department.id,
      },
      create: {
        name: student.name,
        registerNo: student.registerNo,
        email: student.email,
        phone: student.phone,
        academicYear: student.academicYear,
        departmentId: department.id,
      },
    });
  }

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const seededStudents = await prisma.student.findMany({
    where: { registerNo: { in: students.map((student) => student.registerNo) } },
    orderBy: { registerNo: "asc" },
  });
  for (const [index, student] of seededStudents.entries()) {
    const status = index % 5 === 3 ? "ABSENT" : "PRESENT";
    await prisma.attendance.upsert({
      where: { studentId_date: { studentId: student.id, date: today } },
      update: { status },
      create: { studentId: student.id, date: today, status },
    });
  }

  console.log(`Seeded ${departments.length} departments and ${students.length} students.`);
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
