import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';

const _target = new THREE.Vector3();

export default function SelectionDOF() {
  const dofRef = useRef();
  const curBokeh = useRef(0);

  if (TIER === 'LOW') return null;

  useFrame(() => {
    const effect = dofRef.current;
    if (!effect) return;

    const { selectedNode, curPos } = useStore.getState();
    const cam = sceneRefs.camera;

    if (selectedNode && cam) {
      const pos = curPos[selectedNode.index];
      _target.set(pos[0], pos[1], pos[2]);
      if (effect.target) effect.target.copy(_target);
      curBokeh.current += (3.0 - curBokeh.current) * 0.06;
    } else {
      curBokeh.current += (0 - curBokeh.current) * 0.1;
    }

    if (curBokeh.current < 0.01) curBokeh.current = 0;
    effect.bokehScale = curBokeh.current;
  });

  return (
    <EffectComposer>
      <DepthOfField
        ref={dofRef}
        focusDistance={0}
        focalLength={0.04}
        bokehScale={0}
      />
    </EffectComposer>
  );
}
