"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Icon } from "@/app/components/icons";
import { useCurrentRole } from "@/lib/use-current-role";
import { DAYS_OF_WEEK } from "@/lib/timetable-validation";

type ClassRecord = { id: string; name: string; academicYear: string; section: string };
type Teacher = { id: string; name: string; email: string };
type Subject = {
  id: string;
  name: string;
  code: string;
  classes: { class: ClassRecord }[];
  teachers: { teacher: Teacher }[];
};
type Entry = {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: (typeof DAYS_OF_WEEK)[number];
  startTime: string;
  endTime: string;
  roomNumber: string;
  academicYear: string | null;
  isSample: boolean;
  class: ClassRecord;
  subject: { id: string; name: string; code: string };
  teacher: Teacher;
};
type FormValue = {
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNumber: string;
  academicYear: string;
};

const emptyForm: FormValue = {
  classId: "",
  subjectId: "",
  teacherId: "",
  dayOfWeek: "Monday",
  startTime: "",
  endTime: "",
  roomNumber: "",
  academicYear: "",
};

function getErrorMessage(result: unknown, fallback: string): string {
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

function classLabel(classRecord: ClassRecord): string {
  return `${classRecord.name} • ${classRecord.section} • ${classRecord.academicYear}`;
}

export default function TimetablePage() {
  const { isAdmin } = useCurrentRole();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState<FormValue>(emptyForm);

  useEffect(() => {
    let active = true;
    Promise.all([
      getJson<ClassRecord[]>("/api/classes", "Could not load classes."),
      getJson<Subject[]>("/api/subjects", "Could not load subject assignments."),
      getJson<Teacher[]>("/api/teachers", "Could not load teachers."),
    ])
      .then(([classList, subjectList, teacherList]) => {
        if (!active) return;
        setClasses(classList);
        setSubjects(subjectList);
        setTeachers(teacherList);
      })
      .catch((caught: unknown) => {
        if (active) setOptionError(caught instanceof Error ? caught.message : "Could not load timetable options.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (classFilter) params.set("classId", classFilter);
    if (subjectFilter) params.set("subjectId", subjectFilter);
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (dayFilter) params.set("dayOfWeek", dayFilter);
    getJson<Entry[]>(`/api/timetable?${params.toString()}`, "Could not load timetable entries.")
      .then((result) => {
        if (active) {
          setEntries(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load timetable entries.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, classFilter, subjectFilter, teacherFilter, dayFilter]);

  const classSubjects = useMemo(
    () => subjects.filter((subject) => subject.classes.some(({ class: classRecord }) => classRecord.id === form.classId)),
    [subjects, form.classId],
  );
  const subjectTeachers = useMemo(
    () => subjects.find((subject) => subject.id === form.subjectId)?.teachers.map(({ teacher }) => teacher) ?? [],
    [subjects, form.subjectId],
  );
  const filterSubjects = useMemo(() => subjects, [subjects]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, classId: classes[0]?.id ?? "" });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(entry: Entry) {
    setEditing(entry);
    setForm({
      classId: entry.classId,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      roomNumber: entry.roomNumber,
      academicYear: entry.academicYear ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function refreshEntries() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (classFilter) params.set("classId", classFilter);
    if (subjectFilter) params.set("subjectId", subjectFilter);
    if (teacherFilter) params.set("teacherId", teacherFilter);
    if (dayFilter) params.set("dayOfWeek", dayFilter);
    setEntries(await getJson<Entry[]>(`/api/timetable?${params.toString()}`, "Could not reload timetable."));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.classId || !form.subjectId || !form.teacherId || !form.roomNumber.trim()) {
      setFormError("Class, subject, teacher, and room number are required.");
      return;
    }
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime) {
      setFormError("End time must be after start time.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/timetable/${editing.id}` : "/api/timetable", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, roomNumber: form.roomNumber.trim(), academicYear: form.academicYear.trim() || null }),
      });
      const result: unknown = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save timetable entry."));
      setModalOpen(false);
      setToast(editing ? "Timetable entry updated successfully." : "Timetable entry added successfully.");
      await refreshEntries();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save timetable entry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: Entry) {
    if (!window.confirm(`Delete ${entry.subject.name} for ${entry.class.name} ${entry.class.section} on ${entry.dayOfWeek}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/timetable/${entry.id}`, { method: "DELETE" });
      const result: unknown = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete timetable entry."));
      setToast("Timetable entry deleted successfully.");
      await refreshEntries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete timetable entry.");
    }
  }

  const groupedEntries = useMemo(() => {
    const days = dayFilter ? [dayFilter] : [...DAYS_OF_WEEK];
    return days.map((day) => ({
      day,
      entries: entries.filter((entry) => entry.dayOfWeek === day),
    })).filter(({ entries: dayEntries }) => dayEntries.length > 0);
  }, [dayFilter, entries]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> ACADEMIC SCHEDULING</div>
          <h1>Timetable</h1>
          <p>Plan class sessions and keep teacher schedules conflict-free.</p>
        </div>
        {isAdmin && <button className="button button-primary" onClick={openCreate} disabled={!classes.length || !subjects.length || !teachers.length}>
          <Icon name="plus" size={18} /> Add timetable entry
        </button>}
      </div>
      {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div>}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
      {optionError && <div className="alert alert-error" role="alert">{optionError}</div>}

      <section className="panel timetable-panel">
        <div className="student-toolbar timetable-toolbar">
          <div className="directory-title">
            <div>
              <h2>Weekly schedule <span className="count-chip">{loading ? "…" : entries.length}</span></h2>
              <p>Filter by class, teacher, subject, or weekday</p>
            </div>
          </div>
          <div className="toolbar-actions timetable-filters">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); }} placeholder="Search room or schedule…" aria-label="Search timetable" />
            </label>
            <label className="select-filter">
              <span className="sr-only">Filter by class</span>
              <select value={classFilter} onChange={(event) => { setLoading(true); setClassFilter(event.target.value); }}>
                <option value="">All classes</option>
                {classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classLabel(classRecord)}</option>)}
              </select>
            </label>
            <label className="select-filter">
              <span className="sr-only">Filter by subject</span>
              <select value={subjectFilter} onChange={(event) => { setLoading(true); setSubjectFilter(event.target.value); }}>
                <option value="">All subjects</option>
                {filterSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="select-filter">
              <span className="sr-only">Filter by teacher</span>
              <select value={teacherFilter} onChange={(event) => { setLoading(true); setTeacherFilter(event.target.value); }}>
                <option value="">All teachers</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </label>
            <label className="select-filter">
              <span className="sr-only">Filter by weekday</span>
              <select value={dayFilter} onChange={(event) => { setLoading(true); setDayFilter(event.target.value); }}>
                <option value="">All weekdays</option>
                {DAYS_OF_WEEK.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading timetable…</div>
        ) : groupedEntries.length ? (
          <div className="timetable-days">
            {groupedEntries.map(({ day, entries: dayEntries }) => (
              <section className="timetable-day" key={day} aria-labelledby={`timetable-${day}`}>
                <div className="timetable-day-heading"><h3 id={`timetable-${day}`}>{day}</h3><span>{dayEntries.length} {dayEntries.length === 1 ? "class" : "classes"}</span></div>
                <div className="table-scroll">
                  <table className="data-table timetable-table">
                    <thead><tr><th>TIME</th><th>CLASS</th><th>SUBJECT</th><th>TEACHER</th><th>ROOM</th><th>ACADEMIC YEAR</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
                    <tbody>{dayEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td><strong className="timetable-time">{entry.startTime}–{entry.endTime}</strong></td>
                        <td><div className="timetable-cell"><strong>{entry.class.name} · {entry.class.section}</strong><span>{entry.class.academicYear}</span></div></td>
                        <td><div className="timetable-cell"><strong>{entry.subject.name}</strong><span>{entry.subject.code}{entry.isSample ? " · Sample" : ""}</span></div></td>
                        <td><div className="timetable-cell"><strong>{entry.teacher.name}</strong><span>{entry.teacher.email}</span></div></td>
                        <td><span className="timetable-room">{entry.roomNumber}</span></td>
                        <td className="muted-cell">{entry.academicYear || entry.class.academicYear}</td>
                        {isAdmin && <td><span className="row-actions"><button className="icon-button" aria-label={`Edit ${entry.subject.name} timetable entry`} onClick={() => openEdit(entry)}><Icon name="edit" size={16} /></button><button className="icon-button icon-danger" aria-label={`Delete ${entry.subject.name} timetable entry`} onClick={() => void deleteEntry(entry)}><Icon name="trash" size={16} /></button></span></td>}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon"><Icon name="calendar" /></span><strong>{entries.length ? "No schedule matches these filters" : "No timetable entries yet"}</strong><p>{isAdmin ? "Add a class session to begin building the weekly schedule." : "Timetable entries will appear here when they are available."}</p>{isAdmin && <button className="button button-primary button-small" onClick={openCreate} disabled={!classes.length || !subjects.length || !teachers.length}><Icon name="plus" size={16} /> Add entry</button>}</div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="modal-card timetable-modal" role="dialog" aria-modal="true" aria-labelledby="timetable-form-title">
            <div className="modal-header">
              <div><span className="modal-icon"><Icon name="calendar" size={19} /></span><h2 id="timetable-form-title">{editing ? "Edit timetable entry" : "Add timetable entry"}</h2><p>Choose an assigned class, subject, and teacher.</p></div>
              <button className="icon-button" aria-label="Close dialog" disabled={saving} onClick={() => setModalOpen(false)}><Icon name="close" size={18} /></button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="form-field"><span>Class <b>*</b></span><select required value={form.classId} onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value, subjectId: "", teacherId: "" }))}><option value="">Select class</option>{classes.map((classRecord) => <option key={classRecord.id} value={classRecord.id}>{classLabel(classRecord)}</option>)}</select></label>
                <label className="form-field"><span>Subject <b>*</b></span><select required value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, teacherId: "" }))}><option value="">Select assigned subject</option>{classSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}</select></label>
                <label className="form-field"><span>Teacher <b>*</b></span><select required value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}><option value="">Select assigned teacher</option>{subjectTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
                <label className="form-field"><span>Day of week <b>*</b></span><select required value={form.dayOfWeek} onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}>{DAYS_OF_WEEK.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
                <label className="form-field"><span>Start time <b>*</b></span><input type="time" required value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></label>
                <label className="form-field"><span>End time <b>*</b></span><input type="time" required value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></label>
                <label className="form-field"><span>Room number <b>*</b></span><input required maxLength={50} value={form.roomNumber} onChange={(event) => setForm((current) => ({ ...current, roomNumber: event.target.value }))} placeholder="e.g. Lab 204" /></label>
                <label className="form-field"><span>Academic year <small>(optional)</small></span><input maxLength={30} value={form.academicYear} onChange={(event) => setForm((current) => ({ ...current, academicYear: event.target.value }))} placeholder="Uses class year when blank" /></label>
              </div>
              {!classSubjects.length && form.classId && <p className="timetable-help">No subjects are assigned to this class yet. Assign a subject first on the Subjects page.</p>}
              {!!form.subjectId && !subjectTeachers.length && <p className="timetable-help">No teachers are assigned to this subject yet. Assign a teacher first on the Subjects page.</p>}
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions"><button type="button" className="button button-outline" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Saving…</> : editing ? "Save changes" : "Add entry"}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
