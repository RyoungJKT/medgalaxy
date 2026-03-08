import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { gravOwnedNodes } from './GravityLens';

export default function IdleDrift() {
  const phasesRef = useRef(null);
  const blendRef = useRef(0);

  useFrame((state, delta) => {
    const { activeMode, curPos, catPos, diseases, introPhase, roulettePhase } = useStore.getState();
    if (activeMode) { blendRef.current = 0; return; }
    if (roulettePhase !== 'idle') { blendRef.current = 0; return; }
    if (introPhase < 5) return;

    const count = diseases.length;
    const t = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05); // clamp to avoid jumps after tab switch

    if (!phasesRef.current || phasesRef.current.length !== count) {
      phasesRef.current = diseases.map(() => Math.random() * Math.PI * 2);
    }

    if (blendRef.current < 1) blendRef.current = Math.min(1, blendRef.current + 1.5 * dt);
    const bl = blendRef.current;
    const ph = phasesRef.current;
    const lerpRate = 1 - Math.pow(0.3, dt); // ~0.02 at 60fps, scales with frame rate

    for (let i = 0; i < count; i++) {
      if (gravOwnedNodes.has(i)) continue;
      const tx = catPos[i][0] + Math.sin(t * 0.347 + ph[i]) * 12 * bl;
      const ty = catPos[i][1] + Math.cos(t * 0.289 + ph[i] * 1.3) * 12 * bl;
      const tz = catPos[i][2] + Math.sin(t * 0.231 + ph[i] * 0.7) * 10 * bl;
      curPos[i][0] += (tx - curPos[i][0]) * lerpRate;
      curPos[i][1] += (ty - curPos[i][1]) * lerpRate;
      curPos[i][2] += (tz - curPos[i][2]) * lerpRate;
    }
  }, -2);

  return null;
}
