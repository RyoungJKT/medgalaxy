import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { buildSpotlightList } from '../src/components/Spotlight';
import { ppd } from '../src/utils/captions';

// buildSpotlightList shuffles its own output, so index by disease id rather
// than by position: the set of captions is what this file is about.
const idMap = Object.fromEntries(diseases.map((d, i) => [d.id, i]));
const caps = Object.fromEntries(
  buildSpotlightList(idMap, diseases).map((s) => [diseases[s.id].id, s.caption]),
);

const topKiller = diseases.reduce((a, b) => (b.mortality > a.mortality ? b : a)).id;
const topPpd = diseases
  .filter((d) => d.mortality > 0)
  .reduce((a, b) => (ppd(b) > ppd(a) ? b : a)).id;
const cancers = diseases.filter((d) => d.category === 'cancer');
const topCancerPapers = cancers.reduce((a, b) => (b.papers > a.papers ? b : a)).id;
const topCancerDeaths = cancers.reduce((a, b) => (b.mortality > a.mortality ? b : a)).id;

// A rotating caption may hold a value judgement the data cannot rank ("reshaped
// modern medicine"), but it may never hold a RANKING the data file itself
// settles differently. "Most researched per capita" sat on cystic fibrosis
// while the same file ranked leprosy, anorexia nervosa and West Nile virus
// above it on papers per death, and the Explode overlay's own "Most papers per
// death" column said so two clicks away.
describe('spotlight captions never out-rank their own data file', () => {
  it('prints the biggest-killer claim only on the row with the largest deaths figure', () => {
    for (const [id, cap] of Object.entries(caps)) {
      if (/#1 killer/i.test(cap)) expect(id, cap).toBe(topKiller);
    }
    if (topKiller === 'heart-disease') {
      expect(caps['heart-disease']).toContain('#1 killer globally');
    } else {
      expect(caps['heart-disease']).not.toMatch(/#1 killer/i);
    }
  });

  it('prints the most-papers-per-death claim only on the row that leads that ranking', () => {
    for (const [id, cap] of Object.entries(caps)) {
      if (/most (?:researched|papers) per/i.test(cap)) expect(id, cap).toBe(topPpd);
    }
    if (topPpd === 'cystic-fibrosis') {
      expect(caps['cystic-fibrosis']).toMatch(/most papers per death/i);
    } else {
      expect(caps['cystic-fibrosis']).not.toMatch(/most (?:researched|papers) per/i);
    }
  });

  it('never claims cystic fibrosis is the most researched per capita', () => {
    // Per capita is not a quantity anywhere in this data file: there is no
    // prevalence column to divide by, so the claim was unfalsifiable as well
    // as wrong on the ranking it was nearest to.
    expect(caps['cystic-fibrosis']).not.toMatch(/per capita/i);
    for (const cap of Object.values(caps)) expect(cap).not.toMatch(/per capita/i);
  });

  it('still says what cystic fibrosis is, with a sourced number', () => {
    const cf = diseases[idMap['cystic-fibrosis']];
    expect(caps['cystic-fibrosis']).toContain('papers per death');
    expect(caps['cystic-fibrosis']).toContain(new Intl.NumberFormat('en-US').format(cf.papers));
  });

  it('keeps the two cancer superlatives on the rows the file ranks first', () => {
    // Unguarded in the component because the file has agreed with them since
    // the data was curated. If a refresh flips either one, this fails and the
    // clause gets a guard rather than shipping a contradiction.
    expect(topCancerPapers).toBe('breast-cancer');
    expect(caps['breast-cancer']).toContain('Most researched cancer');
    expect(topCancerDeaths).toBe('lung-cancer');
    expect(caps['lung-cancer']).toContain('Deadliest cancer');
  });

  it('carries no em dash and no section sign in any caption', () => {
    for (const [id, cap] of Object.entries(caps)) {
      expect(cap, id).not.toContain('—');
      expect(cap, id).not.toContain('§');
    }
  });
});
