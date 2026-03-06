import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import useStore from '../store';

export default function VelocityMap() {
  const tweensRef = useRef([]);

  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.activeMode,
      (mode, prevMode) => {
        const { curPos, catPos } = useStore.getState();
        if (!curPos) return;

        // Kill any running tweens
        tweensRef.current.forEach((t) => t.kill());
        tweensRef.current = [];

        if (mode === 'velocity') {
          // Same explosion pattern as ExplodeView
          for (let i = 0; i < curPos.length; i++) {
            const factor = 2.5 + Math.random() * 1.5;
            const tx = curPos[i][0] * factor + (Math.random() - 0.5) * 80;
            const ty = curPos[i][1] * factor + (Math.random() - 0.5) * 80;
            const tz = curPos[i][2] * factor + (Math.random() - 0.5) * 80;

            tweensRef.current.push(
              gsap.to(curPos[i], {
                0: tx,
                1: ty,
                2: tz,
                duration: 1.0,
                ease: 'power2.out',
              })
            );
          }
        } else if (prevMode === 'velocity') {
          // Return to category positions
          for (let i = 0; i < curPos.length; i++) {
            tweensRef.current.push(
              gsap.to(curPos[i], {
                0: catPos[i][0],
                1: catPos[i][1],
                2: catPos[i][2],
                duration: 1.0,
                ease: 'power2.inOut',
              })
            );
          }
        }
      }
    );

    return () => {
      unsub();
      tweensRef.current.forEach((t) => t.kill());
    };
  }, []);

  return null;
}
