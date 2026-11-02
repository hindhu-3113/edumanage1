"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";

type Department = { id: string; name: string; code: string; _count: { students: number } };

export default function SettingsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDepartments() {
      try {
        const response = await fetch("/api/departments");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load departments.");
        setDepartments(result as Department[]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load departments.");
      } finally {
        setLoading(false);
      }
    }
    void loadDepartments();
  }, []);

  return (
    <>
      <div className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> WORKSPACE PREFERENCES</div><h1>Settings</h1><p>System information and the academic structure configured for your campus.</p></div>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-header"><div><h2>Departments</h2><p>Departments available for student records</p></div><span className="count-chip">{loading ? "…" : departments.length}</span></div>
          {loading ? <div className="loading-panel"><span className="spinner" /> Loading departments…</div> : departments.length ? (
            <div className="settings-departments">{departments.map((department, index) => (
              <div className="settings-department" key={department.id}>
                <span className={`department-icon department-icon-${index % 4}`}><Icon name="building" size={19} /></span>
                <div className="settings-department-name"><strong>{department.name}</strong><span>{department.code}</span></div>
                <span className="settings-student-count">{department._count.students} student{department._count.students === 1 ? "" : "s"}</span>
              </div>
            ))}</div>
          ) : <div className="empty-state"><strong>No departments available</strong></div>}
          <div className="settings-note"><Icon name="sparkles" size={17} /><p>Departments are configured in the database seed script. Update <code>prisma/seed.mjs</code> and run <code>npm run db:seed</code> to add more.</p></div>
        </section>

        <section className="panel settings-panel">
          <div className="panel-header"><div><h2>Application</h2><p>EduManage workspace details</p></div><span className="settings-live"><i className="status-dot" /> Active</span></div>
          <div className="settings-info-list">
            <div><span>Application</span><strong>EduManage</strong></div>
            <div><span>Academic year</span><strong>2025–26</strong></div>
            <div><span>Database</span><strong><span className="database-dot" /> SQLite · Local</strong></div>
            <div><span>Student records</span><strong>Persistent</strong></div>
          </div>
          <div className="settings-info-callout"><span className="callout-check"><Icon name="check" size={16} /></span><div><strong>Your data is saved locally</strong><p>Student and attendance records are stored in the project’s SQLite database and remain available between sessions.</p></div></div>
        </section>
      </div>
      <footer className="page-footer settings-footer"><span>© 2025 EduManage. Made for brighter futures.</span><span>All systems operational <i className="status-dot" /></span></footer>
    </>
  );
}
