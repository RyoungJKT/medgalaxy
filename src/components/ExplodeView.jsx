import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import useStore from '../store';

export default function ExplodeView() {
  const tweensRef = useRef([]);
  const prevModeRef = useRef(null);

  useFrame(() => {
    if (useStore.getState().roulettePhase !== 'idle') return;
    const mode = useStore.getState().activeMode;
    const prev = prevModeRef.current;
    if (mode === prev) return;
    prevModeRef.current = mode;

    const { curPos } = useStore.getState();
    if (!curPos) return;

    // Kill any running tweens
    tweensRef.current.forEach((t) => t.kill());
    tweensRef.current = [];

    if (mode === 'explode') {
      for (let i = 0; i < curPos.length; i++) {
        const p = curPos[i];
        const factor = 2.5 + Math.random() * 1.5;
        const tx = p[0] * factor + (Math.random() - 0.5) * 80;
        const ty = p[1] * factor + (Math.random() - 0.5) * 80;
        const tz = p[2] * factor + (Math.random() - 0.5) * 80;

        tweensRef.current.push(
          gsap.to(curPos[i], {
            0: tx, 1: ty, 2: tz,
            duration: 1.0,
            ease: 'power2.out',
          })
        );
      }
    }
    // Reverse is handled by IdleDrift's lerp when activeMode becomes null
  });

  return null;
}
