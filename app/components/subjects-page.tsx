"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";
import ExportActions from "@/app/components/export-actions";
import { useCurrentRole } from "@/lib/use-current-role";

type ClassRecord = { id: string; name: string; academicYear: string; section: string };
type Teacher = { id: string; name: string; email: string };
type SubjectClass = { class: ClassRecord };
type SubjectTeacher = { teacher: Teacher };
type Subject = {
  id: string;
  name: string;
  code: string;
  classes: SubjectClass[];
  teachers: SubjectTeacher[];
  isSample: boolean;
};
type SubjectForm = { name: string; code: string; classIds: string[]; teacherIds: string[] };

const emptyForm: SubjectForm = { name: "", code: "", classIds: [], teacherIds: [] };

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

export default function SubjectsPage() {
  const { isAdmin } = useCurrentRole();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectForm>(emptyForm);

  useEffect(() => {
    let active = true;
    Promise.all([
      getJson<Subject[]>(`/api/subjects?search=${encodeURIComponent(search.trim())}`, "Could not load subjects."),
      getJson<ClassRecord[]>("/api/classes", "Could not load classes."),
      getJson<Teacher[]>("/api/teachers", "Could not load teachers."),
    ])
      .then(([subjectList, classList, teacherList]) => {
        if (active) {
          setSubjects(subjectList);
          setClasses(classList);
          setTeachers(teacherList);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setSubjects([]);
          setError(caught instanceof Error ? caught.message : "Could not load subject data.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [search]);

  async function refreshSubjects() {
    setLoading(true);
    setError("");
    try {
      setSubjects(await getJson<Subject[]>(`/api/subjects?search=${encodeURIComponent(search.trim())}`, "Could not load subjects."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load subjects.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setForm({
      name: subject.name,
      code: subject.code,
      classIds: subject.classes.map(({ class: classRecord }) => classRecord.id),
      teacherIds: subject.teachers.map(({ teacher }) => teacher.id),
    });
    setFormError("");
    setModalOpen(true);
  }

  function toggleAssociation(field: "classIds" | "teacherIds", id: string) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((selected) => selected !== id)
        : [...current[field], id],
    }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name || !code) {
      setFormError("Subject name and subject code are required.");
      return;
    }
    if (name.length > 100 || code.length > 30 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(code)) {
      setFormError("Enter a subject name of up to 100 characters and a code of up to 30 letters, numbers, hyphens, or underscores.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/subjects/${editing.id}` : "/api/subjects", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name, code }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save subject."));
      setModalOpen(false);
      setToast(editing ? "Subject details updated successfully." : "Subject added successfully.");
      await refreshSubjects();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save subject.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(subject: Subject) {
    if (!window.confirm(`Delete ${subject.name} (${subject.code}) and its class/teacher assignments? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/subjects/${subject.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete subject."));
      setToast("Subject deleted successfully.");
      await refreshSubjects();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete subject.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> ACADEMIC CATALOG</div>
          <h1>Subjects</h1>
          <p>Manage subjects and assign them to classes and teachers.</p>
        </div>
        {isAdmin && <button className="button button-primary" onClick={openCreate}>
          <Icon name="plus" size={18} /> Add subject
        </button>}
      </div>
      {toast && (
        <div className="toast-message" role="status">
          <Icon name="check" size={17} />{toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button>
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="panel students-panel">
        <div className="student-toolbar">
          <div className="directory-title">
            <div>
              <h2>All subjects <span className="count-chip">{loading ? "…" : subjects.length}</span></h2>
              <p>Subject catalog and teaching assignments</p>
            </div>
          </div>
          <div className="toolbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                value={search}
                onChange={(event) => { setLoading(true); setSearch(event.target.value); }}
                placeholder="Search subjects…"
                aria-label="Search subjects by name or code"
              />
            </label>
            <ExportActions report="subjects" filters={{ search: search.trim() }} />
          </div>
        </div>

        {loading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading subjects…</div>
        ) : subjects.length ? (
          <div className="table-scroll">
            <table className="data-table subject-table">
              <thead><tr><th>SUBJECT</th><th>CODE</th><th>ASSIGNED CLASSES</th><th>ASSIGNED TEACHERS</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {subjects.map((subject, index) => (
                  <tr key={subject.id}>
                    <td><div className="student-cell"><div className={`avatar avatar-${index % 4}`}><Icon name="building" size={16} /></div><div><strong>{subject.name}</strong>{subject.isSample && <small className="sample-chip">Sample data</small>}</div></div></td>
                    <td><span className="register-number">{subject.code}</span></td>
                    <td><div className="subject-associations">{subject.classes.length ? subject.classes.map(({ class: classRecord }) => <span className="year-chip" key={classRecord.id}>{classRecord.name} · {classRecord.academicYear} · {classRecord.section}</span>) : <span className="muted-cell">None assigned</span>}</div></td>
                    <td><div className="subject-associations">{subject.teachers.length ? subject.teachers.map(({ teacher }) => <span className="teacher-assignment" key={teacher.id}>{teacher.name}</span>) : <span className="muted-cell">None assigned</span>}</div></td>
                    {isAdmin && <td>
                      <div className="row-actions">
                        <button className="icon-button" title={`Edit ${subject.name}`} aria-label={`Edit ${subject.name}`} onClick={() => openEdit(subject)}><Icon name="edit" size={17} /></button>
                        <button className="icon-button icon-danger" title={`Delete ${subject.name}`} aria-label={`Delete ${subject.name}`} onClick={() => void deleteSubject(subject)}><Icon name="trash" size={17} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="building" /></span>
            <strong>{search ? "No matching subjects" : "No subjects added yet"}</strong>
            <p>{search ? "Try a different subject name or code." : "Add a subject to get started."}</p>
            {!search && isAdmin && <button className="button button-primary button-small" onClick={openCreate}><Icon name="plus" size={16} /> Add subject</button>}
          </div>
        )}
        <div className="table-footer">
          <span>Showing <strong>{subjects.length}</strong> subject{subjects.length === 1 ? "" : "s"}</span>
          <span>Changes are saved automatically to your database.</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="modal-card subject-modal" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
            <div className="modal-header">
              <div>
                <span className="modal-icon"><Icon name={editing ? "edit" : "building"} size={19} /></span>
                <h2 id="subject-modal-title">{editing ? "Edit subject" : "Add a subject"}</h2>
                <p>{editing ? "Update subject details and assignments." : "Enter subject details and optionally assign classes and teachers."}</p>
              </div>
              <button className="icon-button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Subject name <b>*</b></span>
                  <input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mathematics" />
                </label>
                <label className="form-field">
                  <span>Subject code <b>*</b></span>
                  <input required maxLength={30} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="e.g. MATH101" />
                </label>
                <fieldset className="subject-assignment-fieldset">
                  <legend>Assign classes</legend>
                  {classes.length ? classes.map((classRecord) => (
                    <label className="subject-option" key={classRecord.id}>
                      <input type="checkbox" checked={form.classIds.includes(classRecord.id)} onChange={() => toggleAssociation("classIds", classRecord.id)} />
                      <span>{classRecord.name} · {classRecord.academicYear} · {classRecord.section}</span>
                    </label>
                  )) : <p className="subject-no-options">No classes available. Add a class first.</p>}
                </fieldset>
                <fieldset className="subject-assignment-fieldset">
                  <legend>Assign teachers</legend>
                  {teachers.length ? teachers.map((teacher) => (
                    <label className="subject-option" key={teacher.id}>
                      <input type="checkbox" checked={form.teacherIds.includes(teacher.id)} onChange={() => toggleAssociation("teacherIds", teacher.id)} />
                      <span>{teacher.name} <small>{teacher.email}</small></span>
                    </label>
                  )) : <p className="subject-no-options">No teachers available. Add a teacher first.</p>}
                </fieldset>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="button button-primary" disabled={saving}>
                  {saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name={editing ? "check" : "plus"} size={17} />{editing ? "Save changes" : "Add subject"}</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
