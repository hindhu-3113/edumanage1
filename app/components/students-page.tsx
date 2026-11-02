"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Icon } from "@/app/components/icons";
import { getInitials } from "@/app/components/dashboard-page";
import ExportActions from "@/app/components/export-actions";
import QRCode from "qrcode";
import { useCurrentRole } from "@/lib/use-current-role";

type Department = { id: string; name: string; code: string };
type Student = {
  id: string;
  name: string;
  registerNo: string;
  email: string;
  phone: string;
  status: "ENROLLED";
  academicYear: string;
  departmentId: string;
  department: Department;
};
type StudentForm = Omit<Student, "id" | "status" | "department">;
type StudentQr = Pick<Student, "id" | "name" | "registerNo"> & {
  department: Department;
  qrToken: string;
};
const emptyForm: StudentForm = {
  name: "",
  registerNo: "",
  email: "",
  phone: "",
  departmentId: "",
  academicYear: "Year 1",
};

async function requestStudents(search: string, departmentFilter: string, yearFilter: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (departmentFilter) params.set("departmentId", departmentFilter);
  if (yearFilter) params.set("academicYear", yearFilter);
  const [studentsResponse, departmentsResponse] = await Promise.all([
    fetch(`/api/students?${params}`),
    fetch("/api/departments"),
  ]);
  const [studentsData, departmentsData] = await Promise.all([
    studentsResponse.json(),
    departmentsResponse.json(),
  ]);
  if (!studentsResponse.ok) throw new Error(studentsData.error ?? "Could not load students.");
  if (!departmentsResponse.ok) throw new Error(departmentsData.error ?? "Could not load departments.");
  return {
    students: studentsData as Student[],
    departments: departmentsData as Department[],
  };
}

export default function StudentsPage() {
  const { isAdmin } = useCurrentRole();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [qrStudent, setQrStudent] = useState<StudentQr | null>(null);
  const [qrImage, setQrImage] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestStudents(search, departmentFilter, yearFilter);
      setStudents(result.students);
      setDepartments(result.departments);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load students.");
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, yearFilter]);

  useEffect(() => {
    let active = true;
    void requestStudents(search, departmentFilter, yearFilter).then((result) => {
      if (active) {
        setStudents(result.students);
        setDepartments(result.departments);
        setError("");
      }
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load students.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [search, departmentFilter, yearFilter]);

  const displayCount = useMemo(() => students.length, [students]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, departmentId: departments[0]?.id ?? "" });
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setForm({
      name: student.name,
      registerNo: student.registerNo,
      email: student.email,
      phone: student.phone,
      departmentId: student.departmentId,
      academicYear: student.academicYear,
    });
    setModalOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/students/${editing.id}` : "/api/students", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save student.");
      setModalOpen(false);
      setToast(editing ? "Student details updated successfully." : "Student added successfully.");
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save student.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`Delete ${student.name} (${student.registerNo})? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not delete student.");
      setToast("Student deleted successfully.");
      await loadStudents();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete student.");
    }
  }

  async function openStudentQr(student: Student) {
    setQrStudent(null);
    setQrImage("");
    setQrError("");
    setQrLoading(true);
    try {
      const response = await fetch(`/api/students/${student.id}/qr`);
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result ? result.error : "";
        throw new Error(typeof message === "string" ? message : "Could not load student QR code.");
      }
      if (!result || typeof result !== "object" || !("qrToken" in result) || typeof result.qrToken !== "string") {
        throw new Error("The student QR code response was invalid.");
      }
      const qr = result as StudentQr;
      const image = await QRCode.toDataURL(qr.qrToken, { width: 260, margin: 2, errorCorrectionLevel: "M" });
      setQrStudent(qr);
      setQrImage(image);
    } catch (caught) {
      setQrError(caught instanceof Error ? caught.message : "Could not load student QR code.");
    } finally {
      setQrLoading(false);
    }
  }

  function exportCsv() {
    const header = ["Name", "Register number", "Email", "Phone", "Department", "Academic year"];
    const rows = students.map((student) => [
      student.name, student.registerNo, student.email, student.phone, student.department.name, student.academicYear,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "edumanage-students.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> CAMPUS DIRECTORY</div><h1>Students</h1><p>Manage student records and keep all your information up to date.</p></div>
        <button className="button button-primary" onClick={openCreate}><Icon name="plus" size={18} /> Add student</button>
      </div>
      {toast && <div className="toast-message" role="status"><Icon name="check" size={17} />{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div>}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}

      <section className="panel students-panel">
        <div className="student-toolbar">
          <div className="directory-title"><div><h2>All students <span className="count-chip">{loading ? "…" : displayCount}</span></h2><p>A complete list of registered students</p></div></div>
          <div className="toolbar-actions">
            <label className="search-field"><Icon name="search" size={18} /><input value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); }} placeholder="Search students…" aria-label="Search by name or register number" /></label>
            <label className="select-filter" aria-label="Filter by department"><Icon name="filter" size={17} /><select value={departmentFilter} onChange={(event) => { setLoading(true); setDepartmentFilter(event.target.value); }}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className="select-filter year-filter" aria-label="Filter by academic year"><select value={yearFilter} onChange={(event) => { setLoading(true); setYearFilter(event.target.value); }}><option value="">All years</option>{["Year 1", "Year 2", "Year 3", "Year 4"].map((year) => <option key={year}>{year}</option>)}</select></label>
            <ExportActions report="students" filters={{ search: search.trim(), departmentId: departmentFilter, academicYear: yearFilter }} />
            <button className="button button-outline" onClick={exportCsv} disabled={!students.length}><Icon name="download" size={17} /> CSV</button>
          </div>
        </div>

        {loading ? <div className="loading-panel table-loading"><span className="spinner" /> Loading students…</div> : students.length ? (
          <div className="table-scroll">
            <table className="data-table student-table">
              <thead><tr><th>STUDENT</th><th>REGISTER NO.</th><th>CONTACT</th><th>DEPARTMENT</th><th>YEAR</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{students.map((student, index) => (
                <tr key={student.id}>
                  <td><div className="student-cell"><div className={`avatar avatar-${index % 4}`}>{getInitials(student.name)}</div><strong>{student.name}</strong></div></td>
                  <td><span className="register-number">{student.registerNo}</span></td>
                  <td><div className="contact-cell"><span><Icon name="mail" size={14} />{student.email}</span><span><Icon name="phone" size={14} />{student.phone}</span></div></td>
                  <td><span className="department-badge">{student.department.code}</span> <span className="muted-cell department-name">{student.department.name}</span></td>
                  <td><span className="year-chip">{student.academicYear}</span></td>
                  <td><span className="status-badge status-enrolled"><i />{student.status === "ENROLLED" ? "Enrolled" : "Unknown"}</span></td>
                  <td><div className="row-actions"><button className="icon-button" title={`Show ${student.name} QR code`} aria-label={`Show ${student.name} QR code`} onClick={() => void openStudentQr(student)}><Icon name="qr" size={17} /></button><button className="icon-button" title={`Edit ${student.name}`} aria-label={`Edit ${student.name}`} onClick={() => openEdit(student)}><Icon name="edit" size={17} /></button>{isAdmin && <button className="icon-button icon-danger" title={`Delete ${student.name}`} aria-label={`Delete ${student.name}`} onClick={() => void deleteStudent(student)}><Icon name="trash" size={17} /></button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span className="empty-icon"><Icon name="students" /></span><strong>{search || departmentFilter || yearFilter ? "No matching students" : "No students added yet"}</strong><p>{search || departmentFilter || yearFilter ? "Try changing your search or filters." : "Add a student record to get started."}</p>{!(search || departmentFilter || yearFilter) && <button className="button button-primary button-small" onClick={openCreate}><Icon name="plus" size={16} /> Add student</button>}</div>
        )}
        <div className="table-footer"><span>Showing <strong>{students.length}</strong> student{students.length === 1 ? "" : "s"}</span><span>Changes are saved automatically to your database.</span></div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
            <div className="modal-header"><div><span className="modal-icon"><Icon name={editing ? "edit" : "students"} size={19} /></span><h2 id="student-modal-title">{editing ? "Edit student" : "Add a student"}</h2><p>{editing ? "Update this student’s information." : "Enter the student details below to add them to your directory."}</p></div><button className="icon-button" onClick={() => setModalOpen(false)} aria-label="Close dialog"><Icon name="close" /></button></div>
            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="form-field form-full"><span>Full name <b>*</b></span><input autoFocus required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Alex Johnson" /></label>
                <label className="form-field"><span>Register number <b>*</b></span><input required maxLength={30} value={form.registerNo} onChange={(event) => setForm({ ...form, registerNo: event.target.value })} placeholder="e.g. EDU2024010" /></label>
                <label className="form-field"><span>Phone number <b>*</b></span><input required maxLength={25} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" /></label>
                <label className="form-field form-full"><span>Email address <b>*</b></span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="student@example.edu" /></label>
                <label className="form-field"><span>Department <b>*</b></span><select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
                <label className="form-field"><span>Academic year <b>*</b></span><select required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })}>{["Year 1", "Year 2", "Year 3", "Year 4"].map((year) => <option key={year}>{year}</option>)}</select></label>
              </div>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name={editing ? "check" : "plus"} size={17} />{editing ? "Save changes" : "Add student"}</>}</button></div>
            </form>
          </section>
        </div>
      )}

      {(qrLoading || qrError || qrStudent) && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !qrLoading) { setQrStudent(null); setQrError(""); } }}>
          <section className="modal-card student-qr-modal" role="dialog" aria-modal="true" aria-labelledby="student-qr-title">
            <div className="modal-header no-print">
              <div><span className="modal-icon"><Icon name="qr" size={19} /></span><h2 id="student-qr-title">Student QR Code</h2><p>Opaque code for attendance scanning; it contains no student details.</p></div>
              <button className="icon-button" onClick={() => { setQrStudent(null); setQrError(""); }} aria-label="Close QR code dialog" disabled={qrLoading}><Icon name="close" /></button>
            </div>
            {qrLoading ? <div className="loading-panel"><span className="spinner" /> Loading student QR code…</div>
              : qrError ? <div className="alert alert-error" role="alert">{qrError}<button onClick={() => setQrError("")}>Dismiss</button></div>
                : qrStudent && qrImage ? (
                  <>
                    <div className="student-qr-print">
                      <Image src={qrImage} alt={`Attendance QR code for ${qrStudent.name}`} width={260} height={260} unoptimized />
                      <strong>{qrStudent.name}</strong>
                      <span>{qrStudent.registerNo} · {qrStudent.department.name}</span>
                      <small>This QR code is a bearer code and does not verify its holder’s identity.</small>
                    </div>
                    <div className="modal-actions no-print">
                      <button className="button button-outline" onClick={() => { setQrStudent(null); setQrImage(""); }}>Close</button>
                      <button className="button button-primary" onClick={() => window.print()}><Icon name="download" size={16} /> Print QR code</button>
                    </div>
                  </>
                ) : null}
          </section>
        </div>
      )}
    </>
  );
}
