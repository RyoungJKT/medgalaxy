import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';

export default function IdleDrift() {
  const phasesRef = useRef(null);
  const blendRef = useRef(0);

  useFrame((state) => {
    const { activeMode, curPos, catPos, diseases, introPhase } = useStore.getState();
    if (activeMode) { blendRef.current = 0; return; }
    if (introPhase < 5) return;

    const count = diseases.length;
    const t = state.clock.getElapsedTime();

    if (!phasesRef.current || phasesRef.current.length !== count) {
      phasesRef.current = diseases.map(() => Math.random() * Math.PI * 2);
    }

    if (blendRef.current < 1) blendRef.current = Math.min(1, blendRef.current + 0.025);
    const bl = blendRef.current;
    const ph = phasesRef.current;

    for (let i = 0; i < count; i++) {
      const tx = catPos[i][0] + Math.sin(t * 0.33 + ph[i]) * 12 * bl;
      const ty = catPos[i][1] + Math.cos(t * 0.275 + ph[i] * 1.3) * 12 * bl;
      const tz = catPos[i][2] + Math.sin(t * 0.22 + ph[i] * 0.7) * 10 * bl;
      // Lerp toward target so nodes smoothly return from exploded positions
      curPos[i][0] += (tx - curPos[i][0]) * 0.04;
      curPos[i][1] += (ty - curPos[i][1]) * 0.04;
      curPos[i][2] += (tz - curPos[i][2]) * 0.04;
    }
  });

  return null;
}
