import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { nR } from '../utils/helpers';
import { CC } from '../utils/constants';
import { CFG } from '../utils/tiers';

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export default function GlowSprites() {
  const diseases = useStore(s => s.diseases);
  const count = diseases.length;
  const glowOpacityRef = useRef(0);
  const groupRef = useRef();

  const { tex, glowIndices } = useMemo(() => {
    const t = makeGlowTexture();
    const topN = CFG.glowAll ? count : Math.min(40, count);
    const sorted = [...diseases]
      .map((d, i) => ({ i, papers: d.papers }))
      .sort((a, b) => b.papers - a.papers)
      .slice(0, topN)
      .map(x => x.i);
    return { tex: t, glowIndices: sorted };
  }, [diseases, count]);

  const refsMap = useRef({});

  useFrame(() => {
    const { curPos, introPhase, supernovaPhase, supernovaTargetIdx } = useStore.getState();

    // Intro gating: invisible until phase 4, then fade in
    const targetOpacity = introPhase >= 4 ? 0.35 : 0;
    glowOpacityRef.current += (targetOpacity - glowOpacityRef.current) * 0.08;

    // Update visibility
    if (groupRef.current) {
      groupRef.current.visible = glowOpacityRef.current > 0.005;
    }

    for (const idx of glowIndices) {
      const ref = refsMap.current[idx];
      if (ref) {
        ref.position.set(curPos[idx][0], curPos[idx][1], curPos[idx][2]);
        if (ref.material) ref.material.opacity = glowOpacityRef.current;
      }
    }

    // Supernova: boost target glow
    const supernovaActive = supernovaPhase !== 'idle' && supernovaPhase !== 'complete';
    if (supernovaActive && supernovaTargetIdx >= 0) {
      const targetRef = refsMap.current[supernovaTargetIdx];
      if (targetRef && targetRef.material) {
        const boostPhases = { charge: 0.8, burst: 1.0, linkwave: 0.5, prefocus: 0.5 };
        const boost = boostPhases[supernovaPhase] || 0;
        targetRef.material.opacity = Math.max(glowOpacityRef.current, boost);
      }
    }
  });

  return (
    <group ref={groupRef} renderOrder={-2} visible={false}>
      {glowIndices.map(idx => {
        const r = nR(diseases[idx].papers) * 3.5;
        return (
          <sprite
            key={idx}
            ref={el => { if (el) refsMap.current[idx] = el; }}
            scale={[r, r, 1]}
          >
            <spriteMaterial
              map={tex}
              color={CC[diseases[idx].category]}
              transparent
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              opacity={0}
            />
          </sprite>
        );
      })}
    </group>
  );
}
