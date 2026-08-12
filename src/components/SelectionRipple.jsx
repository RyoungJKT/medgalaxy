import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { nR } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';
import { DUR } from '../utils/motion';

// Select (DIRECTION section 4): "the existing selection ripple standardizes
// to 480ms expo.out" — the sanctioned `slow` time constant.
const RIPPLE_DURATION = DUR.slow / 1000;
const MAX_RADIUS = 140;
const RING_WIDTH = 6;

const rippleVert = `
  varying float vEdge;
  void main() {
    vEdge = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rippleFrag = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vEdge;
  void main() {
    // Soft falloff from center of ring width
    float edge = abs(vEdge - 0.5) * 2.0;
    float a = uAlpha * (1.0 - edge * edge);
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function buildRingGeometry(segments) {
  // Flat ring: inner radius = 0, outer radius = 1 (scaled via mesh.scale)
  const verts = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Inner vertex
    verts.push(cos * 0, sin * 0, 0);   // will offset in frame
    uvs.push(0, i / segments);
    // Outer vertex
    verts.push(cos * 1, sin * 1, 0);
    uvs.push(1, i / segments);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// The live ring's trigger, published by the mounted component. Module-level so
// non-React callers (the Time Machine tour's 2020 shockwave) can fire the same
// ring the selection path uses, rather than standing up a second one.
let rippleTrigger = null;

/**
 * Fires the selection ring from a node, in a caller-chosen color.
 * @param {number} idx disease index
 * @param {string} [color] CSS color; defaults to the disease's category color
 * @returns {boolean} false when no ripple is mounted or the index is out of range
 */
export function fireRipple(idx, color) {
  return rippleTrigger ? rippleTrigger(idx, color) : false;
}

export default function SelectionRipple() {
  const meshRef = useRef();
  const progressRef = useRef(-1); // -1 = inactive
  const startRadiusRef = useRef(0);
  const posRef = useRef([0, 0, 0]);
  const supernovaRef = useRef(false);

  const geo = useMemo(() => buildRingGeometry(96), []);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffffff') },
      uAlpha: { value: 0 },
    },
    vertexShader: rippleVert,
    fragmentShader: rippleFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);

  // One trigger for both callers: the selection subscription below and the
  // exported fireRipple. The ring starts at the node's radius as it stands
  // right now, so during the Time Machine it leaves that year's sphere, not the
  // cumulative-papers one.
  const trigger = useCallback((idx, color) => {
    const { curPos, diseases, supernovaPhase } = useStore.getState();
    if (idx == null || idx < 0 || idx >= diseases.length) return false;
    const disease = diseases[idx];
    const pos = curPos[idx];

    posRef.current = [pos[0], pos[1], pos[2]];
    const tm = sceneRefs.tm;
    startRadiusRef.current = tm && tm.active ? tm.radiusAt(idx) : nR(disease.papers);
    mat.uniforms.uColor.value.set(color || CC[disease.category]);
    supernovaRef.current = supernovaPhase === 'burst';
    progressRef.current = 0; // trigger
    return true;
  }, [mat]);

  // Publish the trigger for module-level callers.
  useEffect(() => {
    rippleTrigger = trigger;
    return () => { if (rippleTrigger === trigger) rippleTrigger = null; };
  }, [trigger]);

  // Watch for selection changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.selectedNode,
      (selectedNode) => { if (selectedNode) trigger(selectedNode.index); }
    );
    return unsub;
  }, [trigger]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (progressRef.current < 0 || progressRef.current >= 1) {
      meshRef.current.visible = false;
      return;
    }

    meshRef.current.visible = true;
    const isSN = supernovaRef.current;
    const maxR = isSN ? 220 : MAX_RADIUS;
    const ringW = isSN ? 10 : RING_WIDTH;
    const duration = isSN ? 0.7 : RIPPLE_DURATION;
    progressRef.current += delta / duration;
    const p = Math.min(progressRef.current, 1);

    // Ease-out cubic
    const eased = 1 - Math.pow(1 - p, 3);

    // Current ring radius
    const innerR = startRadiusRef.current + eased * maxR;
    const outerR = innerR + ringW * (1 - p * 0.5); // ring thins as it expands

    // Rebuild positions for inner/outer ring
    const positions = geo.attributes.position;
    const segments = 96;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.setXYZ(i * 2, cos * innerR, sin * innerR, 0);
      positions.setXYZ(i * 2 + 1, cos * outerR, sin * outerR, 0);
    }
    positions.needsUpdate = true;

    // Fade out
    mat.uniforms.uAlpha.value = (1 - p * p) * 0.7;

    // Position at selected node
    meshRef.current.position.set(
      posRef.current[0],
      posRef.current[1],
      posRef.current[2]
    );

    // Billboard: face camera
    meshRef.current.quaternion.copy(state.camera.quaternion);
  });

  return <mesh ref={meshRef} geometry={geo} material={mat} visible={false} />;
}
