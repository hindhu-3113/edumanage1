import { performancePrisma as prisma } from "@/lib/performance-prisma";
import { timetablePrisma } from "@/lib/timetable-prisma";
import { announcementPrisma } from "@/lib/announcement-prisma";
import { dateKey, getCurrentDateKey } from "@/lib/dates";
import { calculateStudentRisk, summarizeStudentRisks, type RiskPerformanceRecord } from "@/lib/student-risk";

const ATTENDANCE_ALERT_THRESHOLD = 75;

export async function GET() {
  try {
    const today = getCurrentDateKey();
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startKey = dateKey(start);
    const [
      totalStudents,
      totalDepartments,
      totalTeachers,
      totalClasses,
      totalSubjects,
      todaysRecords,
      weeklyGroups,
      recentStudents,
      students,
      attendanceByStudent,
      performanceRecords,
      todaySchedule,
      activeAnnouncements,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.department.count(),
      prisma.teacher.count(),
      prisma.class.count(),
      prisma.subject.count(),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { date: today },
        _count: { _all: true },
      }),
      prisma.attendance.groupBy({
        by: ["date", "status"],
        where: { date: { gte: startKey, lte: today } },
        _count: { _all: true },
      }),
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { department: true },
      }),
      prisma.student.findMany({
        select: {
          id: true,
          name: true,
          registerNo: true,
          department: { select: { name: true, code: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where: { status: { in: ["PRESENT", "ABSENT"] } },
        _count: { _all: true },
      }),
      prisma.performanceRecord.findMany({
        select: {
          id: true,
          examName: true,
          marksObtainedHundredths: true,
          maximumMarksHundredths: true,
          createdAt: true,
          subject: { select: { id: true, name: true, code: true } },
          studentId: true,
        },
      }),
      timetablePrisma.timetableEntry.findMany({
        where: { dayOfWeek: todayName },
        include: {
          class: { select: { name: true, section: true } },
          subject: { select: { name: true, code: true } },
          teacher: { select: { name: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      announcementPrisma.announcement.count({
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) } },
          ],
        },
      }),
    ]);

    const presentToday = todaysRecords.find((row) => row.status === "PRESENT")?._count._all ?? 0;
    const absentToday = todaysRecords.find((row) => row.status === "ABSENT")?._count._all ?? 0;
    const markedToday = presentToday + absentToday;
    const attendanceByDate = new Map<string, { present: number; absent: number }>();
    for (const row of weeklyGroups) {
      const current = attendanceByDate.get(row.date) ?? { present: 0, absent: 0 };
      if (row.status === "PRESENT") current.present = row._count._all;
      if (row.status === "ABSENT") current.absent = row._count._all;
      attendanceByDate.set(row.date, current);
    }

    const weeklyAttendance = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = dateKey(date);
      return { date: key, ...(attendanceByDate.get(key) ?? { present: 0, absent: 0 }) };
    });

    const attendanceByStudentId = new Map<string, { present: number; absent: number }>();
    for (const row of attendanceByStudent) {
      const current = attendanceByStudentId.get(row.studentId) ?? { present: 0, absent: 0 };
      if (row.status === "PRESENT") current.present = row._count._all;
      if (row.status === "ABSENT") current.absent = row._count._all;
      attendanceByStudentId.set(row.studentId, current);
    }

    const lowAttendanceAlerts = students.flatMap((student) => {
      const counts = attendanceByStudentId.get(student.id) ?? { present: 0, absent: 0 };
      const totalRecordedDays = counts.present + counts.absent;
      if (!totalRecordedDays) return [];

      const exactPercentage = (counts.present / totalRecordedDays) * 100;
      if (exactPercentage >= ATTENDANCE_ALERT_THRESHOLD) return [];

      return [{
        id: student.id,
        name: student.name,
        registerNo: student.registerNo,
        department: student.department,
        totalRecordedDays,
        presentDays: counts.present,
        attendancePercentage: Math.round(exactPercentage * 10) / 10,
      }];
    });

    const performanceBySubject = new Map<string, {
      subjectId: string;
      name: string;
      code: string;
      totalPercentage: number;
      recordCount: number;
    }>();
    let totalPerformancePercentage = 0;
    const assessedStudentIds = new Set<string>();
    for (const record of performanceRecords) {
      const score = (record.marksObtainedHundredths / record.maximumMarksHundredths) * 100;
      totalPerformancePercentage += score;
      assessedStudentIds.add(record.studentId);
      const current = performanceBySubject.get(record.subject.id) ?? {
        subjectId: record.subject.id,
        name: record.subject.name,
        code: record.subject.code,
        totalPercentage: 0,
        recordCount: 0,
      };
      current.totalPercentage += score;
      current.recordCount += 1;
      performanceBySubject.set(record.subject.id, current);
    }
    const performanceBySubjectSummary = Array.from(performanceBySubject.values())
      .map(({ totalPercentage, ...subject }) => ({
        ...subject,
        averagePercentage: Math.round((totalPercentage / subject.recordCount) * 100) / 100,
      }))
      .sort((left, right) => right.averagePercentage - left.averagePercentage)
      .slice(0, 6);

    const performanceByStudentId = new Map<string, RiskPerformanceRecord[]>();
    for (const record of performanceRecords) {
      const current = performanceByStudentId.get(record.studentId) ?? [];
      current.push(record);
      performanceByStudentId.set(record.studentId, current);
    }
    const studentRiskSummary = summarizeStudentRisks(students.map((student) => {
      const attendance = attendanceByStudentId.get(student.id) ?? { present: 0, absent: 0 };
      return calculateStudentRisk({
        id: student.id,
        name: student.name,
        registerNo: student.registerNo,
        presentDays: attendance.present,
        absentDays: attendance.absent,
        performanceRecords: performanceByStudentId.get(student.id) ?? [],
      });
    }));

    return Response.json({
      today,
      totalStudents,
      totalDepartments,
      totalTeachers,
      totalClasses,
      totalSubjects,
      activeAnnouncements,
      studentRiskSummary,
      presentToday,
      absentToday,
      markedToday,
      attendanceRate: totalStudents ? Math.round((presentToday / totalStudents) * 100) : 0,
      weeklyAttendance,
      recentStudents,
      attendanceAlertThreshold: ATTENDANCE_ALERT_THRESHOLD,
      lowAttendanceAlerts,
      performanceSummary: {
        recordCount: performanceRecords.length,
        assessedStudentCount: assessedStudentIds.size,
        averagePercentage: performanceRecords.length
          ? Math.round((totalPerformancePercentage / performanceRecords.length) * 100) / 100
          : 0,
        subjectAverages: performanceBySubjectSummary,
      },
      todaySchedule,
    });
  } catch (error) {
    console.error("Failed to load dashboard:", error);
    return Response.json({ error: "Could not load dashboard data." }, { status: 500 });
  }
}
