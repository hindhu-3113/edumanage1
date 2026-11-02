"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";
import { useCurrentRole } from "@/lib/use-current-role";

type ClassRecord = {
  id: string;
  name: string;
  academicYear: string;
  section: string;
};

type ClassForm = Omit<ClassRecord, "id">;

const emptyForm: ClassForm = { name: "", academicYear: "", section: "" };

async function requestClasses(search: string): Promise<ClassRecord[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(`/api/classes?${params}`);
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "Could not load classes.";
    throw new Error(message);
  }
  if (!Array.isArray(result)) throw new Error("The class list response was invalid.");
  return result as ClassRecord[];
}

function getErrorMessage(result: unknown, fallback: string): string {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback;
}

export default function ClassesPage() {
  const { isAdmin } = useCurrentRole();
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRecord | null>(null);
  const [form, setForm] = useState<ClassForm>(emptyForm);

  useEffect(() => {
    let active = true;
    requestClasses(search)
      .then((result) => {
        if (active) {
          setClasses(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setClasses([]);
          setError(caught instanceof Error ? caught.message : "Could not load classes.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [search]);

  async function refreshClasses() {
    setLoading(true);
    setError("");
    try {
      setClasses(await requestClasses(search));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load classes.");
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

  function openEdit(classRecord: ClassRecord) {
    setEditing(classRecord);
    setForm({
      name: classRecord.name,
      academicYear: classRecord.academicYear,
      section: classRecord.section,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = {
      name: form.name.trim(),
      academicYear: form.academicYear.trim(),
      section: form.section.trim(),
    };
    if (!normalized.name || !normalized.academicYear || !normalized.section) {
      setFormError("Class name, academic year, and section are required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/classes/${editing.id}` : "/api/classes", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save class."));
      setModalOpen(false);
      setToast(editing ? "Class details updated successfully." : "Class added successfully.");
      await refreshClasses();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save class.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(classRecord: ClassRecord) {
    if (!window.confirm(`Delete ${classRecord.name}, ${classRecord.academicYear}, Section ${classRecord.section}? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/classes/${classRecord.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete class."));
      setToast("Class deleted successfully.");
      await refreshClasses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete class.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> CAMPUS DIRECTORY</div>
          <h1>Classes</h1>
          <p>Manage class names, academic years, and sections.</p>
        </div>
        {isAdmin && <button className="button button-primary" onClick={openCreate}>
          <Icon name="plus" size={18} /> Add class
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
              <h2>All classes <span className="count-chip">{loading ? "…" : classes.length}</span></h2>
              <p>A complete list of classes and sections</p>
            </div>
          </div>
          <div className="toolbar-actions">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                value={search}
                onChange={(event) => { setLoading(true); setSearch(event.target.value); }}
                placeholder="Search classes…"
                aria-label="Search classes by name, academic year, or section"
              />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel table-loading"><span className="spinner" /> Loading classes…</div>
        ) : classes.length ? (
          <div className="table-scroll">
            <table className="data-table class-table">
              <thead><tr><th>CLASS</th><th>ACADEMIC YEAR</th><th>SECTION</th>{isAdmin && <th><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {classes.map((classRecord) => (
                  <tr key={classRecord.id}>
                    <td><div className="student-cell"><div className="department-icon"><Icon name="building" size={17} /></div><strong>{classRecord.name}</strong></div></td>
                    <td><span className="year-chip">{classRecord.academicYear}</span></td>
                    <td><span className="class-section-chip">{classRecord.section}</span></td>
                    {isAdmin && <td>
                      <div className="row-actions">
                        <button className="icon-button" title={`Edit ${classRecord.name}`} aria-label={`Edit ${classRecord.name}`} onClick={() => openEdit(classRecord)}><Icon name="edit" size={17} /></button>
                        <button className="icon-button icon-danger" title={`Delete ${classRecord.name}`} aria-label={`Delete ${classRecord.name}`} onClick={() => void deleteClass(classRecord)}><Icon name="trash" size={17} /></button>
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
            <strong>{search ? "No matching classes" : "No classes added yet"}</strong>
            <p>{search ? "Try a different class name, academic year, or section." : "Add a class to get started."}</p>
            {!search && isAdmin && <button className="button button-primary button-small" onClick={openCreate}><Icon name="plus" size={16} /> Add class</button>}
          </div>
        )}
        <div className="table-footer">
          <span>Showing <strong>{classes.length}</strong> class{classes.length === 1 ? "" : "es"}</span>
          <span>Changes are saved automatically to your database.</span>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="class-modal-title">
            <div className="modal-header">
              <div>
                <span className="modal-icon"><Icon name={editing ? "edit" : "building"} size={19} /></span>
                <h2 id="class-modal-title">{editing ? "Edit class" : "Add a class"}</h2>
                <p>{editing ? "Update this class and section." : "Enter class details below."}</p>
              </div>
              <button className="icon-button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Close dialog"><Icon name="close" /></button>
            </div>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="form-field form-full">
                  <span>Class name <b>*</b></span>
                  <input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Class 10" />
                </label>
                <label className="form-field">
                  <span>Academic year <b>*</b></span>
                  <input required maxLength={30} value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} placeholder="e.g. 2025–26" />
                </label>
                <label className="form-field">
                  <span>Section <b>*</b></span>
                  <input required maxLength={30} value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} placeholder="e.g. A" />
                </label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="button button-primary" disabled={saving}>
                  {saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name={editing ? "check" : "plus"} size={17} />{editing ? "Save changes" : "Add class"}</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
