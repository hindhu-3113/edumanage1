"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/components/icons";
import ExportActions from "@/app/components/export-actions";
import { useCurrentRole } from "@/lib/use-current-role";

type Student = { id: string; name: string; registerNo: string; academicYear: string };
type Subject = { id: string; name: string; code: string };
type PerformanceRecord = {
  id: string;
  studentId: string;
  subjectId: string;
  examName: string;
  marksObtainedHundredths: number;
  maximumMarksHundredths: number;
  isSample: boolean;
  createdAt: string;
  percentage: number;
  student: Student;
  subject: Subject;
};
type FormData = { studentId: string; subjectId: string; examName: string; marksObtained: string; maximumMarks: string };

const emptyForm: FormData = { studentId: "", subjectId: "", examName: "", marksObtained: "", maximumMarks: "" };

function getErrorMessage(result: unknown, fallback: string) {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback;
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url);
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(result, fallback));
  return result as T;
}

function formatMarks(hundredths: number) {
  return (hundredths / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function average(records: PerformanceRecord[]) {
  return records.length ? records.reduce((sum, record) => sum + record.percentage, 0) / records.length : 0;
}

export default function PerformancePage() {
  const { isAdmin } = useCurrentRole();
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [analysisStudentId, setAnalysisStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PerformanceRecord | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const requestData = useCallback(async () => {
    const params = new URLSearchParams({ sort });
    if (search.trim()) params.set("search", search.trim());
    if (subjectFilter) params.set("subjectId", subjectFilter);
    if (examFilter.trim()) params.set("exam", examFilter.trim());
    const [recordList, studentList, subjectList] = await Promise.all([
      getJson<PerformanceRecord[]>(`/api/performance?${params}`, "Could not load performance records."),
      getJson<Student[]>("/api/students", "Could not load students."),
      getJson<Subject[]>("/api/subjects", "Could not load subjects."),
    ]);
    return { recordList, studentList, subjectList };
  }, [examFilter, search, sort, subjectFilter]);

  const applyData = useCallback(({ recordList, studentList, subjectList }: Awaited<ReturnType<typeof requestData>>) => {
    setRecords(recordList);
    setStudents(studentList);
    setSubjects(subjectList);
    setAnalysisStudentId((current) => current || studentList[0]?.id || "");
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyData(await requestData());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load performance data.");
    } finally {
      setLoading(false);
    }
  }, [applyData, requestData]);

  useEffect(() => {
    let active = true;
    void requestData().then((data) => {
      if (active) {
        applyData(data);
        setError("");
      }
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load performance data.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [applyData, requestData]);

  const examOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.examName))).sort((a, b) => a.localeCompare(b)),
    [records],
  );
  const studentRecords = useMemo(
    () => records.filter((record) => record.studentId === analysisStudentId),
    [analysisStudentId, records],
  );
  const subjectAverages = useMemo(() => {
    const groups = new Map<string, { subject: Subject; scores: number[] }>();
    for (const record of studentRecords) {
      const group = groups.get(record.subjectId) ?? { subject: record.subject, scores: [] };
      group.scores.push(record.percentage);
      groups.set(record.subjectId, group);
    }
    return Array.from(groups.values())
      .map(({ subject, scores }) => ({ subject, percentage: scores.reduce((sum, score) => sum + score, 0) / scores.length }))
      .sort((left, right) => right.percentage - left.percentage);
  }, [studentRecords]);
  const examAverages = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const record of studentRecords) {
      groups.set(record.examName, [...(groups.get(record.examName) ?? []), record.percentage]);
    }
    return Array.from(groups.entries())
      .map(([examName, scores]) => ({
        examName,
        percentage: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      }))
      .sort((left, right) => left.examName.localeCompare(right.examName));
  }, [studentRecords]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(record: PerformanceRecord) {
    setEditing(record);
    setForm({
      studentId: record.studentId,
      subjectId: record.subjectId,
      examName: record.examName,
      marksObtained: formatMarks(record.marksObtainedHundredths),
      maximumMarks: formatMarks(record.maximumMarksHundredths),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const obtained = Number(form.marksObtained);
    const maximum = Number(form.maximumMarks);
    if (!form.studentId || !form.subjectId || !form.examName.trim()) {
      setFormError("Select a student and subject, and enter an exam name.");
      return;
    }
    if (!Number.isFinite(obtained) || !Number.isFinite(maximum) || obtained < 0 || maximum <= 0 || obtained > maximum) {
      setFormError("Marks must be valid non-negative numbers, and obtained marks cannot exceed maximum marks.");
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(form.marksObtained.trim()) || !/^\d+(?:\.\d{1,2})?$/.test(form.maximumMarks.trim())) {
      setFormError("Marks can have up to two decimal places.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/performance/${editing.id}` : "/api/performance", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, examName: form.examName.trim() }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save performance record."));
      setModalOpen(false);
      setToast(editing ? "Performance record updated successfully." : "Performance record added successfully.");
      await loadData();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save performance record.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: PerformanceRecord) {
    if (!window.confirm(`Delete ${record.student.name}'s ${record.examName} result for ${record.subject.name}?`)) return;
    try {
      const response = await fetch(`/api/performance/${record.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete performance record."));
      setToast("Performance record deleted successfully.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete performance record.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> ACADEMIC PROGRESS</div>
          <h1>Student Performance</h1>
          <p>Record exam results and review progress across students and subjects.</p>
        </div>
        <button className="button button-primary" onClick={openCreate} disabled={!students.length || !subjects.length}>
          <Icon name="plus" size={18} /> Add result
        </button>
      </div>

      {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div>}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => void loadData()}>Try again</button></div>}

      {loading ? <div className="loading-panel"><span className="spinner" /> Loading performance records…</div> : (
        <>
          <section className="performance-summary-grid" aria-label="Performance summary">
            <article className="panel performance-stat"><span>Average of displayed records</span><strong>{average(records).toFixed(1)}%</strong><small>Based on recorded exam percentages</small></article>
            <article className="panel performance-stat"><span>Exam records</span><strong>{records.length}</strong><small>Matching current search and filters</small></article>
            <article className="panel performance-stat"><span>Students assessed</span><strong>{new Set(records.map((record) => record.studentId)).size}</strong><small>In the displayed results</small></article>
          </section>

          <section className="panel performance-analysis-panel">
            <div className="panel-header">
              <div><h2>Student analysis</h2><p>Average, strongest subject, and subject-wise progress</p></div>
              <label className="performance-student-select"><span className="sr-only">Select student to analyze</span>
                <select value={analysisStudentId} onChange={(event) => setAnalysisStudentId(event.target.value)}>
                  <option value="">Select student</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.registerNo}</option>)}
                </select>
              </label>
            </div>
            {studentRecords.length ? (
              <>
                <div className="performance-analysis-stats">
                  <div><span>Average percentage</span><strong>{average(studentRecords).toFixed(1)}%</strong></div>
                  <div><span>Best subject</span><strong>{subjectAverages[0]?.subject.name ?? "—"}</strong>{subjectAverages[0] && <small>{subjectAverages[0].percentage.toFixed(1)}%</small>}</div>
                  <div><span>Lowest subject</span><strong>{subjectAverages[subjectAverages.length - 1]?.subject.name ?? "—"}</strong>{subjectAverages.length > 0 && <small>{subjectAverages[subjectAverages.length - 1].percentage.toFixed(1)}%</small>}</div>
                </div>
                <div className="performance-subject-list">
                  {subjectAverages.map(({ subject, percentage }) => (
                    <div className="performance-bar-row" key={subject.id}>
                      <div className="performance-bar-label"><span>{subject.name} <small>{subject.code}</small></span><strong>{percentage.toFixed(1)}%</strong></div>
                      <div className="performance-track" role="progressbar" aria-label={`${subject.name} average`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="performance-exam-list">
                  <h3>Exam-wise performance</h3>
                  {examAverages.map(({ examName, percentage }) => (
                    <div className="performance-bar-row" key={examName}>
                      <div className="performance-bar-label"><span>{examName}</span><strong>{percentage.toFixed(1)}%</strong></div>
                      <div className="performance-track" role="progressbar" aria-label={`${examName} average`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="performance-empty">{analysisStudentId ? "No exam results are recorded for this student yet." : "Select a student to view their performance analysis."}</div>}
          </section>

          <section className="panel performance-record-panel">
            <div className="student-toolbar performance-toolbar">
              <div className="directory-title"><div><h2>Exam results <span className="count-chip">{records.length}</span></h2><p>Search, filter, sort, edit, or remove results</p></div></div>
              <div className="toolbar-actions performance-filters">
                <label className="search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student…" aria-label="Search by student name" /></label>
                <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filter by subject">
                  <option value="">All subjects</option>
                  {subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}
                </select>
                <select value={examFilter} onChange={(event) => setExamFilter(event.target.value)} aria-label="Filter by exam">
                  <option value="">All exams</option>
                  {examOptions.map((exam) => <option value={exam} key={exam}>{exam}</option>)}
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort performance records">
                  <option value="date_desc">Newest first</option>
                  <option value="student_asc">Student A–Z</option>
                  <option value="subject_asc">Subject A–Z</option>
                  <option value="exam_asc">Exam A–Z</option>
                </select>
                <ExportActions report="performance" filters={{
                  search: search.trim(),
                  subjectId: subjectFilter,
                  exam: examFilter,
                  sort,
                }} />
              </div>
            </div>
            {records.length ? (
              <div className="table-scroll">
                <table className="data-table performance-table">
                  <thead><tr><th>STUDENT</th><th>SUBJECT</th><th>EXAM</th><th>MARKS</th><th>PERCENTAGE</th><th>ACTIONS</th></tr></thead>
                  <tbody>{records.map((record, index) => (
                    <tr key={record.id}>
                      <td><div className="student-cell"><div className={`avatar avatar-${index % 4}`}>{record.student.name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase()}</div><div className="performance-student-cell"><strong>{record.student.name}</strong><span>{record.student.registerNo} · {record.student.academicYear}</span>{record.isSample && <small className="sample-chip">Sample data</small>}</div></div></td>
                      <td><div className="performance-student-cell"><strong>{record.subject.name}</strong><span>{record.subject.code}</span></div></td>
                      <td className="muted-cell">{record.examName}</td>
                      <td className="muted-cell">{formatMarks(record.marksObtainedHundredths)} / {formatMarks(record.maximumMarksHundredths)}</td>
                      <td><span className={`performance-score ${record.percentage >= 75 ? "performance-score-good" : record.percentage < 40 ? "performance-score-low" : ""}`}>{record.percentage.toFixed(1)}%</span></td>
                      <td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${record.student.name} result`} onClick={() => openEdit(record)}><Icon name="edit" size={16} /></button>{isAdmin && <button className="icon-button icon-danger" aria-label={`Delete ${record.student.name} result`} onClick={() => void deleteRecord(record)}><Icon name="trash" size={16} /></button>}</div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="empty-state"><span className="empty-icon"><Icon name="attendance" /></span><strong>No performance records found</strong><p>{students.length && subjects.length ? "Add an exam result or adjust your search and filters." : "Add students and subjects before recording results."}</p>{students.length > 0 && subjects.length > 0 && <button className="button button-primary button-small" onClick={openCreate}><Icon name="plus" size={16} /> Add result</button>}</div>}
          </section>
        </>
      )}

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="performance-modal-title">
          <div className="modal-header"><div><h2 id="performance-modal-title">{editing ? "Edit exam result" : "Add exam result"}</h2><p>Enter marks for the selected student and exam.</p></div><button className="icon-button" aria-label="Close dialog" disabled={saving} onClick={() => setModalOpen(false)}><Icon name="close" size={18} /></button></div>
          <form onSubmit={(event) => void submitForm(event)}>
            <div className="form-grid">
              <label className="form-field form-full"><span>Student <b>*</b></span><select required value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">Select student</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {student.registerNo}</option>)}</select></label>
              <label className="form-field form-full"><span>Subject <b>*</b></span><select required value={form.subjectId} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><option value="">Select subject</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name} ({subject.code})</option>)}</select></label>
              <label className="form-field form-full"><span>Exam name <b>*</b></span><input required maxLength={100} value={form.examName} onChange={(event) => setForm({ ...form, examName: event.target.value })} placeholder="e.g. Midterm Examination" /></label>
              <label className="form-field"><span>Marks obtained <b>*</b></span><input required type="number" min="0" step="0.01" value={form.marksObtained} onChange={(event) => setForm({ ...form, marksObtained: event.target.value })} /></label>
              <label className="form-field"><span>Maximum marks <b>*</b></span><input required type="number" min="0.01" step="0.01" value={form.maximumMarks} onChange={(event) => setForm({ ...form, maximumMarks: event.target.value })} /></label>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <div className="modal-actions"><button type="button" className="button button-outline" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Saving…</> : editing ? "Save changes" : "Save result"}</button></div>
          </form>
        </section>
      </div>}
    </>
  );
}
