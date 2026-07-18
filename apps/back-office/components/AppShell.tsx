'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getToken, me } from '../lib/api';
import { ROLE, textOf } from '../lib/labels';
import {
  IconBook,
  IconGauge,
  IconHome,
  IconLogout,
  IconPhone,
  IconPhoneCallback,
  IconSend,
} from './ui';

interface Profile {
  email: string;
  displayName: string;
  role: string;
}

const NAV = [
  { href: '/dashboard', label: 'Accueil', icon: IconHome, section: null },
  { href: '/supervision', label: 'Supervision', icon: IconGauge, section: 'Activité' },
  { href: '/calls', label: "Journal d'appels", icon: IconPhone, section: null },
  { href: '/callbacks', label: 'File de rappel', icon: IconPhoneCallback, section: 'Traitement' },
  { href: '/followups', label: 'Relances', icon: IconSend, section: null },
  { href: '/knowledge', label: 'Base de connaissance', icon: IconBook, section: 'Référentiel' },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/**
 * Coquille commune : sidebar de navigation + garde d'authentification.
 * Redirige vers /login si aucune session valide.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    me()
      .then(setProfile)
      .catch(() => {
        clearToken();
        router.replace('/login');
      });
  }, [router]);

  function logout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <div className="brand-name">Alpha Imagerie</div>
            <div className="brand-sub">Back-office agent vocal</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <div key={item.href}>
                {item.section && (
                  <div className="nav-section">{item.section}</div>
                )}
                <a
                  href={item.href}
                  className={`nav-link${active ? ' active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon />
                  {item.label}
                </a>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">
            {profile ? initials(profile.displayName) : '…'}
          </div>
          <div className="user-meta">
            <div className="user-name">{profile?.displayName ?? 'Chargement…'}</div>
            <div className="user-role">
              {profile ? textOf(ROLE, profile.role) : ''}
            </div>
          </div>
          <button
            className="logout-btn"
            onClick={logout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <IconLogout style={{ width: 17, height: 17 }} />
          </button>
        </div>
      </aside>
      <div className="content">
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
