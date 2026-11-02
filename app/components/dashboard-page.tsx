"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "@/app/components/icons";

type DashboardData = {
  today: string;
  totalStudents: number;
  totalDepartments: number;
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  activeAnnouncements: number;
  studentRiskSummary: {
    totalStudents: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    insufficientData: number;
  };
  presentToday: number;
  absentToday: number;
  markedToday: number;
  attendanceRate: number;
  weeklyAttendance: { date: string; present: number; absent: number }[];
  attendanceAlertThreshold: number;
  lowAttendanceAlerts: {
    id: string;
    name: string;
    registerNo: string;
    department: { name: string; code: string };
    totalRecordedDays: number;
    presentDays: number;
    attendancePercentage: number;
  }[];
  performanceSummary: {
    recordCount: number;
    assessedStudentCount: number;
    averagePercentage: number;
    subjectAverages: { subjectId: string; name: string; code: string; averagePercentage: number; recordCount: number }[];
  };
  todaySchedule: {
    id: string;
    startTime: string;
    endTime: string;
    roomNumber: string;
    class: { name: string; section: string };
    subject: { name: string; code: string };
    teacher: { name: string };
  }[];
  recentStudents: {
    id: string;
    name: string;
    registerNo: string;
    status: "ENROLLED";
    academicYear: string;
    department: { name: string; code: string };
  }[];
};

async function requestDashboard(): Promise<DashboardData> {
  const response = await fetch("/api/dashboard");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load dashboard.");
  return result as DashboardData;
}

function prettyDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", options);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setData(await requestDashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void requestDashboard().then((result) => {
      if (active) setData(result);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load dashboard.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadDashboard();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadDashboard]);

  return (
    <>
      <div className="page-heading heading-dashboard">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR CAMPUS, AT A GLANCE</div>
          <h1>Good morning, {session?.user?.name?.split(" ")[0] ?? "there"} <span className="wave">✦</span></h1>
          <p>Here’s what’s happening across your institution today.</p>
        </div>
        <Link href="/students" className="button button-primary"><Icon name="plus" size={18} /> Add student</Link>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => void loadDashboard()}>Try again</button></div>}
      {loading ? (
        <div className="loading-panel"><span className="spinner" /> Loading your dashboard…</div>
      ) : data ? (
        <>
          <section className="stats-grid" aria-label="Institution overview">
            <StatCard label="Total students" value={data.totalStudents} detail="Across all academic years" icon="students" tone="blue" footer="Enrolled students" />
            <StatCard label="Departments" value={data.totalDepartments} detail="Academic departments" icon="building" tone="violet" footer="Active departments" />
            <StatCard label="Teachers" value={data.totalTeachers} detail="Registered teachers" icon="students" tone="blue" footer="Teaching staff" />
            <StatCard label="Classes" value={data.totalClasses} detail="Configured classes" icon="building" tone="violet" footer="Class groups" />
            <StatCard label="Subjects" value={data.totalSubjects} detail="Available subjects" icon="building" tone="green" footer="Subject catalog" />
            <Link href="/announcements" aria-label={`${data.activeAnnouncements} active announcements`}>
              <StatCard label="Active announcements" value={data.activeAnnouncements} detail="Campus updates in date" icon="mail" tone="orange" footer="Announcement board" />
            </Link>
            <StatCard label="Present today" value={data.presentToday} detail={`${data.attendanceRate}% of enrolled students`} icon="attendance" tone="green" footer="Attendance rate" progress={data.attendanceRate} />
            <StatCard label="Absent today" value={data.absentToday} detail={`${Math.max(0, data.totalStudents - data.markedToday)} not yet marked`} icon="clock" tone="orange" footer="Daily attendance" />
          </section>

          <section className="dashboard-grid">
            <article className="panel attendance-overview">
              <div className="panel-header">
                <div><h2>Attendance overview</h2><p>Daily attendance for the last 7 days</p></div>
                <Link href="/attendance" className="subtle-link">View attendance <Icon name="arrow" size={15} /></Link>
              </div>
              <div className="chart-legend"><span><i className="legend-dot legend-present" /> Present</span><span><i className="legend-dot legend-absent" /> Absent</span></div>
              <div className="chart-area">
                <div className="chart-y-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
                <div className="chart">
                  {[0, 25, 50, 75, 100].map((line) => <div key={line} className="chart-gridline" style={{ bottom: `${line}%` }} />)}
                  <div className="chart-bars">
                    {data.weeklyAttendance.map((day) => {
                      const total = day.present + day.absent;
                      const presentHeight = data.totalStudents ? (day.present / data.totalStudents) * 100 : 0;
                      const absentHeight = data.totalStudents ? (day.absent / data.totalStudents) * 100 : 0;
                      return (
                        <div className="chart-day" key={day.date}>
                          <div className="bar-stack" title={`${day.present} present, ${day.absent} absent`}>
                            {total > 0 ? <>
                              <div className="bar-present" style={{ height: `${Math.min(presentHeight, 100)}%` }} />
                              <div className="bar-absent" style={{ height: `${Math.min(absentHeight, 100)}%` }} />
                            </> : <div className="bar-empty" />}
                          </div>
                          <span>{prettyDate(day.date, { weekday: "short" })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="chart-footnote"><span><i className="legend-dot legend-present" /> {data.presentToday} present today</span><span><i className="legend-dot legend-absent" /> {data.absentToday} absent today</span></div>
            </article>

            <article className="panel quick-attendance">
              <div className="panel-header"><div><h2>Today’s attendance</h2><p>{prettyDate(data.today, { weekday: "long", day: "numeric", month: "long" })}</p></div><span className="calendar-chip"><Icon name="calendar" size={17} /></span></div>
              <div className="attendance-donut-wrap">
                <div className="attendance-donut" style={{ "--rate": `${data.attendanceRate}%` } as React.CSSProperties}>
                  <div><strong>{data.attendanceRate}%</strong><span>attendance</span></div>
                </div>
              </div>
              <div className="attendance-summary">
                <div><span className="summary-label"><i className="legend-dot legend-present" /> Present</span><strong>{data.presentToday}</strong></div>
                <div><span className="summary-label"><i className="legend-dot legend-absent" /> Absent</span><strong>{data.absentToday}</strong></div>
              </div>
              <Link className="button button-light button-full" href="/attendance">Take attendance <Icon name="arrow" size={16} /></Link>
            </article>
          </section>

          <section className="panel low-attendance-panel" aria-labelledby="low-attendance-heading">
            <div className="panel-header">
              <div>
                <h2 id="low-attendance-heading">Low Attendance Alerts <span className="alert-count">{data.lowAttendanceAlerts.length}</span></h2>
                <p>Students below the {data.attendanceAlertThreshold}% attendance threshold, based on recorded days</p>
              </div>
              <span className="warning-badge"><span aria-hidden="true">!</span> Needs attention</span>
            </div>
            {data.lowAttendanceAlerts.length ? (
              <div className="table-scroll">
                <table className="data-table low-attendance-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>DEPARTMENT</th>
                      <th>RECORDED DAYS</th>
                      <th>PRESENT DAYS</th>
                      <th>ATTENDANCE</th>
                      <th>ALERT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lowAttendanceAlerts.map((student, index) => (
                      <tr key={student.id}>
                        <td>
                          <div className="student-cell">
                            <div className={`avatar avatar-${index % 4}`}>{getInitials(student.name)}</div>
                            <div className="alert-student-name"><strong>{student.name}</strong><span>{student.registerNo}</span></div>
                          </div>
                        </td>
                        <td><span className="department-badge">{student.department.code}</span> <span className="muted-cell department-name">{student.department.name}</span></td>
                        <td className="muted-cell">{student.totalRecordedDays}</td>
                        <td className="muted-cell">{student.presentDays}</td>
                        <td><strong className="low-attendance-percent">{student.attendancePercentage.toFixed(1)}%</strong></td>
                        <td><span className="warning-badge warning-badge-row"><span aria-hidden="true">!</span> Below {data.attendanceAlertThreshold}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="alerts-empty-state">
                <span className="alerts-empty-icon"><Icon name="check" size={18} /></span>
                <div><strong>No low attendance alerts</strong><p>Students with no recorded attendance are not counted as absent.</p></div>
              </div>
            )}
          </section>

          <section className="panel dashboard-risk-summary" aria-labelledby="dashboard-risk-heading">
            <div className="panel-header">
              <div><h2 id="dashboard-risk-heading">Student risk summary</h2><p>Support indicators based on available attendance and academic records</p></div>
              <Link href="/risk-analysis" className="subtle-link">View risk analysis <Icon name="arrow" size={15} /></Link>
            </div>
            <div className="dashboard-risk-counts">
              <div className="risk-count-high"><span>High risk</span><strong>{data.studentRiskSummary.highRisk}</strong></div>
              <div className="risk-count-medium"><span>Medium risk</span><strong>{data.studentRiskSummary.mediumRisk}</strong></div>
              <div className="risk-count-low"><span>Low risk</span><strong>{data.studentRiskSummary.lowRisk}</strong></div>
              <div className="risk-count-unknown"><span>Insufficient data</span><strong>{data.studentRiskSummary.insufficientData}</strong></div>
            </div>
          </section>

          <section className="performance-dashboard-grid" aria-label="Performance analytics">
            <article className="panel performance-summary-panel">
              <div className="panel-header">
                <div><h2>Performance snapshot</h2><p>Academic results across recorded exams</p></div>
                <Link href="/performance" className="subtle-link">Manage results <Icon name="arrow" size={15} /></Link>
              </div>
              <div className="performance-dashboard-stats">
                <div><span>Average score</span><strong>{data.performanceSummary.averagePercentage.toFixed(1)}%</strong></div>
                <div><span>Exam records</span><strong>{data.performanceSummary.recordCount}</strong></div>
                <div><span>Students assessed</span><strong>{data.performanceSummary.assessedStudentCount}</strong></div>
              </div>
            </article>
            <article className="panel performance-chart-panel">
              <div className="panel-header"><div><h2>Subject performance</h2><p>Average percentage by subject</p></div></div>
              {data.performanceSummary.subjectAverages.length ? (
                <div className="performance-bars">
                  {data.performanceSummary.subjectAverages.map((subject) => (
                    <div className="performance-bar-row" key={subject.subjectId}>
                      <div className="performance-bar-label"><span title={subject.name}>{subject.name}</span><strong>{subject.averagePercentage.toFixed(1)}%</strong></div>
                      <div className="performance-track" role="progressbar" aria-label={`${subject.name} average`} aria-valuenow={subject.averagePercentage} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${Math.min(subject.averagePercentage, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="performance-empty">No performance records yet. Add exam results to see progress here.</div>}
            </article>
          </section>

          <section className="panel timetable-dashboard-panel">
            <div className="panel-header">
              <div><h2>Today’s schedule</h2><p>Classes scheduled for {prettyDate(data.today, { weekday: "long", day: "numeric", month: "long" })}</p></div>
              <Link href="/timetable" className="subtle-link">Manage timetable <Icon name="arrow" size={15} /></Link>
            </div>
            {data.todaySchedule.length ? (
              <div className="timetable-dashboard-list">
                {data.todaySchedule.map((entry) => (
                  <div className="timetable-dashboard-item" key={entry.id}>
                    <strong>{entry.startTime}–{entry.endTime}</strong>
                    <span><b>{entry.subject.name}</b><small>{entry.class.name} · {entry.class.section} · {entry.teacher.name}</small></span>
                    <span className="timetable-room">{entry.roomNumber}</span>
                  </div>
                ))}
              </div>
            ) : <div className="performance-empty">No classes are scheduled for today.</div>}
          </section>

          <section className="panel recent-panel">
            <div className="panel-header">
              <div><h2>Recently added students</h2><p>Your newest members of the campus community</p></div>
              <Link href="/students" className="subtle-link">View all students <Icon name="arrow" size={15} /></Link>
            </div>
            {data.recentStudents.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>STUDENT</th><th>REGISTER NO.</th><th>DEPARTMENT</th><th>YEAR</th><th>STATUS</th></tr></thead>
                  <tbody>{data.recentStudents.map((student, index) => (
                    <tr key={student.id}>
                      <td><div className="student-cell"><div className={`avatar avatar-${index % 4}`}>{getInitials(student.name)}</div><strong>{student.name}</strong></div></td>
                      <td className="muted-cell">{student.registerNo}</td>
                      <td><span className="department-badge">{student.department.code}</span> <span className="muted-cell">{student.department.name}</span></td>
                      <td className="muted-cell">{student.academicYear}</td>
                      <td><span className="status-badge status-enrolled"><i />{student.status === "ENROLLED" ? "Enrolled" : "Unknown"}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="empty-state"><span className="empty-icon"><Icon name="students" /></span><strong>No students yet</strong><p>Add your first student to get started.</p><Link className="button button-primary button-small" href="/students"><Icon name="plus" size={16} /> Add student</Link></div>}
          </section>
          <footer className="page-footer"><span>© 2025 EduManage. Made for brighter futures.</span><span>All systems operational <i className="status-dot" /></span></footer>
        </>
      ) : null}
    </>
  );
}

function StatCard({
  label, value, detail, icon, tone, footer, progress,
}: {
  label: string;
  value: number;
  detail: string;
  icon: "students" | "building" | "attendance" | "clock" | "mail";
  tone: string;
  footer: string;
  progress?: number;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{label}</span><span className={`stat-icon stat-icon-${tone}`}><Icon name={icon} size={19} /></span></div>
      <div className="stat-value">{value.toLocaleString("en-IN")}</div>
      <div className="stat-detail">{detail}</div>
      <div className="stat-footer">
        {progress !== undefined ? <div className="progress-track"><span style={{ width: `${progress}%` }} /></div> : <span className={`stat-spark stat-spark-${tone}`}>↗</span>}
        <span>{footer}</span>
      </div>
    </article>
  );
}

export function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}
