import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import useStore from '../store';
import { nR, nRM } from '../utils/helpers';

export default function ConnectionsView() {
  const tweensRef = useRef([]);

  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.connFocusIdx,
      (connFocusIdx) => {
        const {
          curPos, catPos, diseases, neighbors, sizeMode, activeMode,
        } = useStore.getState();
        if (!curPos) return;

        // Kill any running tweens
        tweensRef.current.forEach((t) => t.kill());
        tweensRef.current = [];

        if (connFocusIdx >= 0 && activeMode === 'connections') {
          const nbrs = neighbors.get(connFocusIdx);
          const connSet = new Set([connFocusIdx]);
          if (nbrs) nbrs.forEach((n) => connSet.add(n));

          const nbrList = [...connSet].filter((i) => i !== connFocusIdx);
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const N = nbrList.length;

          for (let i = 0; i < curPos.length; i++) {
            let tx, ty, tz;

            if (i === connFocusIdx) {
              tx = 0; ty = 0; tz = 0;
            } else if (connSet.has(i)) {
              const ni = nbrList.indexOf(i);
              const ft = (ni + 0.5) / N;
              const uz = 1 - 2 * ft;
              const theta = goldenAngle * ni;
              const rXY = Math.sqrt(1 - uz * uz);
              const nodeR = sizeMode === 'papers'
                ? nR(diseases[i].papers)
                : nRM(diseases[i].mortality);
              const orbit = 100 + nodeR * 3 + ni * 2;
              tx = rXY * Math.cos(theta) * orbit;
              ty = rXY * Math.sin(theta) * orbit;
              tz = uz * orbit;
            } else {
              const p = curPos[i];
              const d = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) || 100;
              tx = (p[0] / d) * 2500;
              ty = (p[1] / d) * 2500;
              tz = (p[2] / d) * 2500;
            }

            tweensRef.current.push(
              gsap.to(curPos[i], {
                0: tx, 1: ty, 2: tz,
                duration: 1.0,
                ease: 'power2.out',
              })
            );
          }

          const camRadius = Math.max(600, 350 + N * 6);
          useStore.getState().setFlyTarget({
            position: [0, 0, 0],
            radius: camRadius,
            duration: 0.9,
          });
        }
        // Reverse is handled by IdleDrift's lerp when activeMode becomes null
      }
    );

    return () => {
      unsub();
      tweensRef.current.forEach((t) => t.kill());
    };
  }, []);

  return null;
}
