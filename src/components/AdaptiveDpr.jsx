import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import useStore from '../store';
import { CFG } from '../utils/tiers';
import { sceneRefs } from '../sceneRefs';

// Rest DPR is the display's own ratio, capped by the tier: a 1x display never
// pays for 1.5x, and a Retina display gets the cap the tier allows.
const REST_DPR = Math.min(
  typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
  CFG.dprCap
);
const MOTION_DPR = 1;
// Seconds of continuous 'ambient' ownership before DPR returns to rest, so two
// tweens a beat apart (a fly landing, the next cue starting) do not flap the
// buffer. Time-based rather than a frame count: the home screen's auto-tour
// offers itself a fixed 1.5 s after the film hands over (TimeMachine.jsx's
// own arming delay), and a viewer who does not take the offer sits ambient
// for that whole pause before the tour claims the camera again. A frame-count
// settle short enough to matter on a slow machine is nowhere near long enough
// to survive that pause on a fast one, so the buffer would flap up to rest and
// straight back down every single time. 2 s clears the 1.5 s pause with
// margin regardless of frame rate.
const SETTLE_SEC = 2;

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

  useEffect(() => {
    sceneRefs.dprState.rest = REST_DPR;
  }, []);

  useFrame((state, delta) => {
    const owner = sceneRefs.cameraOwner;
    const spotlightActive = useStore.getState().spotlightActive;
    const wantLow = owner !== 'ambient' || spotlightActive;
    if (wantLow) settledSec.current = 0; else settledSec.current += delta;

    const want = wantLow ? MOTION_DPR : (settledSec.current >= SETTLE_SEC ? REST_DPR : currentDpr.current ?? MOTION_DPR);
    if (want !== currentDpr.current) {
      if (currentDpr.current !== null) sceneRefs.dprState.switches++;
      currentDpr.current = want;
      gl.setPixelRatio(want);
      sceneRefs.dprState.current = want;
    }
  });

  return null;
}
