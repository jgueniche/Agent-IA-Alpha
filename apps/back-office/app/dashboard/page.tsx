'use client';

import { useEffect, useState } from 'react';
import { me } from '../../lib/api';
import { AppShell } from '../../components/AppShell';
import {
  IconBook,
  IconGauge,
  IconPhone,
  IconPhoneCallback,
  IconSend,
  PageHeader,
} from '../../components/ui';

interface Profile {
  displayName: string;
  role: string;
}

const SECTIONS = [
  {
    href: '/callbacks',
    icon: IconPhoneCallback,
    title: 'File de rappel',
    desc: 'Patients à rappeler suite aux appels non résolus par l’agent. À traiter en priorité.',
  },
  {
    href: '/calls',
    icon: IconPhone,
    title: "Journal d'appels",
    desc: 'Historique des appels pris par l’agent vocal, avec transcriptions et résultats.',
  },
  {
    href: '/followups',
    icon: IconSend,
    title: 'Relances',
    desc: 'Relances SMS / WhatsApp / vocales : programmation, suivi des envois, opt-out.',
  },
  {
    href: '/knowledge',
    icon: IconBook,
    title: 'Base de connaissance',
    desc: 'Préparations d’examens, horaires, accès… Les réponses que l’agent donne aux patients.',
  },
  {
    href: '/supervision',
    icon: IconGauge,
    title: 'Supervision',
    desc: 'Métriques de l’agent : taux de résolution, transferts, latence, motifs (responsable/admin).',
  },
];

/** Accueil : point d'entrée vers les sections du back-office. */
export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    me()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const hello = profile ? `Bonjour ${profile.displayName.split(' ')[0]} 👋` : 'Bonjour 👋';

  return (
    <AppShell>
      <PageHeader
        title={hello}
        sub="L'agent vocal répond aux appels en débordement ; voici ce qui demande votre attention."
      />
      <div className="hub-grid">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <a key={s.href} href={s.href} className="hub-card">
              <div className="hub-icon">
                <Icon />
              </div>
              <div>
                <div className="hub-title">{s.title}</div>
                <div className="hub-desc">{s.desc}</div>
              </div>
            </a>
          );
        })}
      </div>
    </AppShell>
  );
}
