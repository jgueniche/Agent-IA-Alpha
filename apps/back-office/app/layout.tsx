import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Alpha Imagerie — Back-office',
  description: 'Supervision des appels et des rappels',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
