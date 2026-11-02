"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/components/icons";
import { getInitials } from "@/app/components/dashboard-page";
import ExportActions from "@/app/components/export-actions";
import QrAttendancePanel from "@/app/components/qr-attendance-panel";

type AttendanceRow = {
  id: string;
  name: string;
  registerNo: string;
  academicYear: string;
  department: { name: string; code: string };
  status: "PRESENT" | "ABSENT" | null;
};

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function requestAttendance(date: string): Promise<AttendanceRow[]> {
  const response = await fetch(`/api/attendance?date=${encodeURIComponent(date)}`);
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result ? result.error : "";
    throw new Error(typeof message === "string" ? message : "Could not load attendance.");
  }
  return result as AttendanceRow[];
}

export default function AttendancePage() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [marks, setMarks] = useState<Record<string, "PRESENT" | "ABSENT" | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    // The browser's local day is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(localDateKey());
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const attendanceRows = await requestAttendance(date);
      setRows(attendanceRows);
      setMarks(Object.fromEntries(attendanceRows.map((row) => [row.id, row.status])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load attendance.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (!date) return;
    let active = true;
    void requestAttendance(date).then((attendanceRows) => {
      if (active) {
        setRows(attendanceRows);
        setMarks(Object.fromEntries(attendanceRows.map((row) => [row.id, row.status])));
        setError("");
      }
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load attendance.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date]);

  const departments = useMemo(() => Array.from(new Map(rows.map((row) => [row.department.code, row.department])).values()), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => (
    (!department || row.department.code === department) &&
    (!search || `${row.name} ${row.registerNo}`.toLowerCase().includes(search.toLowerCase()))
  )), [rows, department, search]);
  const presentCount = rows.filter((row) => marks[row.id] === "PRESENT").length;
  const absentCount = rows.filter((row) => marks[row.id] === "ABSENT").length;
  const unmarkedCount = rows.length - presentCount - absentCount;
  const changedCount = rows.filter((row) => marks[row.id] !== row.status).length;

  function applyQrAttendance(student: Pick<AttendanceRow, "id" | "name">) {
    setRows((current) => current.map((row) => row.id === student.id ? { ...row, status: "PRESENT" } : row));
    setMarks((current) => ({ ...current, [student.id]: "PRESENT" }));
    setToast(`${student.name} marked Present by attendance scanner.`);
  }

  function setStatus(studentId: string, status: "PRESENT" | "ABSENT") {
    setMarks((current) => ({ ...current, [studentId]: current[studentId] === status ? null : status }));
  }

  function markAllPresent() {
    setMarks(Object.fromEntries(rows.map((row) => [row.id, "PRESENT"])));
  }

  async function saveAttendance() {
    if (loading) return;
    const records = rows
      .filter((row) => marks[row.id] !== null)
      .map((row) => ({ studentId: row.id, status: marks[row.id] as "PRESENT" | "ABSENT" }));
    if (!records.length) {
      setError("Mark at least one student Present or Absent before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, records }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save attendance.");
      setToast(`Attendance saved for ${result.saved} student${result.saved === 1 ? "" : "s"}.`);
      await loadAttendance();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> DAILY RECORDS</div><h1>Attendance</h1><p>Mark, review, and manage your students’ daily attendance.</p></div>
        <button className="button button-primary" onClick={() => void saveAttendance()} disabled={loading || saving || !changedCount}><Icon name="check" size={18} />{saving ? "Saving…" : changedCount ? `Save changes (${changedCount})` : "Attendance saved"}</button>
      </div>
      {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div>}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="attendance-summary-cards">
        <div className="attendance-stat"><span className="attendance-stat-icon stat-icon-blue"><Icon name="students" size={19} /></span><div><span>Total students</span><strong>{rows.length}</strong></div></div>
        <div className="attendance-stat"><span className="attendance-stat-icon stat-icon-green"><Icon name="check" size={19} /></span><div><span>Present</span><strong>{presentCount}</strong></div></div>
        <div className="attendance-stat"><span className="attendance-stat-icon stat-icon-orange"><Icon name="close" size={19} /></span><div><span>Absent</span><strong>{absentCount}</strong></div></div>
        <div className="attendance-stat"><span className="attendance-stat-icon stat-icon-violet"><Icon name="clock" size={19} /></span><div><span>Not marked</span><strong>{unmarkedCount}</strong></div></div>
      </section>

      <QrAttendancePanel date={date} students={rows} onAttendanceMarked={applyQrAttendance} />

      <section className="panel attendance-panel">
        <div className="attendance-toolbar">
          <div className="directory-title"><div><h2>Student attendance</h2><p>Choose a date and mark each student’s status.</p></div></div>
          <div className="toolbar-actions">
            <label className="date-filter"><Icon name="calendar" size={17} /><input type="date" value={date} onChange={(event) => { setLoading(true); setMarks({}); setDate(event.target.value || localDateKey()); }} aria-label="Attendance date" /></label>
            <label className="search-field attendance-search"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students…" aria-label="Search attendance list" /></label>
            <label className="select-filter" aria-label="Filter attendance by department"><Icon name="filter" size={17} /><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
            <ExportActions report="attendance" filters={{ date, search: search.trim(), department }} />
          </div>
        </div>
        <div className="attendance-bulk"><span>{date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Loading date…"}</span><button className="text-button" onClick={markAllPresent} disabled={loading || !rows.length}>Mark all present</button></div>
        {loading ? <div className="loading-panel table-loading"><span className="spinner" /> Loading attendance…</div> : filteredRows.length ? (
          <div className="table-scroll">
            <table className="data-table attendance-table">
              <thead><tr><th>STUDENT</th><th>REGISTER NO.</th><th>DEPARTMENT</th><th>ACADEMIC YEAR</th><th className="attendance-status-head">MARK ATTENDANCE</th></tr></thead>
              <tbody>{filteredRows.map((row, index) => (
                <tr key={row.id}>
                  <td><div className="student-cell"><div className={`avatar avatar-${index % 4}`}>{getInitials(row.name)}</div><strong>{row.name}</strong></div></td>
                  <td><span className="register-number">{row.registerNo}</span></td>
                  <td><span className="department-badge">{row.department.code}</span><span className="muted-cell department-name">{row.department.name}</span></td>
                  <td><span className="year-chip">{row.academicYear}</span></td>
                  <td><div className="mark-buttons"><button className={`mark-button mark-present ${marks[row.id] === "PRESENT" ? "mark-selected" : ""}`} onClick={() => setStatus(row.id, "PRESENT")} disabled={loading} aria-pressed={marks[row.id] === "PRESENT"}><Icon name="check" size={15} /> Present</button><button className={`mark-button mark-absent ${marks[row.id] === "ABSENT" ? "mark-selected" : ""}`} onClick={() => setStatus(row.id, "ABSENT")} disabled={loading} aria-pressed={marks[row.id] === "ABSENT"}><Icon name="close" size={15} /> Absent</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="empty-state"><span className="empty-icon"><Icon name="attendance" /></span><strong>{rows.length ? "No matching students" : "No students to mark"}</strong><p>{rows.length ? "Try changing your search or department filter." : "Add students to your directory before taking attendance."}</p></div>}
        <div className="table-footer"><span>{filteredRows.length} of {rows.length} students</span><span>{unmarkedCount ? `${unmarkedCount} still need to be marked` : "Everyone has been marked"}</span></div>
      </section>
    </>
  );
}
