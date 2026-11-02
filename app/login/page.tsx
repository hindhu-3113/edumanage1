import { Suspense } from "react";
import LoginForm from "@/app/components/login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="auth-page"><section className="auth-card">Loading sign in…</section></main>}>
      <LoginForm />
    </Suspense>
  );
}
