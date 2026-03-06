import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import useStore from '../store';
import { CFG } from '../utils/tiers';

const REST_DPR = CFG.dprCap;
const MOTION_DPR = 1;
const IDLE_THRESHOLD = 30; // frames of no camera movement before restoring DPR

export default function AdaptiveDpr() {
  const gl = useThree(s => s.gl);
  const prevCamRef = useRef({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
  const idleFrames = useRef(0);
  const currentDpr = useRef(REST_DPR);

  useFrame(({ camera }) => {
    const prev = prevCamRef.current;
    const p = camera.position;
    const q = camera.quaternion;

    // Detect camera movement (position or rotation change)
    const moved =
      Math.abs(p.x - prev.x) > 0.01 ||
      Math.abs(p.y - prev.y) > 0.01 ||
      Math.abs(p.z - prev.z) > 0.01 ||
      Math.abs(q.x - prev.qx) > 0.0001 ||
      Math.abs(q.y - prev.qy) > 0.0001 ||
      Math.abs(q.z - prev.qz) > 0.0001;

    prev.x = p.x; prev.y = p.y; prev.z = p.z;
    prev.qx = q.x; prev.qy = q.y; prev.qz = q.z; prev.qw = q.w;

    const spotlightActive = useStore.getState().spotlightActive;
    const wantLow = moved || spotlightActive;

    if (wantLow) {
      idleFrames.current = 0;
      if (currentDpr.current !== MOTION_DPR) {
        currentDpr.current = MOTION_DPR;
        gl.setPixelRatio(MOTION_DPR);
      }
    } else {
      idleFrames.current++;
      if (idleFrames.current >= IDLE_THRESHOLD && currentDpr.current !== REST_DPR) {
        currentDpr.current = REST_DPR;
        gl.setPixelRatio(REST_DPR);
      }
    }
  });

  return null;
}
