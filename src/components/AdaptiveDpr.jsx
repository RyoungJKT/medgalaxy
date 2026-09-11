import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import useStore from '../store';
import { CFG } from '../utils/tiers';
import { sceneRefs } from '../sceneRefs';
import { createRestGovernor } from '../utils/dprGovernor';

// Rest DPR is the display's own ratio, capped by the tier: a 1x display never
// pays for 1.5x, and a Retina display gets the cap the tier allows. It is the
// governor's starting point rather than a constant (src/utils/dprGovernor.js):
// measured frame time at rest can step it down on a machine that cannot hold
// the budget there, which is the field guard standing in for the second-device
// measurement nobody has.
const REST_DPR = Math.min(
  typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
  CFG.dprCap
);
const MOTION_DPR = 1;
// Seconds of continuous 'ambient' ownership before DPR returns to rest, so two
// tweens a beat apart (a fly landing, the next cue starting) do not flap the
// buffer. Time-based rather than a frame count so it stays frame-rate
// independent, but short by design: the brief's own SETTLE_FRAMES (10, about
// 80-170 ms at 60-120 fps) as a time equivalent, comfortably clearing "a beat
// apart" without adding real latency to the common case, a plain selection.
//
// Fix round (2026-09-10, Task 1 review): a first pass widened this to 2 s
// flat, to also survive the ~1.5 s pause between the film handing over and
// the home screen's auto-tour claiming the camera (TimeMachine.jsx's
// TOUR_ARM_DELAY). That bridged the real gap but paid for it on every return
// to rest, including the ordinary click-a-node-and-look-around path the DPR
// unblock exists for, adding roughly 1.8 s of unmeasured latency the depth
// of field's own 480 ms rack does not need. The two needs are separate, so
// they are handled separately: this default stays short, and the one known
// long gap is bridged explicitly below via sceneRefs.tourArmPending, which
// TimeMachine.jsx publishes only while that specific timer is pending.
const SETTLE_SEC = 0.2;

// Task 1 (2026-09-10 plan): the old version compared the camera's position to
// last frame's and treated any 0.01-unit change as motion. Camera breathing
// (ADDENDUM 1 section 4 item 1) moves the camera more than that every frame,
// so every viewer who did not drag first watched a 1x upscale for the whole
// visit. Ownership, not displacement, is the signal now: a hand on the
// controls and any tween or cinematic phase render at MOTION_DPR; ambient
// motion (breathing, autoRotate, parallax) is rest.
export default function AdaptiveDpr() {
  const gl = useThree(s => s.gl);
  const settledSec = useRef(0);
  const currentDpr = useRef(null);
  const governorRef = useRef(null);
  if (governorRef.current === null) governorRef.current = createRestGovernor({ rest: REST_DPR });
  // The governed resting value as of last frame; the governor hands back a new
  // one on the single frame it steps down.
  const restRef = useRef(REST_DPR);

  useEffect(() => {
    const g = governorRef.current;
    sceneRefs.dprState.rest = g.state().rest;
    publish(g);
  }, []);

  useFrame((state, delta) => {
    const governor = governorRef.current;
    const owner = sceneRefs.cameraOwner;
    const spotlightActive = useStore.getState().spotlightActive;
    // Held low while the auto-tour's arming timer is pending (see
    // sceneRefs.tourArmPending): the camera reads 'ambient' for that whole
    // 1.5 s pause since nothing has claimed it yet, but the tour is about to,
    // so a viewer who does not take the offer should not watch the buffer
    // rack up to rest and straight back down again a beat later.
    const wantLow = owner !== 'ambient' || spotlightActive || sceneRefs.tourArmPending;
    if (wantLow) settledSec.current = 0; else settledSec.current += delta;

    // What this frame cost, but only when it is evidence about the resting
    // buffer: nothing wanted the DPR low and the buffer was actually at the
    // resting value. Every other frame is thrown away by the governor, and the
    // frame reads the governor's state once, in publish below.
    const stepped = governor.sample(delta, !wantLow && currentDpr.current === restRef.current);
    if (stepped !== null) restRef.current = stepped;
    const restDpr = restRef.current;
    const want = wantLow ? MOTION_DPR : (settledSec.current >= SETTLE_SEC ? restDpr : currentDpr.current ?? MOTION_DPR);
    if (want !== currentDpr.current) {
      if (currentDpr.current !== null) sceneRefs.dprState.switches++;
      currentDpr.current = want;
      gl.setPixelRatio(want);
      sceneRefs.dprState.current = want;
      // The switch frame is expensive by definition (a buffer reallocation),
      // so it may not count against the machine that just paid for it.
      governor.reset();
    }
    sceneRefs.dprState.rest = restDpr;
    publish(governor);
  });

  return null;
}

// The governor's own state, mirrored onto the shared refs for the harness
// (tools/verify-dpr.mjs prints it). The published record is mutated in place
// so the harness holds one stable object, and this is the frame's only read
// of the governor's state.
function publish(governor) {
  const g = governor.state();
  const out = sceneRefs.dprState.governor;
  out.rest = g.rest;
  out.strikes = g.strikes;
  out.lastMeanMs = g.lastMeanMs;
}
