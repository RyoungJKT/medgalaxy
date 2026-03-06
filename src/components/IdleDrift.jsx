import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';

export default function IdleDrift() {
  const phasesRef = useRef(null);
  const blendRef = useRef(0);

  useFrame((state) => {
    const { activeMode, curPos, catPos, diseases } = useStore.getState();
    if (activeMode) { blendRef.current = 0; return; }

    const count = diseases.length;
    const t = state.clock.getElapsedTime();

    if (!phasesRef.current || phasesRef.current.length !== count) {
      phasesRef.current = diseases.map(() => Math.random() * Math.PI * 2);
    }

    if (blendRef.current < 1) blendRef.current = Math.min(1, blendRef.current + 0.025);
    const bl = blendRef.current;
    const ph = phasesRef.current;

    for (let i = 0; i < count; i++) {
      curPos[i][0] = catPos[i][0] + Math.sin(t * 0.3 + ph[i]) * 12 * bl;
      curPos[i][1] = catPos[i][1] + Math.cos(t * 0.25 + ph[i] * 1.3) * 12 * bl;
      curPos[i][2] = catPos[i][2] + Math.sin(t * 0.2 + ph[i] * 0.7) * 10 * bl;
    }
  });

  return null;
}
