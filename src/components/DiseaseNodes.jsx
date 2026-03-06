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

  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, mobDevice ? 16 : 24, mobDevice ? 16 : 24);
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

    for (let i = 0; i < count; i++) {
      _v3.set(catPos[i][0], catPos[i][1], catPos[i][2]);
      const r = nR(diseases[i].papers);
      _s3.set(r, r, r);
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
    const curPos = useStore.getState().curPos;
    const sizeMode = useStore.getState().sizeMode;

    if (mat.uniforms) mat.uniforms.time.value = state.clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
      const r = sizeMode === 'papers' ? nR(diseases[i].papers) : nRM(diseases[i].mortality);
      _s3.set(r, r, r);
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
