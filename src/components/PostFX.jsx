import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER, CFG } from '../utils/tiers';
import { DUR } from '../utils/motion';

const _target = new THREE.Vector3();

// Tier-based bokeh caps
const MAX_BOKEH = TIER === 'HIGH' ? 3.0 : 2.0;
// Render DOF at reduced resolution (half for MEDIUM, two-thirds for HIGH)
const DOF_RES_SCALE = TIER === 'HIGH' ? 0.667 : 0.5;

export default function PostFX() {
  const dofRef = useRef();
  const curBokeh = useRef(0);
  const composerRef = useRef();

  useEffect(() => {
    const c = composerRef.current;
    if (!c || !c.passes) return;
    // Task 2 (2026-09-10 plan): the warm ignite gradient bands in 8-bit; the
    // post chain's own dithering removes it for free.
    for (const p of c.passes) {
      if ('dithering' in p) p.dithering = true;
      else if (p.fullscreenMaterial) p.fullscreenMaterial.dithering = true;
    }
  }, []);

  if (TIER === 'LOW') return null;

  useFrame((state, delta) => {
    const effect = dofRef.current;
    if (!effect) return;

    const { selectedNode, curPos, spotlightActive } = useStore.getState();
    const cam = sceneRefs.camera;

    // Task 1 (2026-09-10 plan): the DOF used to be suppressed whenever the
    // camera had moved more than 0.01 units since last frame, or whenever a
    // flyTarget was set (and flyTarget is never cleared after a fly lands).
    // Camera breathing tripped the first test every frame, so the rack never
    // happened on a plain click. Ownership is the test now: a hand on the
    // controls or a live tween suppresses it; ambient motion does not.
    const tweening = cam ? gsap.isTweening(cam.position) : false;
    const suppress = sceneRefs.cameraOwner === 'user' || tweening || spotlightActive;

    // Critically damped approach with a 160 ms time constant: 95 percent of the
    // rack lands inside DUR.slow (480 ms), the sanctioned instrument duration.
    const dt = delta > 0.05 ? 0.05 : delta;
    const k = 1 - Math.exp(-dt / (DUR.slow / 3000));

    if (selectedNode && cam && !suppress) {
      const pos = curPos[selectedNode.index];
      _target.set(pos[0], pos[1], pos[2]);
      if (effect.target) effect.target.copy(_target);
      curBokeh.current += (MAX_BOKEH - curBokeh.current) * k;
    } else {
      curBokeh.current += (0 - curBokeh.current) * k;
    }

    if (curBokeh.current < 0.01) curBokeh.current = 0;
    effect.bokehScale = curBokeh.current;
    sceneRefs.postfx.bokeh = curBokeh.current;
  });

  return (
    <EffectComposer ref={composerRef} resolutionScale={DOF_RES_SCALE}>
      <Bloom mipmapBlur intensity={CFG.bloom.intensity} levels={CFG.bloom.levels}
        luminanceThreshold={1.0} luminanceSmoothing={0.05} />
      <DepthOfField ref={dofRef} focusDistance={0} focalLength={0.04}
        bokehScale={0} resolutionScale={DOF_RES_SCALE} />
      <Vignette eskil={false} offset={0.28} darkness={0.62} />
    </EffectComposer>
  );
}
