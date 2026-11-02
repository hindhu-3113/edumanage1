import { performancePrisma as prisma } from "@/lib/performance-prisma";
import { calculateStudentRisk, summarizeStudentRisks, type StudentRiskInput } from "@/lib/student-risk";

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      select: {
        id: true,
        name: true,
        registerNo: true,
        attendance: {
          select: { status: true },
        },
        performanceRecords: {
          select: {
            id: true,
            examName: true,
            marksObtainedHundredths: true,
            maximumMarksHundredths: true,
            createdAt: true,
            subject: { select: { name: true, code: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const results = students.map((student) => {
      const attendance = student.attendance.reduce(
        (counts, record) => {
          if (record.status === "PRESENT") counts.presentDays += 1;
          if (record.status === "ABSENT") counts.absentDays += 1;
          return counts;
        },
        { presentDays: 0, absentDays: 0 },
      );
      const input: StudentRiskInput = { ...student, ...attendance };
      return calculateStudentRisk(input);
    });

    return Response.json({
      summary: summarizeStudentRisks(results),
      students: results,
      methodology: {
        high: "Attendance below 60% or academic average below 40%.",
        medium: "Attendance below 75% or academic average below 60%, or a recent decline of at least 10 percentage points.",
        low: "All available factors meet the low-risk thresholds and no significant recent decline is found.",
        trend: "Trend is assessed only with at least three valid performance records, comparing earlier and more recent records.",
        score: "The 0–100 risk score averages severity points across available attendance and academic factors; missing factors are omitted, not scored as zero. A declining trend adds 15 points and improving trend subtracts 5.",
        disclaimer: "This is a transparent indicator from recorded data, not a guaranteed prediction of future academic outcomes.",
      },
    });
  } catch (error) {
    console.error("Failed to calculate student risk:", error);
    return Response.json({ error: "Could not calculate student risk analysis." }, { status: 500 });
  }
}
