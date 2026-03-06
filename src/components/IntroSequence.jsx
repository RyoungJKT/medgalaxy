import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';

// Timeline thresholds (seconds)
const T_HERO = 0.4;
const T_CONSTELLATION = 1.0;
const T_GALAXY = 1.8;
const T_EFFECTS = 2.5;
const T_DONE = 3.5;

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

    // Wait for landing overlay to be dismissed
    if (!store.introStarted) return;

    // Record start time on first frame after landing dismissed
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.getElapsedTime();
    }

    const t = state.clock.getElapsedTime() - startTimeRef.current;

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
