"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/app/components/icons";
import PasswordInput from "@/app/components/password-input";

type LoginRole = "ADMIN" | "STAFF";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState<LoginRole | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) router.replace("/");
  }, [router, session?.user?.id, status]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        loginType: loginRole ?? "",
        redirect: false,
        redirectTo: safeCallback(searchParams.get("callbackUrl")),
      });
      if (!result || result.error) {
        setError(
          result?.code === "too-many-attempts"
            ? "Too many sign-in attempts. Try again in 15 minutes."
            : "Email or password is incorrect.",
        );
        return;
      }
      router.replace(safeCallback(searchParams.get("callbackUrl")));
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && session?.user?.id) return null;

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-labelledby="login-title">
        <aside className="auth-showcase">
          <div className="auth-brand">
            <span className="brand-mark"><Icon name="graduation" size={23} /></span>
            <span className="brand-copy"><strong>edu<span>manage</span></strong><small>STUDENT PORTAL</small></span>
          </div>
          <div className="auth-showcase-copy">
            <span className="auth-eyebrow">YOUR CAMPUS, CONNECTED</span>
            <h2>Make every college day count.</h2>
            <p>One clear view of your students, academics, and college community.</p>
          </div>
          <div className="auth-showcase-card">
            <span className="auth-showcase-icon"><Icon name="dashboard" size={19} /></span>
            <div><strong>Everything in one place</strong><span>Student records, attendance, and academic progress.</span></div>
          </div>
          <span className="auth-showcase-footer">A smarter way to manage your campus</span>
        </aside>
        <div className="auth-panel">
          <div className="auth-intro">
            <span className="auth-eyebrow">WELCOME BACK</span>
            <h1 id="login-title">{loginRole ? `${loginRole} Login` : "Sign in to EduManage"}</h1>
            <p>{loginRole ? `Continue with your ${loginRole === "ADMIN" ? "administrator" : "staff"} account.` : "Choose the account type you use to access your workspace."}</p>
          </div>
          <div className="auth-role-options" role="group" aria-label="Choose a login type">
            <button
              type="button"
              className={`auth-role-option ${loginRole === "ADMIN" ? "auth-role-option-active" : ""}`}
              aria-pressed={loginRole === "ADMIN"}
              onClick={() => { setLoginRole("ADMIN"); setError(""); }}
            >
              <span className="auth-role-icon"><Icon name="building" size={19} /></span>
              <span><strong>ADMIN LOGIN</strong><small>Administration access</small></span>
              {loginRole === "ADMIN" && <Icon name="check" size={16} />}
            </button>
            <button
              type="button"
              className={`auth-role-option ${loginRole === "STAFF" ? "auth-role-option-active" : ""}`}
              aria-pressed={loginRole === "STAFF"}
              onClick={() => { setLoginRole("STAFF"); setError(""); }}
            >
              <span className="auth-role-icon"><Icon name="students" size={19} /></span>
              <span><strong>STAFF LOGIN</strong><small>Academic and daily tasks</small></span>
              {loginRole === "STAFF" && <Icon name="check" size={16} />}
            </button>
          </div>
          {loginRole ? (
            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label htmlFor="login-password">Password</label>
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
              />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? "Signing in…" : `Sign in as ${loginRole === "ADMIN" ? "Admin" : "Staff"}`}
                {!submitting && <Icon name="arrow" size={16} />}
              </button>
              <button type="button" className="auth-change-role" onClick={() => { setLoginRole(null); setError(""); }}>
                Choose a different login type
              </button>
            </form>
          ) : (
            <p className="auth-role-prompt">Select ADMIN or STAFF to display the matching sign-in form.</p>
          )}
          <p className="auth-signup-prompt">New to EduManage? <Link href="/signup">Create an account</Link></p>
          <p className="auth-footnote">Public registration creates STAFF accounts only. Administrator access is provisioned separately.</p>
        </div>
      </section>
    </main>
  );
}

function safeCallback(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
