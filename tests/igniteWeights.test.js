import { describe, it, expect } from 'vitest';
import diseases from '../data/diseases.json';
import { igniteWeights } from '../src/utils/igniteWeights';

const idx = Object.fromEntries(diseases.map((d, i) => [d.id, i]));
const { ignite, ember } = igniteWeights(diseases);

describe('ignite weights (attention/death divergence)', () => {
  it('returns one weight per disease, all inside 0..1', () => {
    expect(ignite.length).toBe(diseases.length);
    expect(ember.length).toBe(diseases.length);
    for (let i = 0; i < diseases.length; i++) {
      expect(ignite[i], diseases[i].id).toBeGreaterThanOrEqual(0);
      expect(ignite[i], diseases[i].id).toBeLessThanOrEqual(1);
    }
  });

  it('sepsis is the hero: the single maximum, at full 1.0', () => {
    const s = ignite[idx['sepsis']];
    expect(s).toBeCloseTo(1.0, 5);
    for (let i = 0; i < diseases.length; i++) {
      if (i === idx['sepsis']) continue;
      expect(ignite[i], diseases[i].id).toBeLessThan(s);
    }
  });

  it('heart disease is the honest anchor: giant in both worlds, barely ignites', () => {
    expect(ignite[idx['heart-disease']]).toBeLessThan(0.25);
  });

  it('mortality 0 never ignites (depression is a modeling boundary, not a claim)', () => {
    expect(ignite[idx['depression']]).toBe(0);
    for (let i = 0; i < diseases.length; i++) {
      if (diseases[i].mortality === 0) expect(ignite[i], diseases[i].id).toBe(0);
    }
  });

  it('rheumatic heart disease and COPD burn hot', () => {
    expect(ignite[idx['rheumatic-heart-disease']]).toBeGreaterThan(0.6);
    expect(ignite[idx['copd']]).toBeGreaterThan(0.6);
  });
});

describe('ember rim (bottom decile of papers per death)', () => {
  const withMortality = diseases.filter(d => d.mortality > 0).length;

  it('marks exactly the bottom decile of diseases that have a recorded toll', () => {
    let ones = 0;
    for (let i = 0; i < diseases.length; i++) {
      expect([0, 1]).toContain(ember[i]);
      if (ember[i] === 1) ones++;
    }
    expect(ones).toBe(Math.ceil(0.1 * withMortality));
  });

  it('well-studied rare disease (cystic fibrosis, 48+ papers per death) carries no ember', () => {
    expect(ember[idx['cystic-fibrosis']]).toBe(0);
  });

  it('sepsis, the most overlooked relative to its toll, carries an ember', () => {
    expect(ember[idx['sepsis']]).toBe(1);
  });

  it('mortality 0 never carries an ember', () => {
    for (let i = 0; i < diseases.length; i++) {
      if (diseases[i].mortality === 0) expect(ember[i], diseases[i].id).toBe(0);
    }
  });
});
