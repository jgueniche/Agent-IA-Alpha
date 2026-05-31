/**
 * Scoring lexical pour la recherche de connaissances (RAG, étape "retrieval").
 *
 * Implémentation volontairement simple et déterministe (overlap de tokens +
 * boosts modalité/type/site), sans dépendance externe, donc 100% souveraine et
 * testable hors-ligne. En production, ce module peut être remplacé par un
 * retriever vectoriel (pgvector + embeddings hébergés en EEE) SANS changer
 * l'interface : l'agent consomme toujours `search()` côté core-api.
 */

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'ou',
  'pour', 'est', 'elle', 'vous', 'mon', 'ma', 'mes', 'que', 'qui', 'quoi',
  'quel', 'quelle', 'quelles', 'quels', 'dois', 'faut', 'avec', 'sans', 'sur',
  'dans', 'ce', 'cet', 'cette', 'avant', 'apres', 'etre', 'avoir', 'votre',
  'vos', 'mais', 'pas', 'plus', 'son', 'sa', 'ses', 'par', 'les',
]);

/** Minuscule + suppression des accents + remplacement des séparateurs. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques combinants
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Découpe en tokens significatifs (>= 3 lettres, hors mots vides). */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export interface ScorableItem {
  title: string;
  content: string;
  modality: string | null;
  type: string;
  siteSlug: string | null;
}

/**
 * Score de pertinence d'un item pour une requête. Plus élevé = plus pertinent.
 * Les correspondances dans le titre pèsent davantage ; bonus si modalité/type/
 * site correspondent au contexte de la demande.
 */
export function scoreItem(
  queryTokens: string[],
  item: ScorableItem,
  ctx: { modality?: string | null; type?: string | null; siteSlug?: string | null },
): number {
  const titleTokens = new Set(tokenize(item.title));
  const contentTokens = new Set(tokenize(item.content));
  let score = 0;
  for (const t of queryTokens) {
    if (titleTokens.has(t)) score += 3;
    else if (contentTokens.has(t)) score += 1;
  }
  if (ctx.modality && item.modality === ctx.modality) score += 3;
  if (ctx.type && item.type === ctx.type) score += 2;
  if (ctx.siteSlug && item.siteSlug === ctx.siteSlug) score += 2;
  return score;
}
