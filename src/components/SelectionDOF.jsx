import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';

const _target = new THREE.Vector3();

// Tier-based bokeh caps
const MAX_BOKEH = TIER === 'HIGH' ? 3.0 : 2.0;
// Render DOF at reduced resolution (half for MEDIUM, two-thirds for HIGH)
const DOF_RES_SCALE = TIER === 'HIGH' ? 0.667 : 0.5;

export default function SelectionDOF() {
  const dofRef = useRef();
  const curBokeh = useRef(0);
  const prevCamRef = useRef({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0 });
  const idleFrames = useRef(0);

  if (TIER === 'LOW') return null;

  useFrame(() => {
    const effect = dofRef.current;
    if (!effect) return;

    const { selectedNode, curPos, spotlightActive, flyTarget } = useStore.getState();
    const cam = sceneRefs.camera;

    // Detect camera motion
    if (cam) {
      const p = cam.position;
      const q = cam.quaternion;
      const prev = prevCamRef.current;
      const moved =
        Math.abs(p.x - prev.x) > 0.01 ||
        Math.abs(p.y - prev.y) > 0.01 ||
        Math.abs(p.z - prev.z) > 0.01 ||
        Math.abs(q.x - prev.qx) > 0.0001 ||
        Math.abs(q.y - prev.qy) > 0.0001 ||
        Math.abs(q.z - prev.qz) > 0.0001;
      prev.x = p.x; prev.y = p.y; prev.z = p.z;
      prev.qx = q.x; prev.qy = q.y; prev.qz = q.z;

      if (moved) idleFrames.current = 0;
      else idleFrames.current++;
    }

    // Suppress DOF during motion, fly-to, or spotlight
    const cameraSettled = idleFrames.current > 20;
    const suppress = !cameraSettled || spotlightActive || !!flyTarget;

    if (selectedNode && cam && !suppress) {
      const pos = curPos[selectedNode.index];
      _target.set(pos[0], pos[1], pos[2]);
      if (effect.target) effect.target.copy(_target);
      curBokeh.current += (MAX_BOKEH - curBokeh.current) * 0.06;
    } else {
      curBokeh.current += (0 - curBokeh.current) * 0.1;
    }

    if (curBokeh.current < 0.01) curBokeh.current = 0;
    effect.bokehScale = curBokeh.current;
  });

  return (
    <EffectComposer resolutionScale={DOF_RES_SCALE}>
      <DepthOfField
        ref={dofRef}
        focusDistance={0}
        focalLength={0.04}
        bokehScale={0}
        resolutionScale={DOF_RES_SCALE}
      />
    </EffectComposer>
  );
}
