import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'src/components/PostFX.jsx'), 'utf8');

// ─── Stories own the frame, so the depth of field stands down inside one ─────
// A supernova story step selects its subject, and the selection depth of field
// used to rack in on it at rest: the neighbors and the link arcs the supernova
// had just revealed went to bokehScale 3.0 behind a sharp hero, which is the
// opposite of the reveal the step exists to make. The certified story-clarity
// score was earned with no depth of field at all. There is no DOM test for
// PostFX, so the guard is the suppress expression itself: a refactor that
// drops the story flag fails here rather than on screen.
describe('PostFX suppress (stories own the frame)', () => {
  const line = src.split('\n').find((l) => l.includes('const suppress ='));

  it('has a single suppress expression to read', () => {
    expect(line).toBeTruthy();
  });

  it('names the store story flag alongside the spotlight', () => {
    expect(line).toContain('storyActive');
    expect(line).toContain('spotlightActive');
  });

  it('reads the story flag off the store, the same way the spotlight is read', () => {
    const getState = src.split('\n').find((l) => l.includes('useStore.getState()') && l.includes('spotlightActive'));
    expect(getState).toBeTruthy();
    expect(getState).toContain('storyActive');
  });
});
