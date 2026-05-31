import { normalize, scoreItem, tokenize } from './text-score';

describe('text-score', () => {
  it('normalise en retirant accents et ponctuation sans casser les mots', () => {
    expect(normalize('Préparation : à jeun ?')).toBe('preparation a jeun');
    expect(normalize('présentez-vous')).toBe('presentez vous');
  });

  it('tokenize en retirant mots vides et tokens courts', () => {
    const toks = tokenize('Faut-il être à jeun pour une IRM ?');
    expect(toks).toContain('jeun');
    expect(toks).toContain('irm');
    expect(toks).not.toContain('il');
    expect(toks).not.toContain('etre');
  });

  it('score plus haut un item dont la modalité et les mots correspondent', () => {
    const item = {
      title: 'IRM — contre-indications',
      content: 'pacemaker, implants, claustrophobie, grossesse',
      modality: 'irm',
      type: 'contre_indication',
      siteSlug: null,
    };
    const q = tokenize('est-ce que je peux passer une IRM avec un pacemaker');
    const score = scoreItem(q, item, { modality: 'irm', type: null, siteSlug: null });
    const scoreNoCtx = scoreItem(q, item, {});
    expect(score).toBeGreaterThan(scoreNoCtx);
    expect(scoreNoCtx).toBeGreaterThan(0);
  });
});
