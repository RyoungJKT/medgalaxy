import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { sceneRefs } from '../sceneRefs';

// Task 2 (2026-09-10 plan): the renderer used to clear to transparent over a
// #000000 div, so the direction's stage color never reached a pixel. The
// clear color now follows sceneRefs.fx.ground every frame (a hex number, see
// src/utils/stage.js), opaque, so the CSS behind the canvas no longer matters.
export default function StageGround() {
  const gl = useThree((s) => s.gl);
  const last = useRef(-1);
  useEffect(() => {
    gl.setClearColor(sceneRefs.fx.ground, 1);
    last.current = sceneRefs.fx.ground;
  }, [gl]);
  useFrame(() => {
    const g = sceneRefs.fx.ground;
    if (g !== last.current) {
      gl.setClearColor(g, 1);
      last.current = g;
    }
  });
  return null;
}
