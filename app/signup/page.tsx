"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/components/icons";
import PasswordInput from "@/app/components/password-input";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const payload: { message?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create your account.");
      setSuccess(payload.message ?? "Account created. You can now sign in.");
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page-signup">
      <section className="auth-layout auth-layout-signup">
        <aside className="auth-showcase">
          <div className="auth-brand">
            <span className="brand-mark"><Icon name="graduation" size={23} /></span>
            <span className="brand-copy"><strong>edu<span>manage</span></strong><small>STUDENT PORTAL</small></span>
          </div>
          <div className="auth-showcase-copy">
            <span className="auth-eyebrow">WELCOME TO YOUR CAMPUS</span>
            <h2>Bring your campus into focus.</h2>
            <p>Create your workspace account and stay connected to the day-to-day.</p>
          </div>
          <div className="auth-showcase-card">
            <span className="auth-showcase-icon"><Icon name="students" size={19} /></span>
            <div><strong>Made for campus teams</strong><span>Keep the details organized and the important work moving.</span></div>
          </div>
          <span className="auth-showcase-footer">A smarter way to manage your campus</span>
        </aside>
        <div className="auth-panel">
          <div className="auth-intro">
            <span className="auth-eyebrow">GET STARTED</span>
            <h1 id="signup-title">Create your account</h1>
            <p>Set up your STAFF account with your name and work email.</p>
          </div>
          <form className="auth-form" onSubmit={submit} aria-labelledby="signup-title">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="signup-password">Password</label>
            <PasswordInput
              id="signup-password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              minLength={12}
            />
            <span className="auth-password-hint">12–128 characters with uppercase, lowercase, a number, and a symbol.</span>
            <label htmlFor="signup-confirm-password">Confirm password</label>
            <PasswordInput
              id="signup-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              minLength={12}
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            {success && <p className="auth-success" role="status">{success}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
              {!submitting && <Icon name="arrow" size={16} />}
            </button>
          </form>
          <p className="auth-signup-prompt">Already have an account? <Link href="/login">Sign in</Link></p>
          <p className="auth-footnote">Public registration creates STAFF accounts only. Administrator accounts are set up separately.</p>
        </div>
      </section>
    </main>
  );
}
