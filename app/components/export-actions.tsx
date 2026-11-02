"use client";

import { Icon } from "@/app/components/icons";

type ExportReport = "students" | "attendance" | "fees" | "performance" | "teachers" | "subjects";

export default function ExportActions({
  report,
  filters,
}: {
  report: ExportReport;
  filters?: Record<string, string>;
}) {
  function getHref(format: "xlsx" | "pdf") {
    const params = new URLSearchParams(filters);
    params.set("format", format);
    return `/api/exports/${report}?${params.toString()}`;
  }

  return (
    <div className="export-actions" aria-label={`${report} report exports`}>
      <a className="button button-outline button-small" href={getHref("xlsx")} aria-label={`Export ${report} to Excel`}>
        <Icon name="download" size={15} /> Excel
      </a>
      <a className="button button-outline button-small" href={getHref("pdf")} aria-label={`Export ${report} to PDF`}>
        <Icon name="download" size={15} /> PDF
      </a>
    </div>
  );
}
