import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneRefs } from '../src/sceneRefs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, '..', p), 'utf8');

// ─── Camera ownership keys on a live exit, not on the exit's timestamp ───────
// `tmExitAt` is set once by beginTmExit and never reset: startTimeMachine does
// not clear it. Reading it as "an exit is in progress" therefore made every
// manual Time Machine session that followed a tour exit read cameraOwner
// 'tween' for its whole duration, holding DPR at 1 and suppressing the depth
// of field while the viewer scrubbed at rest. TimeMachine.jsx now publishes
// the live flag it already computes each frame, and CameraRig reads that.
describe('camera ownership: the Time Machine exit term', () => {
  it('defaults to no live exit on the shared refs', () => {
    expect(sceneRefs.tmExitLive).toBe(false);
  });

  it('is not keyed on the tmExitAt timestamp anywhere in CameraRig', () => {
    const src = read('src/components/CameraRig.jsx');
    expect(src).not.toContain('tmExitAt');
  });

  it('reads the live flag instead', () => {
    const src = read('src/components/CameraRig.jsx');
    expect(src).toContain('sceneRefs.tmExitLive');
  });

  it('is published every frame by the Time Machine', () => {
    const src = read('src/components/TimeMachine.jsx');
    expect(src).toContain('sceneRefs.tmExitLive = !!exiting');
  });

  // The exit's opening beat sets the store's tmPhase to 'idle' and raises the
  // flag in one synchronous block. Leaving the flag to the next frame left a
  // single frame in which the exit had begun and the camera still read
  // 'ambient', which is precisely the gap the harness latched onto.
  it('is raised in the same beat as the exit itself, not a frame later', () => {
    const src = read('src/components/TimeMachine.jsx');
    const i = src.indexOf('sceneRefs.tmExitLive = true;');
    expect(i).toBeGreaterThan(-1);
    expect(src.slice(i, i + 200)).toContain('s.beginTmExit(mode)');
  });
});
