import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { ASM } from '../utils/assembly';

// Timeline thresholds (seconds).
//
// ADDENDUM 1 section 3: "Budget: 4.0 s to 5.2 s." The staged scale-up these
// thresholds used to drive is gone — AssemblyFlight owns node presence now, and
// the flight's own per-node launch and landing times replace hero /
// constellation / galaxy entirely. What the intermediate phases still gate is
// the scene furniture that comes up around the arriving nodes (GlowSprites and
// EdgeNetwork both wake at phase 4), so they are carried across at the same
// fractions of the budget they had at 4.0 s: every threshold is its old value
// times 5.2/4.0. Phase 5 is still "beat 0 is over, the film may speak", and it
// still lands 210 ms after the last giant (measured 4.98 s on this table).
const SCALE = ASM.total / 4.0;
const T_HERO = 0.4 * SCALE;           // 0.52
const T_CONSTELLATION = 1.0 * SCALE;  // 1.30
const T_GALAXY = 1.8 * SCALE;         // 2.34
const T_EFFECTS = 2.8 * SCALE;        // 3.64
export const T_DONE = ASM.total;      // 5.20, beat 0, assembly (ADDENDUM 1 section 3)

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export default function IntroSequence() {
  const doneRef = useRef(false);
  const startTimeRef = useRef(null);

  // Reduced motion: skip intro immediately
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      useStore.getState().skipIntro();
      doneRef.current = true;
      return;
    }

    // Skip on any user input during the cinematic intro (after landing dismissed)
    const skip = () => {
      if (doneRef.current) return;
      const s = useStore.getState();
      if (!s.introStarted || s.introPhase >= 5) return;
      s.skipIntro();
      doneRef.current = true;
    };

    window.addEventListener('mousedown', skip);
    window.addEventListener('touchstart', skip);
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip);

    return () => {
      window.removeEventListener('mousedown', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, []);

  useFrame((state) => {
    if (doneRef.current) return;

    const store = useStore.getState();

    // Someone else already declared the intro finished (skipIntro from the
    // landing overlay, reduced motion, or the overture's seek hook). Never
    // walk the phase back down from 5.
    if (store.introPhase >= 5) { doneRef.current = true; return; }

    // Wait for landing overlay to be dismissed
    if (!store.introStarted) return;

    // One clock for beat 0. AssemblyFlight runs at priority -1, i.e. earlier in
    // this same frame, and publishes the moment the assembly began plus any
    // frozen harness seek; the phases and the flight must never disagree about
    // what time it is, or a seeked frame shows nodes from one moment with the
    // scene furniture of another.
    const asm = sceneRefs.assembly;
    if (asm && asm.t0 != null) startTimeRef.current = asm.t0;
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.getElapsedTime();
    }

    const t = asm && asm.seekT != null
      ? asm.seekT
      : state.clock.getElapsedTime() - startTimeRef.current;

    // Continuous progress
    const progress = smoothstep(0, T_DONE, t);
    if (store.introProgress !== progress) {
      store.setIntroProgress(progress);
    }

    // Phase transitions
    let phase = 0;
    if (t >= T_DONE) phase = 5;
    else if (t >= T_EFFECTS) phase = 4;
    else if (t >= T_GALAXY) phase = 3;
    else if (t >= T_CONSTELLATION) phase = 2;
    else if (t >= T_HERO) phase = 1;

    if (store.introPhase !== phase) {
      store.setIntroPhase(phase);
    }

    if (phase >= 5) {
      doneRef.current = true;
    }
  });

  return null;
}
