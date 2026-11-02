"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "@/app/components/icons";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
};

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/users", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load accounts.");
        if (active) setUsers(payload);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load accounts.");
      });
    return () => { active = false; };
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create account.");
      setUsers((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setEmail("");
      setPassword("");
      setRole("STAFF");
      setMessage("Account created. The password was securely hashed.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function updateUser(user: ManagedUser, changes: Pick<ManagedUser, "role" | "isActive">) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not update account.");
      setUsers((current) => current.map((item) => item.id === user.id ? payload : item));
      setMessage(`Updated ${payload.name}’s account.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update account.");
    }
  }

  return (
    <div className="page-stack user-admin-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>User Management</h1>
          <p>Create staff accounts and manage roles and access.</p>
        </div>
      </div>

      <section className="panel user-create-panel">
        <div className="panel-heading">
          <div><h2>Create account</h2><p>Passwords are hashed before they are stored.</p></div>
          <span className="panel-heading-icon"><Icon name="plus" size={18} /></span>
        </div>
        <form className="user-create-form" onSubmit={createUser}>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          <label>Temporary password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
          <label>Role<select value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "STAFF")}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        {message && <p className="success-message" role="status">{message}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="panel user-list-panel">
        <div className="panel-heading">
          <div><h2>Registered users</h2><p>{users.length} account{users.length === 1 ? "" : "s"}</p></div>
        </div>
        <div className="user-list">
          {users.map((user) => {
            const isSelf = user.id === session?.user?.id;
            return (
              <article className="user-row" key={user.id}>
                <div className="user-row-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                <div className="user-row-identity"><strong>{user.name}{isSelf ? " (you)" : ""}</strong><span>{user.email}</span></div>
                <label className="user-role-control">Role
                  <select
                    value={user.role}
                    disabled={isSelf}
                    onChange={(event) => void updateUser(user, { role: event.target.value as ManagedUser["role"], isActive: user.isActive })}
                  >
                    <option value="STAFF">Staff</option><option value="ADMIN">Admin</option>
                  </select>
                </label>
                <label className="user-active-toggle">
                  <input
                    type="checkbox"
                    checked={user.isActive}
                    disabled={isSelf}
                    onChange={(event) => void updateUser(user, { role: user.role, isActive: event.target.checked })}
                  />
                  <span>{user.isActive ? "Active" : "Inactive"}</span>
                </label>
              </article>
            );
          })}
          {!users.length && <p className="empty-state">No user accounts have been created.</p>}
        </div>
      </section>
    </div>
  );
}
