import { useMemo } from 'react';
import * as THREE from 'three';
import { CFG } from '../utils/tiers';

export default function BackgroundParticles({ camDist }) {
  const count = CFG.particles;

  const positions = useMemo(() => {
    if (count === 0) return null;
    const pos = new Float32Array(count * 3);
    const pR = camDist * 4;
    for (let i = 0; i < count; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const r = pR + Math.random() * pR * 0.3;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    return pos;
  }, [count, camDist]);

  if (!positions) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color={0x334155} size={1.5} transparent opacity={0.6} />
    </points>
  );
}
