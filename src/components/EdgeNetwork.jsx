import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';

export default function EdgeNetwork() {
  const lineRef = useRef();
  const displayEdges = useStore(s => s.displayEdges);
  const eC = displayEdges.length;

  const geo = useMemo(() => {
    const buf = new Float32Array(eC * 6);
    const catPos = useStore.getState().catPos;
    for (let i = 0; i < eC; i++) {
      const e = displayEdges[i];
      const s = catPos[e.si], t = catPos[e.ti];
      const o = i * 6;
      buf[o] = s[0]; buf[o+1] = s[1]; buf[o+2] = s[2];
      buf[o+3] = t[0]; buf[o+4] = t[1]; buf[o+5] = t[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    const clr = new Float32Array(eC * 6).fill(1.0);
    g.setAttribute('color', new THREE.BufferAttribute(clr, 3));
    return g;
  }, [displayEdges, eC]);

  // Expose edge mesh to HighlightSystem
  useEffect(() => {
    if (lineRef.current) sceneRefs.edgeMesh = lineRef.current;
  });

  useFrame(() => {
    if (!lineRef.current) return;
    const curPos = useStore.getState().curPos;
    const posArr = geo.getAttribute('position').array;
    for (let i = 0; i < eC; i++) {
      const e = displayEdges[i];
      const s = curPos[e.si], t = curPos[e.ti];
      const o = i * 6;
      posArr[o] = s[0]; posArr[o+1] = s[1]; posArr[o+2] = s[2];
      posArr[o+3] = t[0]; posArr[o+4] = t[1]; posArr[o+5] = t[2];
    }
    geo.getAttribute('position').needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} geometry={geo} renderOrder={-1}>
      <lineBasicMaterial vertexColors transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}
