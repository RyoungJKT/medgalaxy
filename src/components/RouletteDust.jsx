import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { TIER } from '../utils/tiers';
import { neglectColor } from '../utils/helpers';
import { ppd } from '../utils/captions';
import { igniteWeights } from '../utils/igniteWeights';

// ── Tier-based particle counts (tiers are HIGH/MEDIUM/LOW — 'MID' was always
// false here, so MEDIUM silently fell through to the HIGH count) ──
const DUST_COUNT = TIER === 'LOW' ? 60 : TIER === 'MEDIUM' ? 150 : 280;

// Flat warm default; overridden per DIRECTION section 4 ("Supernova and
// roulette, brought into the family") when the reveal lands on a disease in
// the overlooked ember decile.
const DEFAULT_COLOR = 0xffeebb;

// ── Shared scratch vector ──
const _v3 = new THREE.Vector3();

// ── Same ring tilts as GalaxyRoulette ──
const RING_TILTS = [
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.2, 0)),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0, 0.35)),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.15, -0.45)),
];

export default function RouletteDust() {
  const pointsRef = useRef();
  const matRef = useRef();
  const diseases = useStore(s => s.diseases);

  // Bottom-decile-of-papers-per-death membership, same runtime-derived weights
  // the ignite ramp uses (DIRECTION section 4: "dust particles tint by the
  // revealed disease's papers-per-death color on the Attention Map scale").
  const ember = useMemo(() => igniteWeights(diseases).ember, [diseases]);

  // Pre-compute per-particle ring assignment, base angle, radius offset, speed jitter
  const particleData = useMemo(() => {
    const ring = new Uint8Array(DUST_COUNT);
    const baseAngle = new Float32Array(DUST_COUNT);
    const radiusOffset = new Float32Array(DUST_COUNT);
    const speedJitter = new Float32Array(DUST_COUNT);
    const yOffset = new Float32Array(DUST_COUNT);
    const positions = new Float32Array(DUST_COUNT * 3); // initial positions (all zeros)

    for (let i = 0; i < DUST_COUNT; i++) {
      ring[i] = Math.floor(Math.random() * 3);
      baseAngle[i] = Math.random() * Math.PI * 2;
      // Scatter slightly above/below ring plane and inside/outside ring radius
      radiusOffset[i] = (Math.random() - 0.5) * 0.3; // ±15% of ring radius
      speedJitter[i] = 0.7 + Math.random() * 0.6; // 0.7x to 1.3x ring speed
      yOffset[i] = (Math.random() - 0.5) * 0.15; // slight vertical scatter
    }

    return { ring, baseAngle, radiusOffset, speedJitter, yOffset, positions };
  }, []);

  // Track accumulated angles per ring (mirrors GalaxyRoulette's ringAngles)
  const anglesRef = useRef([0, 0, 0]);
  const opacityRef = useRef(0);
  // Fix (review): neglectColor(ppd(...)) built a fresh color string every
  // frame even though it only ever changes when rouletteWinner (or whether
  // that winner is overlooked) changes. Cached here, and — per the same
  // finding — skipped entirely once the early opacity exit below fires, since
  // a fully transparent dust field has no visible color to update.
  const colorCacheRef = useRef({ winner: null, overlooked: false, str: DEFAULT_COLOR });

  useFrame((state, delta) => {
    const store = useStore.getState();
    const { roulettePhase, rawMax, rouletteWinner } = store;
    const dt = Math.min(delta, 0.05);

    if (!pointsRef.current || !matRef.current) return;

    const rm = rawMax || 600;
    const ringRadii = [rm * 0.25, rm * 0.45, rm * 0.70];

    // Dust speed matches GalaxyRoulette's MAX_SPEEDS
    const maxSpeeds = TIER === 'LOW' ? [9.0, 5.5, 3.5] : TIER === 'MEDIUM' ? [13.0, 8.5, 5.5] : [16.0, 11.0, 7.0];

    // Target opacity and speed multiplier based on phase
    let targetOpacity = 0;
    let speedMult = 0;

    if (roulettePhase === 'spinup') {
      targetOpacity = 0.4;
      speedMult = 1.0;
    } else if (roulettePhase === 'reveal') {
      targetOpacity = 0.08;
      speedMult = 0.3;
    } else {
      targetOpacity = 0;
      speedMult = 0;
    }

    // Smooth opacity transition
    opacityRef.current += (targetOpacity - opacityRef.current) * 0.06;
    matRef.current.opacity = opacityRef.current;

    // Early exit if fully transparent
    if (opacityRef.current < 0.005) {
      pointsRef.current.visible = false;
      anglesRef.current = [0, 0, 0];
      return;
    }
    pointsRef.current.visible = true;

    // Ember tint: once the reveal has a winner in the overlooked decile, the
    // dust throws that disease's neglect color instead of the flat default.
    // Recomputed only when the winner (or its overlooked-ness) actually changes.
    const winnerOverlooked =
      roulettePhase === 'reveal' && rouletteWinner != null && rouletteWinner >= 0 && ember[rouletteWinner] === 1;
    const cc = colorCacheRef.current;
    if (cc.winner !== rouletteWinner || cc.overlooked !== winnerOverlooked) {
      cc.winner = rouletteWinner;
      cc.overlooked = winnerOverlooked;
      cc.str = winnerOverlooked ? neglectColor(ppd(diseases[rouletteWinner])) : DEFAULT_COLOR;
    }
    matRef.current.color.set(cc.str);

    // Advance ring angles
    const angles = anglesRef.current;
    for (let ri = 0; ri < 3; ri++) {
      angles[ri] += maxSpeeds[ri] * speedMult * dt;
    }

    // Update particle positions
    const { ring, baseAngle, radiusOffset, speedJitter, yOffset, positions } = particleData;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position');

    for (let i = 0; i < DUST_COUNT; i++) {
      const ri = ring[i];
      const r = ringRadii[ri] * (1.0 + radiusOffset[i]);
      const theta = baseAngle[i] + angles[ri] * speedJitter[i];

      _v3.set(Math.cos(theta) * r, ringRadii[ri] * yOffset[i], Math.sin(theta) * r);
      _v3.applyQuaternion(RING_TILTS[ri]);

      posAttr.array[i * 3] = _v3.x;
      posAttr.array[i * 3 + 1] = _v3.y;
      posAttr.array[i * 3 + 2] = _v3.z;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} visible={false} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={DUST_COUNT}
          array={particleData.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={DEFAULT_COLOR}
        size={TIER === 'LOW' ? 1.8 : 2.2}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
