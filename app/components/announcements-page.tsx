"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/app/components/icons";
import { useCurrentRole } from "@/lib/use-current-role";

type Priority = "LOW" | "MEDIUM" | "HIGH";
type Category = "General" | "Academics" | "Fees" | "Attendance" | "Events" | "Holidays" | "Assignments";
type Announcement = {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  publishedAt: string;
  expiresAt: string | null;
  isSample: boolean;
  status: "ACTIVE" | "EXPIRED";
};
type AnnouncementForm = {
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  publishedAt: string;
  expiresAt: string;
};

const categories: Category[] = ["General", "Academics", "Fees", "Attendance", "Events", "Holidays", "Assignments"];
const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const categoryIcons: Record<Category, "mail" | "graduation" | "building" | "attendance" | "calendar" | "clock" | "edit"> = {
  General: "mail",
  Academics: "graduation",
  Fees: "building",
  Attendance: "attendance",
  Events: "calendar",
  Holidays: "clock",
  Assignments: "edit",
};
const emptyForm: AnnouncementForm = {
  title: "",
  description: "",
  category: "General",
  priority: "MEDIUM",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: "",
};

function getErrorMessage(result: unknown, fallback: string): string {
  return result && typeof result === "object" && "error" in result && typeof result.error === "string"
    ? result.error
    : fallback;
}

function dateInputValue(value: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function formatDate(value: string | null): string {
  if (!value) return "No expiry";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

async function requestAnnouncements(search: string, category: string, priority: string): Promise<Announcement[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (category) params.set("category", category);
  if (priority) params.set("priority", priority);
  const response = await fetch(`/api/announcements?${params}`);
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(getErrorMessage(result, "Could not load announcements."));
  if (!Array.isArray(result)) throw new Error("The announcement list response was invalid.");
  return result as Announcement[];
}

export default function AnnouncementsPage() {
  const { isAdmin } = useCurrentRole();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [details, setDetails] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);

  useEffect(() => {
    let active = true;
    requestAnnouncements(search, categoryFilter, priorityFilter)
      .then((result) => {
        if (active) {
          setAnnouncements(result);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setAnnouncements([]);
          setError(caught instanceof Error ? caught.message : "Could not load announcements.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [search, categoryFilter, priorityFilter]);

  async function refreshAnnouncements() {
    setLoading(true);
    setError("");
    try {
      setAnnouncements(await requestAnnouncements(search, categoryFilter, priorityFilter));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, publishedAt: new Date().toISOString().slice(0, 10) });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(announcement: Announcement) {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      description: announcement.description,
      category: announcement.category,
      priority: announcement.priority,
      publishedAt: dateInputValue(announcement.publishedAt),
      expiresAt: dateInputValue(announcement.expiresAt),
    });
    setFormError("");
    setDetails(null);
    setFormOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
    };
    if (!normalized.title || !normalized.description || !normalized.publishedAt) {
      setFormError("Title, description, and published date are required.");
      return;
    }
    if (normalized.expiresAt && normalized.expiresAt < normalized.publishedAt) {
      setFormError("Expiry date cannot be before the published date.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(editing ? `/api/announcements/${editing.id}` : "/api/announcements", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not save announcement."));
      setFormOpen(false);
      setToast(editing ? "Announcement updated successfully." : "Announcement published successfully.");
      await refreshAnnouncements();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(announcement: Announcement) {
    if (!window.confirm(`Delete “${announcement.title}”? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not delete announcement."));
      setDetails(null);
      setToast("Announcement deleted successfully.");
      await refreshAnnouncements();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete announcement.");
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> CAMPUS UPDATES</div>
          <h1>Announcements</h1>
          <p>Share important updates, deadlines, and events with your campus community.</p>
        </div>
        {isAdmin && <button className="button button-primary" onClick={openCreate}>
          <Icon name="plus" size={18} /> New announcement
        </button>}
      </div>

      {toast && (
        <div className="toast-message" role="status">
          <Icon name="check" size={17} />{toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={16} /></button>
        </div>
      )}
      {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => void refreshAnnouncements()}>Try again</button></div>}

      <section className="panel announcements-panel" aria-label="Announcement board">
        <div className="student-toolbar">
          <div className="directory-title">
            <div>
              <h2>Announcement board <span className="count-chip">{loading ? "…" : announcements.length}</span></h2>
              <p>Browse current and past campus announcements</p>
            </div>
          </div>
          <div className="toolbar-actions announcement-filters">
            <label className="search-field">
              <Icon name="search" size={18} />
              <input
                value={search}
                onChange={(event) => { setLoading(true); setSearch(event.target.value); }}
                placeholder="Search announcements…"
                aria-label="Search announcements"
              />
            </label>
            <label className="sr-only" htmlFor="announcement-category-filter">Filter by category</label>
            <select id="announcement-category-filter" value={categoryFilter} onChange={(event) => { setLoading(true); setCategoryFilter(event.target.value); }}>
              <option value="">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="sr-only" htmlFor="announcement-priority-filter">Filter by priority</label>
            <select id="announcement-priority-filter" value={priorityFilter} onChange={(event) => { setLoading(true); setPriorityFilter(event.target.value); }}>
              <option value="">All priorities</option>
              {priorities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel"><span className="spinner" /> Loading announcements…</div>
        ) : announcements.length ? (
          <div className="announcement-grid">
            {announcements.map((announcement) => (
              <article className={`announcement-card announcement-priority-${announcement.priority.toLowerCase()}`} key={announcement.id}>
                <span className={`announcement-icon announcement-icon-${announcement.category.toLowerCase()}`}>
                  <Icon name={categoryIcons[announcement.category]} size={20} />
                </span>
                <div className="announcement-card-content">
                  <div className="announcement-card-top">
                    <span className="announcement-category">{announcement.category}</span>
                    <span className={`announcement-priority-badge announcement-priority-badge-${announcement.priority.toLowerCase()}`}>
                      {announcement.priority.toLowerCase()} priority
                    </span>
                    {announcement.isSample && <span className="announcement-sample-badge">Sample</span>}
                    <span className={`announcement-status announcement-status-${announcement.status.toLowerCase()}`}>
                      {announcement.status === "ACTIVE" ? "Active" : "Expired"}
                    </span>
                  </div>
                  <button className="announcement-title-button" onClick={() => setDetails(announcement)}>
                    <h3>{announcement.title}</h3>
                  </button>
                  <p className="announcement-description">{announcement.description}</p>
                </div>
                <div className="announcement-card-side">
                  <div className="announcement-meta">
                    <span><small>Published</small><strong>{formatDate(announcement.publishedAt)}</strong></span>
                    <span><small>Expiry date</small><strong>{formatDate(announcement.expiresAt)}</strong></span>
                  </div>
                  <div className="announcement-card-actions">
                    <button className="icon-button" title={`View ${announcement.title}`} aria-label={`View ${announcement.title}`} onClick={() => setDetails(announcement)}><Icon name="search" size={16} /></button>
                    {isAdmin && <button className="icon-button" title={`Edit ${announcement.title}`} aria-label={`Edit ${announcement.title}`} onClick={() => openEdit(announcement)}><Icon name="edit" size={16} /></button>}
                    {isAdmin && <button className="icon-button icon-danger" title={`Delete ${announcement.title}`} aria-label={`Delete ${announcement.title}`} onClick={() => void deleteAnnouncement(announcement)}><Icon name="trash" size={16} /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state announcement-empty">
            <span className="empty-icon"><Icon name="mail" size={22} /></span>
            <strong>{search || categoryFilter || priorityFilter ? "No matching announcements" : "No announcements yet"}</strong>
            <p>{search || categoryFilter || priorityFilter ? "Try changing your search or filters." : "Create an announcement to share your first campus update."}</p>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
          <section className="modal-card announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-form-title">
            <div className="modal-header">
              <div><h2 id="announcement-form-title">{editing ? "Edit announcement" : "New announcement"}</h2><p>Enter the update and choose when it should be shown.</p></div>
              <button className="icon-button" aria-label="Close dialog" disabled={saving} onClick={() => setFormOpen(false)}><Icon name="close" size={18} /></button>
            </div>
            <form onSubmit={(event) => void submitForm(event)}>
              <div className="form-grid announcement-form-grid">
                <label className="form-field announcement-field-full"><span>Title <b>*</b></span><input autoFocus maxLength={140} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                <label className="form-field announcement-field-full"><span>Description <b>*</b></span><textarea maxLength={5000} required rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                <label className="form-field"><span>Category <b>*</b></span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Priority <b>*</b></span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="form-field"><span>Published date <b>*</b></span><input type="date" required value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} /></label>
                <label className="form-field"><span>Expiry date</span><input type="date" min={form.publishedAt} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
              </div>
              {formError && <div className="form-error" role="alert">{formError}</div>}
              <div className="modal-actions">
                <button type="button" className="button button-outline" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={saving}>{saving ? <><span className="button-spinner" /> Saving…</> : editing ? "Save changes" : "Publish announcement"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {details && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
          <section className="modal-card announcement-details-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-details-title">
            <div className="modal-header">
              <div><span className="announcement-category">{details.category}</span><h2 id="announcement-details-title">{details.title}</h2></div>
              <button className="icon-button" aria-label="Close details" onClick={() => setDetails(null)}><Icon name="close" size={18} /></button>
            </div>
            <p className="announcement-details-description">{details.description}</p>
            <div className="announcement-details-facts">
              <div><span>Priority</span><strong className={`announcement-priority-badge announcement-priority-badge-${details.priority.toLowerCase()}`}>{details.priority}</strong></div>
              <div><span>Status</span><strong>{details.status === "ACTIVE" ? "Active" : "Expired"}</strong></div>
              <div><span>Published</span><strong>{formatDate(details.publishedAt)}</strong></div>
              <div><span>Expiry</span><strong>{formatDate(details.expiresAt)}</strong></div>
            </div>
            <div className="modal-actions">
              {isAdmin && <button className="button button-outline" onClick={() => openEdit(details)}><Icon name="edit" size={15} /> Edit</button>}
              <button className="button button-primary" onClick={() => setDetails(null)}>Close</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
