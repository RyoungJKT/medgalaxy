// Rest DPR governor (final fix wave, 2026-09-11).
//
// AdaptiveDpr renders at REST_DPR whenever the camera is genuinely at rest,
// and on a Retina display in the HIGH tier that is 1.5: two and a quarter
// times the pixels of the DPR 1 the certified build silently gave everyone.
// The only machine that reading was ever measured on is an M2 Max holding
// 120 fps (docs/verify/perf-matrix.md section 1b), and no second device is
// available to measure. So the resting value ships with a field guard instead
// of a second measurement: this governor watches real frame time while the
// scene is at rest, and steps the resting value down when the machine cannot
// hold the budget there.
//
// Three properties keep it honest:
//   - it only ever steps DOWN, and never back up within a session, so a
//     viewer never watches the buffer hunt between two resolutions;
//   - it only measures at rest, so the film, the tour, a drag and every
//     camera tween are invisible to it (those already render at DPR 1);
//   - it needs sustained evidence, three consecutive one-second windows over
//     budget, so one slow second does not cost anyone their resolution.
//
// A hitch (a tab switch, a long GC, a stalled main thread) is not evidence
// about the resting cost of the frame, so any frame longer than HITCH_SEC
// throws the window it lands in away rather than counting it.
const HITCH_SEC = 0.25;

export function createRestGovernor({
  rest,
  floor = 1,
  budgetMs = 1000 / 55,
  windowSec = 1,
  strikes = 3,
  step = 0.25,
} = {}) {
  const strikeLimit = strikes;
  let restDpr = rest;
  let strikeCount = 0;
  let accSec = 0;
  let frames = 0;
  let lastMeanMs = null;

  const discard = () => { accSec = 0; frames = 0; };

  return {
    // One frame. `deltaSec` is the frame's own time, `atRest` says whether the
    // scene was at its resting fidelity for it. Returns the new resting value
    // on the frame it steps down, and null on every other frame.
    sample(deltaSec, atRest) {
      // Already on the floor: nothing left to give up, so this costs a
      // comparison per frame and no more.
      if (restDpr <= floor) return null;
      if (!atRest || !(deltaSec > 0) || deltaSec > HITCH_SEC) { discard(); return null; }

      accSec += deltaSec;
      frames += 1;
      if (accSec < windowSec) return null;

      lastMeanMs = (accSec * 1000) / frames;
      discard();

      if (lastMeanMs > budgetMs) {
        strikeCount += 1;
        if (strikeCount >= strikeLimit) {
          strikeCount = 0;
          restDpr = Math.max(floor, restDpr - step);
          return restDpr;
        }
        return null;
      }
      // Inside budget: the run is broken, not merely paused.
      strikeCount = 0;
      return null;
    },

    // Throws away the half-built window and the strikes with it. AdaptiveDpr
    // calls this on every buffer switch, so the switch frame itself (which is
    // expensive by definition) never counts against the machine.
    reset() { discard(); strikeCount = 0; },

    state() { return { rest: restDpr, strikes: strikeCount, lastMeanMs }; },
  };
}
