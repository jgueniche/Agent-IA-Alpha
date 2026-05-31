import { redirect } from 'next/navigation';

/** Racine : redirige vers la connexion (Phase 0). */
export default function Home() {
  redirect('/login');
}
