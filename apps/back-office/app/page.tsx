import { redirect } from 'next/navigation';

/** Racine : renvoie vers l'accueil (la garde d'auth redirige vers /login si besoin). */
export default function Home() {
  redirect('/dashboard');
}
