'use client';

import type { ReactNode, SVGProps } from 'react';
import { LabelInfo } from '../lib/labels';

/* --- Icônes (traits type lucide, inline pour rester sans dépendance) -------- */

function icon(paths: ReactNode) {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const IconGauge = icon(
  <>
    <path d="M12 21a9 9 0 1 1 9-9" />
    <path d="M12 12l5-3" />
    <path d="M21 16h-2" />
  </>,
);

export const IconPhone = icon(
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
);

export const IconPhoneCallback = icon(
  <>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    <path d="M16 2v6h6" />
  </>,
);

export const IconBook = icon(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </>,
);

export const IconSend = icon(
  <>
    <path d="m22 2-7 20-4-9-9-4z" />
    <path d="M22 2 11 13" />
  </>,
);

export const IconHome = icon(
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </>,
);

export const IconLogout = icon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

export const IconArrowLeft = icon(
  <>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </>,
);

export const IconInbox = icon(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
);

export const IconAlert = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </>,
);

export const IconCheck = icon(<path d="M20 6 9 17l-5-5" />);

export const IconMic = icon(
  <>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
    <path d="M12 18v4" />
  </>,
);

export const IconStop = icon(<rect x="6" y="6" width="12" height="12" rx="2" />);

/* --- Briques UI -------------------------------------------------------------- */

export function Badge({ info }: { info: LabelInfo }) {
  return <span className={`badge ${info.tone}`}>{info.label}</span>;
}

export function Alerts({
  error,
  info,
}: {
  error?: string | null;
  info?: string | null;
}) {
  return (
    <>
      {error && (
        <div className="alert alert-error" role="alert">
          <IconAlert style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="alert alert-success" role="status">
          <IconCheck style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <span>{info}</span>
        </div>
      )}
    </>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = IconInbox,
}: {
  title: string;
  hint?: string;
  icon?: (props: SVGProps<SVGSVGElement>) => ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon />
      </div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  );
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card skeleton-card" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ width: `${90 - i * 18}%` }}
        />
      ))}
    </div>
  );
}
