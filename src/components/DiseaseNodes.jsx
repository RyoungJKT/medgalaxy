import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { nR, nRM } from '../utils/helpers';
import { CC, CATS } from '../utils/constants';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';
import { useAttentionColors } from './AttentionMap';
import plasmaVert from '../shaders/plasma.vert.glsl?raw';
import plasmaFrag from '../shaders/plasma.frag.glsl?raw';
import pulseVert from '../shaders/pulse.vert.glsl?raw';
import pulseFrag from '../shaders/pulse.frag.glsl?raw';

const _m4 = new THREE.Matrix4();
const _v3 = new THREE.Vector3();
const _q4 = new THREE.Quaternion();
const _s3 = new THREE.Vector3();

// Category index lookup for aCatId attribute
const CAT_INDEX = {};
CATS.forEach((c, i) => { CAT_INDEX[c] = i; });

export default function DiseaseNodes() {
  const meshRef = useRef();
  const diseases = useStore(s => s.diseases);
  const shaderMode = useStore(s => s.shaderMode);
  const count = diseases.length;
  const mobDevice = TIER === 'LOW';

  // Wire up attention-map recoloring (neglectMode toggle)
  useAttentionColors(meshRef);

  // Pre-compute intro reveal data: hero index, constellation set, distance-from-hero
  const introData = useMemo(() => {
    // Find hero (most papers = rank 0, positioned at origin)
    let heroIdx = 0;
    let maxPapers = 0;
    for (let i = 0; i < count; i++) {
      if (diseases[i].papers > maxPapers) { maxPapers = diseases[i].papers; heroIdx = i; }
    }
    const heroCategory = diseases[heroIdx].category;
    const catPos = useStore.getState().catPos;

    // Constellation: same category as hero + spatially nearest
    const constellation = new Set([heroIdx]);
    const heroPos = catPos[heroIdx];

    // Compute distances from hero for all nodes
    const distances = new Float32Array(count);
    let maxDist = 0;
    for (let i = 0; i < count; i++) {
      const dx = catPos[i][0] - heroPos[0];
      const dy = catPos[i][1] - heroPos[1];
      const dz = catPos[i][2] - heroPos[2];
      distances[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distances[i] > maxDist) maxDist = distances[i];
    }
    // Normalize distances to 0–1
    const normDist = new Float32Array(count);
    for (let i = 0; i < count; i++) normDist[i] = maxDist > 0 ? distances[i] / maxDist : 0;

    // Add same-category nodes as constellation (up to 12)
    const sameCat = [];
    for (let i = 0; i < count; i++) {
      if (i !== heroIdx && diseases[i].category === heroCategory) {
        sameCat.push({ i, dist: distances[i] });
      }
    }
    sameCat.sort((a, b) => a.dist - b.dist);
    for (let j = 0; j < Math.min(11, sameCat.length); j++) {
      constellation.add(sameCat[j].i);
    }

    return { heroIdx, constellation, normDist };
  }, [count, diseases]);

  // Intro scale tracking
  const introScalesRef = useRef(null);
  const introDoneRef = useRef(false);

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, mobDevice ? 16 : 64, mobDevice ? 16 : 64);
    const phases = new Float32Array(count);
    const catIds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      catIds[i] = CAT_INDEX[diseases[i].category] || 0;
    }
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    g.setAttribute('aCatId', new THREE.InstancedBufferAttribute(catIds, 1));
    return g;
  }, [count, mobDevice, diseases]);

  const fogUniforms = useMemo(() => ({
    fogColor: { value: new THREE.Color(0x000000) },
    fogNear: { value: 400.0 },
    fogFar: { value: 2000.0 },
  }), []);

  const plasmaMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, ...fogUniforms },
      vertexShader: plasmaVert,
      fragmentShader: plasmaFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const pulseMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, ...fogUniforms },
      vertexShader: pulseVert,
      fragmentShader: pulseFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const fallbackMat = useMemo(() => {
    if (!mobDevice) return null;
    return new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.95, shininess: 60 });
  }, [mobDevice]);

  const mat = mobDevice ? fallbackMat : (shaderMode === 'pulse' ? pulseMat : plasmaMat);

  // Initialize instance matrices and colors
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const catPos = useStore.getState().catPos;

    // Reset intro scales on remount (shader toggle)
    introScalesRef.current = new Float32Array(count);
    introDoneRef.current = useStore.getState().introPhase >= 5;
    if (introDoneRef.current) {
      introScalesRef.current.fill(1);
    }

    for (let i = 0; i < count; i++) {
      _v3.set(catPos[i][0], catPos[i][1], catPos[i][2]);
      const r = nR(diseases[i].papers);
      const is = introScalesRef.current[i];
      _s3.set(r * is, r * is, r * is);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
      mesh.setColorAt(i, new THREE.Color(CC[diseases[i].category]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sceneRefs.instancedMesh = mesh;
  }, [count, diseases, shaderMode]);

  // Update fog range based on data extent
  useEffect(() => {
    const rawMax = useStore.getState().rawMax || 600;
    const near = rawMax * 0.6;
    const far = rawMax * 3.0;
    if (plasmaMat) {
      plasmaMat.uniforms.fogNear.value = near;
      plasmaMat.uniforms.fogFar.value = far;
    }
    if (pulseMat) {
      pulseMat.uniforms.fogNear.value = near;
      pulseMat.uniforms.fogFar.value = far;
    }
  }, [plasmaMat, pulseMat]);

  // Every frame: rebuild matrices from curPos + update shader time
  useFrame((state) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const store = useStore.getState();
    const curPos = store.curPos;
    const sizeMode = store.sizeMode;

    if (mat.uniforms) mat.uniforms.time.value = state.clock.getElapsedTime();

    // Intro scale logic
    if (!introDoneRef.current) {
      const scales = introScalesRef.current;
      if (!scales) return;

      const { introPhase, introProgress } = store;
      const { heroIdx, constellation, normDist } = introData;

      for (let i = 0; i < count; i++) {
        let target = 0;
        if (introPhase >= 5) {
          target = 1;
        } else if (introPhase >= 3) {
          // Galaxy: staggered by distance from hero
          target = introProgress > normDist[i] * 0.4 + 0.5 ? 1 : 0;
        } else if (introPhase >= 2) {
          // Constellation: hero + same-category neighbors
          target = constellation.has(i) ? 1 : 0;
        } else if (introPhase >= 1) {
          // Hero only
          target = i === heroIdx ? 1 : 0;
        }
        // Never regress — once a node has started appearing, keep it
        if (target < scales[i]) target = scales[i] > 0.01 ? 1 : 0;
        // Lerp toward target
        scales[i] += (target - scales[i]) * 0.08;
        if (scales[i] < 0.001) scales[i] = 0;
        if (scales[i] > 0.999) scales[i] = 1;
      }

      if (introPhase >= 5) {
        // Check if all scales reached 1
        let allDone = true;
        for (let i = 0; i < count; i++) {
          if (scales[i] < 0.999) { allDone = false; break; }
        }
        if (allDone) {
          scales.fill(1);
          introDoneRef.current = true;
        }
      }
    }

    const scales = introScalesRef.current;
    for (let i = 0; i < count; i++) {
      _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
      const r = sizeMode === 'papers' ? nR(diseases[i].papers) : nRM(diseases[i].mortality);
      const is = scales ? scales[i] : 1;
      _s3.set(r * is, r * is, r * is);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const onPointerOver = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      useStore.getState().setHovered(e.instanceId);
      document.body.style.cursor = 'pointer';
    }
  };
  const onPointerOut = () => {
    useStore.getState().setHovered(null);
    document.body.style.cursor = 'default';
  };
  const onClick = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      useStore.getState().selectDisease(e.instanceId);
    }
  };

  return (
    <instancedMesh
      key={shaderMode}
      ref={meshRef}
      args={[geo, mat, count]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
}
