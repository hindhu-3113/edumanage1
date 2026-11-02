export type RiskPerformanceRecord = {
  id: string;
  examName: string;
  marksObtainedHundredths: number;
  maximumMarksHundredths: number;
  createdAt: Date | string;
  subject: { name: string; code: string };
};

export type StudentRiskInput = {
  id: string;
  name: string;
  registerNo: string;
  presentDays: number;
  absentDays: number;
  performanceRecords: RiskPerformanceRecord[];
};

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export type StudentRiskResult = {
  student: { id: string; name: string; registerNo: string };
  riskLevel: RiskLevel;
  riskScore: number | null;
  attendance: {
    presentDays: number;
    absentDays: number;
    totalDays: number;
    percentage: number | null;
  };
  academicAverage: number | null;
  performanceRecordCount: number;
  performanceTrend: {
    status: "INSUFFICIENT_DATA" | "STABLE" | "DECLINING" | "IMPROVING";
    baselineAverage: number | null;
    recentAverage: number | null;
    change: number | null;
  };
  reasons: string[];
  suggestedAction: string;
  performanceRecords: (RiskPerformanceRecord & { percentage: number })[];
};

function scorePercentage(record: RiskPerformanceRecord): number | null {
  const { marksObtainedHundredths: marks, maximumMarksHundredths: maximum } = record;
  if (
    !Number.isFinite(marks) ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    marks < 0 ||
    marks > maximum
  ) return null;
  return (marks / maximum) * 100;
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateStudentRisk(input: StudentRiskInput): StudentRiskResult {
  const presentDays = Math.max(0, input.presentDays);
  const absentDays = Math.max(0, input.absentDays);
  const totalDays = presentDays + absentDays;
  const attendancePercentage = totalDays ? (presentDays / totalDays) * 100 : null;
  const performanceRecords = input.performanceRecords.flatMap((record) => {
    const percentage = scorePercentage(record);
    return percentage === null ? [] : [{ ...record, percentage }];
  });
  const academicAverage = performanceRecords.length
    ? performanceRecords.reduce((sum, record) => sum + record.percentage, 0) / performanceRecords.length
    : null;

  const chronologicalScores = [...performanceRecords]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  let trend: StudentRiskResult["performanceTrend"] = {
    status: "INSUFFICIENT_DATA",
    baselineAverage: null,
    recentAverage: null,
    change: null,
  };
  if (chronologicalScores.length >= 3) {
    const splitAt = Math.floor(chronologicalScores.length / 2);
    const baseline = chronologicalScores.slice(0, splitAt);
    const recent = chronologicalScores.slice(splitAt);
    const baselineAverage = baseline.reduce((sum, record) => sum + record.percentage, 0) / baseline.length;
    const recentAverage = recent.reduce((sum, record) => sum + record.percentage, 0) / recent.length;
    const change = recentAverage - baselineAverage;
    trend = {
      status: change <= -10 ? "DECLINING" : change >= 10 ? "IMPROVING" : "STABLE",
      baselineAverage: rounded(baselineAverage),
      recentAverage: rounded(recentAverage),
      change: rounded(change),
    };
  }

  const reasons: string[] = [];
  const supportActions: string[] = [];
  const factorPoints: number[] = [];
  let highFactor = false;
  let mediumFactor = false;

  if (attendancePercentage !== null) {
    if (attendancePercentage < 60) {
      highFactor = true;
      factorPoints.push(50);
      reasons.push(`Attendance is ${rounded(attendancePercentage)}%, below the 60% high-risk threshold.`);
      supportActions.push("Meet with the student and advisor to agree on a weekly attendance support plan.");
    } else if (attendancePercentage < 75) {
      mediumFactor = true;
      factorPoints.push(25);
      reasons.push(`Attendance is ${rounded(attendancePercentage)}%, below the 75% low-risk threshold.`);
      supportActions.push("Check barriers to attendance and review progress with the student next week.");
    } else {
      factorPoints.push(0);
    }
  }

  if (academicAverage !== null) {
    if (academicAverage < 40) {
      highFactor = true;
      factorPoints.push(50);
      reasons.push(`Average academic score is ${rounded(academicAverage)}%, below the 40% high-risk threshold.`);
      supportActions.push("Arrange subject-level tutoring and review recent assessment gaps with the student.");
    } else if (academicAverage < 60) {
      mediumFactor = true;
      factorPoints.push(25);
      reasons.push(`Average academic score is ${rounded(academicAverage)}%, below the 60% low-risk threshold.`);
      supportActions.push("Recommend focused revision and review the next assessment results.");
    } else {
      factorPoints.push(0);
    }
  }

  const declining = trend.status === "DECLINING";
  if (declining) {
    reasons.push(`Recent performance declined by ${Math.abs(trend.change ?? 0)} percentage points compared with earlier records.`);
    supportActions.push("Discuss the recent academic trend and offer targeted support.");
  }

  const availableFactors = factorPoints.length;
  const baseScore = availableFactors
    ? (factorPoints.reduce((sum, points) => sum + points, 0) / (availableFactors * 50)) * 100
    : null;
  const riskScore = baseScore === null
    ? null
    : rounded(Math.max(0, Math.min(100, baseScore + (declining ? 15 : trend.status === "IMPROVING" ? -5 : 0))));

  let riskLevel: RiskLevel;
  if (!availableFactors) {
    riskLevel = "INSUFFICIENT_DATA";
    reasons.push("No valid attendance or academic records are available to assess this student.");
  } else if (highFactor) {
    riskLevel = "HIGH";
  } else if (mediumFactor || declining) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
    reasons.push("All available attendance and academic indicators meet the low-risk thresholds.");
  }

  if (attendancePercentage === null) reasons.push("Attendance data is not available; it was not treated as zero.");
  if (academicAverage === null) reasons.push("Academic data is not available; it was not treated as zero.");

  const suggestedAction = supportActions.length
    ? supportActions.join(" ")
    : riskLevel === "LOW"
      ? "Continue routine check-ins and encourage the student to maintain current progress."
      : "Collect attendance and assessment records before assigning a support plan.";

  return {
    student: { id: input.id, name: input.name, registerNo: input.registerNo },
    riskLevel,
    riskScore,
    attendance: {
      presentDays,
      absentDays,
      totalDays,
      percentage: attendancePercentage === null ? null : rounded(attendancePercentage),
    },
    academicAverage: academicAverage === null ? null : rounded(academicAverage),
    performanceRecordCount: performanceRecords.length,
    performanceTrend: trend,
    reasons,
    suggestedAction,
    performanceRecords: performanceRecords.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  };
}

export function summarizeStudentRisks(results: StudentRiskResult[]) {
  return {
    totalStudents: results.length,
    highRisk: results.filter((result) => result.riskLevel === "HIGH").length,
    mediumRisk: results.filter((result) => result.riskLevel === "MEDIUM").length,
    lowRisk: results.filter((result) => result.riskLevel === "LOW").length,
    insufficientData: results.filter((result) => result.riskLevel === "INSUFFICIENT_DATA").length,
  };
}
