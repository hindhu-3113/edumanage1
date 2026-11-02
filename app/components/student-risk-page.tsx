"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/components/icons";
import type { RiskLevel, StudentRiskResult } from "@/lib/student-risk";

type RiskSummary = {
  totalStudents: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  insufficientData: number;
};

type RiskData = {
  summary: RiskSummary;
  students: StudentRiskResult[];
  methodology: {
    high: string;
    medium: string;
    low: string;
    trend: string;
    score: string;
    disclaimer: string;
  };
};

const riskFilters: { value: RiskLevel | ""; label: string }[] = [
  { value: "", label: "All risk levels" },
  { value: "HIGH", label: "High risk" },
  { value: "MEDIUM", label: "Medium risk" },
  { value: "LOW", label: "Low risk" },
  { value: "INSUFFICIENT_DATA", label: "Insufficient data" },
];

function getErrorMessage(result: unknown): string {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : "Could not load student risk analysis.";
}

function riskLabel(risk: RiskLevel): string {
  return risk === "INSUFFICIENT_DATA" ? "Insufficient Data" : `${risk[0]}${risk.slice(1).toLowerCase()} Risk`;
}

export default function StudentRiskPage() {
  const [data, setData] = useState<RiskData | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "">("");
  const [selectedStudent, setSelectedStudent] = useState<StudentRiskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/student-risk")
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result));
        return result as RiskData;
      })
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load student risk analysis.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (data?.students ?? []).filter((student) => {
      const matchesSearch = !query ||
        student.student.name.toLocaleLowerCase().includes(query) ||
        student.student.registerNo.toLocaleLowerCase().includes(query);
      return matchesSearch && (!riskFilter || student.riskLevel === riskFilter);
    });
  }, [data, riskFilter, search]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> STUDENT SUPPORT</div>
          <h1>Student Risk Analysis</h1>
          <p>Use recorded attendance and assessment trends to help prioritize student support.</p>
        </div>
        <span className="risk-disclaimer-chip"><Icon name="filter" size={15} /> Support indicator, not a prediction</span>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => window.location.reload()}>Try again</button></div>}
      {loading ? (
        <div className="loading-panel"><span className="spinner" /> Analyzing available student records…</div>
      ) : data ? (
        <>
          <section className="risk-summary-grid" aria-label="Student risk totals">
            <RiskSummaryCard label="Students analyzed" value={data.summary.totalStudents} tone="blue" />
            <RiskSummaryCard label="High risk" value={data.summary.highRisk} tone="high" />
            <RiskSummaryCard label="Medium risk" value={data.summary.mediumRisk} tone="medium" />
            <RiskSummaryCard label="Low risk" value={data.summary.lowRisk} tone="low" />
            <RiskSummaryCard label="Insufficient data" value={data.summary.insufficientData} tone="unknown" />
          </section>

          <section className="panel risk-record-panel">
            <div className="student-toolbar risk-toolbar">
              <div className="directory-title">
                <div><h2>Student support overview <span className="count-chip">{filteredStudents.length}</span></h2><p>Search a student and open their record for a detailed explanation</p></div>
              </div>
              <div className="toolbar-actions risk-filters">
                <label className="search-field">
                  <Icon name="search" size={17} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students…" aria-label="Search by student name or ID" />
                </label>
                <label className="sr-only" htmlFor="student-risk-filter">Filter by risk level</label>
                <select id="student-risk-filter" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskLevel | "")}>
                  {riskFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                </select>
              </div>
            </div>

            {filteredStudents.length ? (
              <div className="table-scroll risk-table-scroll">
                <table className="data-table risk-table">
                  <thead><tr><th>STUDENT</th><th>ATTENDANCE</th><th>ACADEMIC AVG.</th><th>RISK SCORE</th><th>RISK LEVEL</th><th>MAIN REASONS</th><th>SUPPORT ACTION</th></tr></thead>
                  <tbody>
                    {filteredStudents.map((result) => (
                      <tr key={result.student.id} className="risk-data-row" onClick={() => setSelectedStudent(result)}>
                        <td><button className="risk-student-link" onClick={() => setSelectedStudent(result)}><strong>{result.student.name}</strong><span>{result.student.registerNo}</span></button></td>
                        <td>{result.attendance.percentage === null ? <span className="risk-missing">No data</span> : <strong>{result.attendance.percentage.toFixed(1)}%</strong>}</td>
                        <td>{result.academicAverage === null ? <span className="risk-missing">No data</span> : <strong>{result.academicAverage.toFixed(1)}%</strong>}</td>
                        <td>{result.riskScore === null ? <span className="risk-missing">—</span> : <strong>{result.riskScore.toFixed(0)} / 100</strong>}</td>
                        <td><span className={`risk-level-badge risk-level-${result.riskLevel.toLowerCase()}`}>{riskLabel(result.riskLevel)}</span></td>
                        <td className="risk-reason-cell">{result.reasons.slice(0, 2).join(" ")}</td>
                        <td className="risk-action-cell">{result.suggestedAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state risk-empty">
                <span className="empty-icon"><Icon name="search" size={21} /></span>
                <strong>{data.students.length ? "No matching students" : "No student records available"}</strong>
                <p>{data.students.length ? "Try another name, student ID, or risk level." : "Students will appear here once they are added."}</p>
              </div>
            )}
          </section>

          <section className="panel risk-methodology-panel">
            <div className="panel-header"><div><h2>How risk is calculated</h2><p>Rules are transparent and based only on valid records available for each student.</p></div></div>
            <div className="risk-methodology-grid">
              <div><span className="risk-level-badge risk-level-high">High risk</span><p>{data.methodology.high}</p></div>
              <div><span className="risk-level-badge risk-level-medium">Medium risk</span><p>{data.methodology.medium}</p></div>
              <div><span className="risk-level-badge risk-level-low">Low risk</span><p>{data.methodology.low}</p></div>
              <div><span className="risk-level-badge risk-level-insufficient_data">Insufficient data</span><p>No valid attendance or academic records are available. Missing factors are never treated as zero.</p></div>
            </div>
            <p className="risk-trend-note">{data.methodology.trend} {data.methodology.score}</p>
            <p className="risk-disclaimer">{data.methodology.disclaimer}</p>
          </section>
        </>
      ) : null}

      {selectedStudent && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStudent(null); }}>
          <section className="modal-card risk-details-modal" role="dialog" aria-modal="true" aria-labelledby="risk-details-title">
            <div className="modal-header">
              <div><div className="eyebrow"><span className="eyebrow-line" /> STUDENT SUPPORT PROFILE</div><h2 id="risk-details-title">{selectedStudent.student.name}</h2><p>{selectedStudent.student.registerNo}</p></div>
              <button className="icon-button" aria-label="Close risk details" onClick={() => setSelectedStudent(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="risk-details-score">
              <span className={`risk-level-badge risk-level-${selectedStudent.riskLevel.toLowerCase()}`}>{riskLabel(selectedStudent.riskLevel)}</span>
              <strong>{selectedStudent.riskScore === null ? "—" : `${selectedStudent.riskScore.toFixed(0)} / 100`}</strong>
              <small>Calculated support indicator</small>
            </div>
            <div className="risk-detail-metrics">
              <div><span>Attendance</span><strong>{selectedStudent.attendance.percentage === null ? "Insufficient data" : `${selectedStudent.attendance.percentage.toFixed(1)}%`}</strong><small>{selectedStudent.attendance.presentDays} present · {selectedStudent.attendance.absentDays} absent · {selectedStudent.attendance.totalDays} recorded</small></div>
              <div><span>Academic average</span><strong>{selectedStudent.academicAverage === null ? "Insufficient data" : `${selectedStudent.academicAverage.toFixed(1)}%`}</strong><small>{selectedStudent.performanceRecordCount} valid exam record(s)</small></div>
              <div><span>Recent performance trend</span><strong>{selectedStudent.performanceTrend.status === "INSUFFICIENT_DATA" ? "Insufficient history" : selectedStudent.performanceTrend.status[0] + selectedStudent.performanceTrend.status.slice(1).toLowerCase()}</strong><small>{selectedStudent.performanceTrend.change === null ? "At least 3 records are needed" : `${selectedStudent.performanceTrend.change > 0 ? "+" : ""}${selectedStudent.performanceTrend.change.toFixed(1)} percentage points`}</small></div>
            </div>
            <section className="risk-detail-section">
              <h3>Contributing factors</h3>
              <ul>{selectedStudent.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </section>
            <section className="risk-detail-section risk-support-action">
              <h3>Suggested support action</h3>
              <p>{selectedStudent.suggestedAction}</p>
            </section>
            <section className="risk-detail-section">
              <h3>Available performance records</h3>
              {selectedStudent.performanceRecords.length ? (
                <div className="risk-performance-list">
                  {selectedStudent.performanceRecords.map((record) => (
                    <div key={record.id}>
                      <span><strong>{record.subject.name}</strong><small>{record.examName} · {(record.marksObtainedHundredths / 100).toLocaleString("en-IN")} / {(record.maximumMarksHundredths / 100).toLocaleString("en-IN")}</small></span>
                      <b>{record.percentage.toFixed(1)}%</b>
                    </div>
                  ))}
                </div>
              ) : <p className="risk-missing">No valid performance records are available.</p>}
            </section>
            <p className="risk-disclaimer">This indicator summarizes recorded information and does not guarantee future academic outcomes.</p>
          </section>
        </div>
      )}
    </>
  );
}

function RiskSummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`panel risk-summary-card risk-summary-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("en-IN")}</strong>
      <small>Current student records</small>
    </article>
  );
}
