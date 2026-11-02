import type { Metadata } from "next";
import { Suspense } from "react";
import AppShell from "@/app/components/app-shell";
import Providers from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduManage | Student Management",
  description: "Student records, attendance, and academic insights in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Suspense fallback={<div className="loading-panel"><span className="spinner" /> Loading EduManage…</div>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
