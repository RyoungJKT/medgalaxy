import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CFG, TIER } from '../utils/tiers';
import { sceneRefs } from '../sceneRefs';
import { ASM } from '../utils/assembly';

const BASE_SPIN = 0.0003;

export default function BackgroundParticles({ camDist }) {
  const count = CFG.particles;
  const groupRef = useRef();
  // Beat 0's dust settle (ADDENDUM 1 section 3, HIGH only): the whole volume
  // moves with the streams instead of sitting still behind them. Zero new
  // objects — the drift is the existing group's scale and the bump is its
  // existing rotation rate.
  const dust = useRef({ t: null });

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

  // Slow ambient rotation for cinematic feel
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // "The existing 400 background particles drift inward by 3 percent of their
    // radius over the 5.2 s with a 0.4 percent per second rotation bump, easing
    // back to the resting rate by 5.6 s." A uniform inward drift of every
    // particle by a fraction of its own radius is exactly a scale on the shell
    // they already live in, which is why this costs nothing.
    let spin = 1;
    if (TIER === 'HIGH') {
      const d = dust.current;
      const asm = sceneRefs.assembly;
      // While beat 0 is live the dust rides the assembly's own clock, so a
      // harness seek settles the volume to the same place it would have been;
      // afterwards it carries on alone for the 400 ms ease-out.
      if (asm && asm.active) d.t = asm.t;
      else if (d.t != null && d.t < ASM.dustSettle) {
        d.t = Math.min(ASM.dustSettle, d.t + Math.min(delta, 0.05));
      }
      if (d.t != null) {
        const e = -(Math.cos(Math.PI * Math.min(1, d.t / ASM.total)) - 1) / 2; // sine.inOut
        const s = 1 - ASM.dustDrift * e;
        g.scale.set(s, s, s);
        const decay = d.t <= ASM.total
          ? 1
          : Math.max(0, 1 - (d.t - ASM.total) / (ASM.dustSettle - ASM.total));
        spin = 1 + ASM.dustSpin * Math.min(d.t, ASM.total) * decay;
      }
    }

    g.rotation.y += BASE_SPIN * spin;
  });

  if (!positions) return null;

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={0x334155} size={1.5} transparent opacity={0.6} />
      </points>
    </group>
  );
}
