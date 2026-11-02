"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";
import { getInitials } from "@/app/components/dashboard-page";
import ExportActions from "@/app/components/export-actions";
import { useCurrentRole } from "@/lib/use-current-role";

type Department = { id: string; name: string; code: string };
type Teacher = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  qualification: string | null;
  isSample: boolean;
  departmentId: string | null;
  department: Department | null;
};

type TeacherForm = {
  name: string;
  email: string;
  phone: string;
  qualification: string;
  departmentId: string;
};

const emptyForm: TeacherForm = {
  name: "",
  email: "",
  phone: "",
  qualification: "",
  departmentId: "",
};

async function requestTeachers(search: string): Promise<Teacher[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(`/api/teachers?${params}`);
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "Could not load teachers.";
    throw new Error(message);
  }
  if (!Array.isArray(result)) throw new Error("The teacher list response was invalid.");
  return result as Teacher[];
}

export default function TeachersPage() {
  const { isAdmin } = useCurrentRole();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherForm>(emptyForm);

  useEffect(() => {
    let active = true;
    Promise.all([
      requestTeachers(search),
      fetch("/api/departments").then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not load departments.";
          throw new Error(message);
        }
        if (!Array.isArray(result)) throw new Error("The department list response was invalid.");
        return result as Department[];
      }),
    ])
      .then(([result, departmentList]) => {
        if (active) {
          setTeachers(result);
          setDepartments(departmentList);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setTeachers([]);
          setError(caught instanceof Error ? caught.message : "Could not load teachers.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [search]);

  async function refreshTeachers() {
    setLoading(true);
    setError("");
    try {
      setTeachers(await requestTeachers(search));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load teachers.");
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

  function openEdit(teacher: Teacher) {
    setEditing(teacher);
    setForm({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone ?? "",
      qualification: teacher.qualification ?? "",
      departmentId: teacher.departmentId ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/teachers/${editing.id}` : "/api/teachers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not save teacher.";
        throw new Error(message);
      }
      setModalOpen(false);
      setToast(editing ? "Teacher details updated successfully." : "Teacher added successfully.");
      await refreshTeachers();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save teacher.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeacher(teacher: Teacher) {
    if (!window.confirm(`Delete ${teacher.name} (${teacher.email})? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/teachers/${teacher.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "Could not delete teacher.";
        throw new Error(message);
      }
      setToast("Teacher deleted successfully.");
      await refreshTeachers();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete teacher.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> CAMPUS DIRECTORY</div>
          <h1>Teachers</h1>
          <p>Manage teacher profiles and keep contact details up to date.</p>
        </div>
        {isAdmin && <button className="button button-primary" onClick={openCreate}>
          <Icon name="plus" size={18} /> Add teacher
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
              <h2>All teachers <span className="count-chip">{loading ? "…" : teachers.length}</span></h2>
              <p>A complete list of registered teachers</p>
            </div>
          </div>
          <div className="toolbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                value={search}
                onChange={(event) => { setLoading(true); setSearch(event.target.value); }}
                placeholder="Search teachers…"
                aria-label="Search teachers by name or email"
              />
            </label>
            <ExportActions report="teachers" filters={{ search: search.trim() }} />
          </div>
        </div>

        {loading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading teachers…</div>
        ) : teachers.length ? (
          <div className="table-scroll">
            <table className="data-table teacher-table">
              <thead><tr><th>TEACHER</th><th>CONTACT</th><th>DEPARTMENT</th><th>QUALIFICATION</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {teachers.map((teacher, index) => (
                  <tr key={teacher.id}>
                    <td>
                      <div className="student-cell">
                        <div className={`avatar avatar-${index % 4}`}>{getInitials(teacher.name)}</div>
                        <div><strong>{teacher.name}</strong>{teacher.isSample && <small className="sample-chip">Sample data</small>}</div>
                      </div>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <span><Icon name="mail" size={14} />{teacher.email}</span>
                        <span><Icon name="phone" size={14} />{teacher.phone || "Not provided"}</span>
                      </div>
                    </td>
                    <td>{teacher.department?.name ?? <span className="muted-cell">Not assigned</span>}</td>
                    <td>{teacher.qualification || <span className="muted-cell">Not provided</span>}</td>
                    {isAdmin && <td>
                      <div className="row-actions">
                        <button className="icon-button" title={`Edit ${teacher.name}`} aria-label={`Edit ${teacher.name}`} onClick={() => openEdit(teacher)}><Icon name="edit" size={17} /></button>
                        <button className="icon-button icon-danger" title={`Delete ${teacher.name}`} aria-label={`Delete ${teacher.name}`} onClick={() => void deleteTeacher(teacher)}><Icon name="trash" size={17} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><Icon name="students" /></span>
            <strong>{search ? "No matching teachers" : "No teachers added yet"}</strong>
            <p>{search ? "Try a different name or email address." : "Add a teacher profile to get started."}</p>
            {!search && isAdmin && <button className="button button-primary button-small" onClick={openCreate}><Icon name="plus" size={16} /> Add teacher</button>}
          </div>
        )}
        <div className="table-footer">
          <span>Showing <strong>{teachers.length}</strong> teacher{teachers.length === 1 ? "" : "s"}</span>
          <span>Changes are saved automatically to your database.</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="teacher-modal-title">
            <div className="modal-header">
              <div>
                <span className="modal-icon"><Icon name={editing ? "edit" : "students"} size={19} /></span>
                <h2 id="teacher-modal-title">{editing ? "Edit teacher" : "Add a teacher"}</h2>
                <p>{editing ? "Update this teacher’s information." : "Enter the teacher details below."}</p>
              </div>
              <button className="icon-button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="form-field form-full">
                  <span>Full name <b>*</b></span>
                  <input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Alex Johnson" autoComplete="name" />
                </label>
                <label className="form-field form-full">
                  <span>Email address <b>*</b></span>
                  <input type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="teacher@example.edu" autoComplete="email" />
                </label>
                <label className="form-field">
                  <span>Phone number</span>
                  <input type="tel" maxLength={100} value={form.phone ?? ""} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
                </label>
                <label className="form-field">
                  <span>Qualification</span>
                  <input maxLength={100} value={form.qualification ?? ""} onChange={(event) => setForm({ ...form, qualification: event.target.value })} placeholder="e.g. M.Sc., B.Ed." />
                </label>
                <label className="form-field form-full">
                  <span>Department</span>
                  <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                    <option value="">Not assigned</option>
                    {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
                  </select>
                </label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="button button-primary" disabled={saving}>
                  {saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name={editing ? "check" : "plus"} size={17} />{editing ? "Save changes" : "Add teacher"}</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
