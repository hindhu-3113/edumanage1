import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="auth-page">
      <section className="auth-card auth-message-card">
        <span className="auth-eyebrow">ACCESS RESTRICTED</span>
        <h1>You don’t have permission to view this page</h1>
        <p>Ask an administrator if you need access to this area.</p>
        <Link className="auth-submit auth-link-button" href="/">Return to dashboard</Link>
      </section>
    </main>
  );
}
