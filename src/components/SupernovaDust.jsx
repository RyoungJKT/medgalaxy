import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { TIER } from '../utils/tiers';
import { nR } from '../utils/helpers';
import { CC } from '../utils/constants';

const PARTICLE_COUNT = TIER === 'HIGH' ? 200 : TIER === 'MEDIUM' ? 100 : 0;
const ORBIT_RADIUS = 40; // initial spread radius
const CHARGE_TIGHTEN = 0.4; // how much dust tightens during charge (fraction of orbit)
const BURST_EXPAND = 2.5; // expansion multiplier during burst

function makeParticleTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export default function SupernovaDust() {
  const pointsRef = useRef();
  const opacityRef = useRef(0);

  const { geo, seeds, tex } = useMemo(() => {
    if (PARTICLE_COUNT === 0) return { geo: null, seeds: null, tex: null };
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Random spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random();
      seeds.push({ theta, phi, r, speed: 0.3 + Math.random() * 0.7, phase: Math.random() * Math.PI * 2 });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return { geo: g, seeds, tex: makeParticleTexture() };
  }, []);

  useFrame((state) => {
    if (!geo || !pointsRef.current) return;

    const { supernovaPhase, supernovaTargetIdx, catPos, diseases } = useStore.getState();
    const active = supernovaPhase !== 'idle' && supernovaPhase !== 'complete' && supernovaTargetIdx >= 0;

    // Fade opacity
    const targetOpacity = active ? 0.7 : 0;
    opacityRef.current += (targetOpacity - opacityRef.current) * 0.1;
    pointsRef.current.visible = opacityRef.current > 0.01;
    if (!pointsRef.current.visible) return;

    pointsRef.current.material.opacity = opacityRef.current;

    const idx = supernovaTargetIdx;
    if (idx < 0) return;

    const cx = catPos[idx][0], cy = catPos[idx][1], cz = catPos[idx][2];
    const nodeR = nR(diseases[idx].papers);
    const t = state.clock.getElapsedTime();
    const positions = geo.attributes.position;

    // Compute dust behavior based on phase
    let radiusMult = 1.0;
    let speedMult = 1.0;

    if (supernovaPhase === 'charge') {
      radiusMult = 1.0 - CHARGE_TIGHTEN; // tighten
      speedMult = 1.5; // speed up orbital
    } else if (supernovaPhase === 'burst') {
      radiusMult = BURST_EXPAND;
      speedMult = 3.0;
    } else if (supernovaPhase === 'settle' || supernovaPhase === 'linkwave') {
      radiusMult = 1.5;
      speedMult = 0.5;
    }

    const baseR = (ORBIT_RADIUS + nodeR) * radiusMult;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const s = seeds[i];
      const orbitT = t * s.speed * speedMult + s.phase;
      const theta = s.theta + orbitT * 0.5;
      const phi = s.phi + Math.sin(orbitT * 0.3) * 0.3;
      const r = baseR * (0.3 + s.r * 0.7);

      positions.setXYZ(
        i,
        cx + r * Math.sin(phi) * Math.cos(theta),
        cy + r * Math.sin(phi) * Math.sin(theta),
        cz + r * Math.cos(phi)
      );
    }
    positions.needsUpdate = true;

    // Update color to match target disease category
    if (diseases[idx]) {
      pointsRef.current.material.color.set(CC[diseases[idx].category]);
    }
  });

  if (PARTICLE_COUNT === 0) return null;

  return (
    <points ref={pointsRef} visible={false}>
      <primitive object={geo} attach="geometry" />
      <pointsMaterial
        map={tex}
        size={3}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        opacity={0}
      />
    </points>
  );
}
