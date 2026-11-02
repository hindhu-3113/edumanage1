import type { SVGProps } from "react";

type IconName =
  | "dashboard"
  | "students"
  | "attendance"
  | "settings"
  | "search"
  | "plus"
  | "chevron"
  | "menu"
  | "close"
  | "calendar"
  | "qr"
  | "download"
  | "edit"
  | "trash"
  | "mail"
  | "phone"
  | "filter"
  | "arrow"
  | "check"
  | "clock"
  | "graduation"
  | "building"
  | "sparkles"
  | "logout"
  | "more"
  | "eye"
  | "eyeOff";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
    </>
  ),
  students: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  attendance: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18M8 16l2 2 5-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  calendar: <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zm7 0v3m-7 4h3m4-4v4h-4" /></>,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3" />,
  edit: <path d="m16 4 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />,
  trash: <path d="M3 6h18m-2 0-1 14H6L5 6m4 0V4h6v2m-5 4v7m4-7v7" />,
  mail: <path d="M4 5h16v14H4zM4 7l8 6 8-6" />,
  phone: <path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />,
  filter: <path d="M4 6h16M7 12h10m-7 6h4" />,
  arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <path d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  graduation: <path d="m2 10 10-5 10 5-10 5-10-5Zm4 2v5c3.5 3 8.5 3 12 0v-5m4-2v6" />,
  building: <path d="M4 21V5l8-3 8 3v16m-16 0h16M8 9h1m6 0h1m-8 4h1m6 0h1m-5 8v-4h2v4" />,
  sparkles: <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />,
  logout: <path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a15.7 15.7 0 0 1-3.2 4.1M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" /></>,
};

export function Icon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
