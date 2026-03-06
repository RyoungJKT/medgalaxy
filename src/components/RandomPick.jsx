import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import useStore from '../store';
import { RANDOM_PICK_DISEASES } from '../utils/constants';

const TORNADO_COUNT = 200;
const GA = 2.399963; // golden angle

export default function RandomPick() {
  const tornadoRef = useRef();
  const rpRef = useRef({
    phase: 0,
    f: 0,
    chosenIdx: -1,
    fact: '',
    origPositions: null,
    clusterPos: null,
    velocities: null,
  });
  const tweensRef = useRef([]);
  const { camera } = useThree();

  // Tornado particle data: pre-computed per-particle parameters
  const tornadoData = useMemo(() => {
    const data = [];
    for (let i = 0; i < TORNADO_COUNT; i++) {
      data.push({
        a: Math.random() * Math.PI * 2,      // initial angle
        r: Math.random(),                      // radial offset factor
        h: (Math.random() * 2 - 1),           // height factor (-1 to 1)
        spd: 0.5 + Math.random() * 1.5,       // angular speed multiplier
      });
    }
    return data;
  }, []);

  // Create tornado geometry buffer
  const tornadoGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(TORNADO_COUNT * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const tornadoMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0x66ccff,
        size: 3,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    []
  );

  // Subscribe to randomPickPhase to start the animation
  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.randomPickPhase,
      (phase) => {
        const rp = rpRef.current;

        if (phase === 1 && rp.phase === 0) {
          // Start: pick a random disease
          const { idMap, curPos, diseases, rawMax } = useStore.getState();
          if (!curPos) return;

          const pick =
            RANDOM_PICK_DISEASES[
              Math.floor(Math.random() * RANDOM_PICK_DISEASES.length)
            ];
          const chosenIdx = idMap[pick.id];
          if (chosenIdx === undefined) return;

          rp.chosenIdx = chosenIdx;
          rp.fact = pick.fact;
          rp.origPositions = curPos.map((p) => [...p]);
          rp.clusterPos = null;
          rp.velocities = null;
          rp.phase = 1;
          rp.f = 0;

          // Hide story, clear selection
          useStore.setState({
            storyVisible: false,
            randomPickCaption: null,
            selectedNode: null,
          });
        } else if (phase === 0 && rp.phase > 0) {
          // Stop: animate back to catPos
          const { curPos, catPos } = useStore.getState();
          if (curPos) {
            tweensRef.current.forEach((t) => t.kill());
            tweensRef.current = [];
            for (let i = 0; i < curPos.length; i++) {
              tweensRef.current.push(
                gsap.to(curPos[i], {
                  0: catPos[i][0],
                  1: catPos[i][1],
                  2: catPos[i][2],
                  duration: 1.0,
                  ease: 'power2.inOut',
                })
              );
            }
          }

          rp.phase = 0;
          rp.f = 0;
          rp.chosenIdx = -1;
          rp.clusterPos = null;

          useStore.setState({
            randomPickCaption: null,
            storyVisible: true,
            selectedNode: null,
          });

          // Fly camera back to default
          useStore.getState().setFlyTarget({
            position: [0, 0, 0],
            radius: null,
          });
        }
      }
    );

    return () => {
      unsub();
      tweensRef.current.forEach((t) => t.kill());
    };
  }, []);

  // Main animation loop
  useFrame((state) => {
    const rp = rpRef.current;
    const controls = state.controls;
    if (!controls) return;

    const { curPos, diseases, rawMax } = useStore.getState();
    if (!curPos) return;
    const count = diseases.length;

    // Tornado visibility when not animating
    if (rp.phase === 0) {
      if (tornadoMat.opacity > 0) tornadoMat.opacity = 0;
      return;
    }

    rp.f++;
    const defaultRadius = rawMax ? rawMax * 1.1 : 700;
    const ballR = defaultRadius * 0.28;

    if (rp.phase === 1) {
      // Phase 1: Fibonacci sphere collapse (150 frames)
      const t = Math.min(rp.f / 150, 1);

      // Ramp autoRotateSpeed
      const easeIn = t * t;
      controls.autoRotateSpeed = 0.3 + easeIn * 7;
      controls.autoRotate = true;

      // Compute cluster targets on first frame
      if (!rp.clusterPos) {
        const jit = ballR * 0.35;
        rp.clusterPos = [];
        for (let i = 0; i < count; i++) {
          const phi2 = Math.acos(1 - 2 * (i + 0.5) / count);
          const theta2 = GA * i;
          rp.clusterPos.push([
            Math.sin(phi2) * Math.cos(theta2) * ballR + Math.sin(i * 3.7) * jit,
            Math.cos(phi2) * ballR + Math.cos(i * 5.3) * jit,
            Math.sin(phi2) * Math.sin(theta2) * ballR + Math.sin(i * 7.1) * jit,
          ]);
        }
      }

      const cp = rp.clusterPos;
      const orig = rp.origPositions;

      // Smoothstep blend from original to cluster
      const blend = t * t * (3 - 2 * t);
      for (let i = 0; i < count; i++) {
        curPos[i][0] = orig[i][0] * (1 - blend) + cp[i][0] * blend;
        curPos[i][1] = orig[i][1] * (1 - blend) + cp[i][1] * blend;
        curPos[i][2] = orig[i][2] * (1 - blend) + cp[i][2] * blend;
      }

      if (rp.f >= 150) {
        rp.phase = 2;
        rp.f = 0;
      }
    } else if (rp.phase === 2) {
      // Phase 2: Spin ramp (460 frames)
      const rampT = Math.min(rp.f / 220, 1);
      const rampEase = rampT * rampT * rampT;
      controls.autoRotateSpeed = 8 + rampEase * 92; // ramp to 100

      // Camera shake in final 60 frames
      const shakeT = Math.max(0, (rp.f - 400) / 60);
      if (shakeT > 0) {
        const sk = shakeT * 0.5;
        controls.target.x = Math.sin(rp.f * 1.7) * sk;
        controls.target.y = Math.cos(rp.f * 2.3) * sk;
      }

      // Hold cluster positions stable
      const cp = rp.clusterPos;
      for (let i = 0; i < count; i++) {
        curPos[i][0] = cp[i][0];
        curPos[i][1] = cp[i][1];
        curPos[i][2] = cp[i][2];
      }

      if (rp.f >= 460) {
        rp.phase = 3;
        rp.f = 0;
        controls.target.set(0, 0, 0);

        // Initialize per-node explosion velocities
        const vels = [];
        for (let i = 0; i < count; i++) {
          if (i === rp.chosenIdx) {
            vels.push([0, 0, 0]);
            continue;
          }
          const u = Math.random() * 2 - 1;
          const th = Math.random() * Math.PI * 2;
          const s2 = Math.sqrt(1 - u * u);
          const spd = defaultRadius * 0.12 * (0.7 + Math.random() * 0.6);
          vels.push([s2 * Math.cos(th) * spd, u * spd, s2 * Math.sin(th) * spd]);
        }
        rp.velocities = vels;
      }
    } else if (rp.phase === 3) {
      // Phase 3: Physics explosion (90 frames)
      const t = Math.min(rp.f / 90, 1);
      // Decelerate rotation
      controls.autoRotateSpeed = 100 * Math.pow(1 - t, 3) + 0.3;

      const drag = 0.96;
      const vels = rp.velocities;

      for (let i = 0; i < count; i++) {
        if (i === rp.chosenIdx) {
          // Chosen: converge to center after brief delay
          const ce = t < 0.25 ? 0 : Math.min((t - 0.25) / 0.35, 1);
          const ce2 = ce * ce * (3 - 2 * ce);
          curPos[i][0] *= 1 - ce2 * 0.15;
          curPos[i][1] *= 1 - ce2 * 0.15;
          curPos[i][2] *= 1 - ce2 * 0.15;
        } else {
          // Apply velocity then damp
          curPos[i][0] += vels[i][0];
          curPos[i][1] += vels[i][1];
          curPos[i][2] += vels[i][2];
          vels[i][0] *= drag;
          vels[i][1] *= drag;
          vels[i][2] *= drag;
        }
      }

      if (rp.f >= 90) {
        rp.phase = 4;
        rp.f = 0;
        controls.autoRotateSpeed = 0.3;

        const ds = useStore.getState().diseases;
        useStore.getState().selectDisease(rp.chosenIdx);
        useStore.setState({
          randomPickCaption: { disease: ds[rp.chosenIdx], fact: rp.fact },
        });
      }
    }
    // Phase 4: Reveal - holding on chosen disease, no animation needed

    // ── Tornado swirl particles ──
    const tSpd = controls.autoRotateSpeed / 100; // 0-1 normalized

    if (rp.phase <= 2) {
      tornadoMat.opacity = Math.min(tSpd * 0.6, 0.5);
      const tp = tornadoGeo.getAttribute('position').array;
      for (let i = 0; i < TORNADO_COUNT; i++) {
        const d = tornadoData[i];
        d.a += d.spd * tSpd * 0.12;
        const wideR = ballR * (0.8 + d.r * 1.8);
        const h = d.h * ballR * 2.5;
        const funnel = 0.5 + 0.5 * (d.h + 1) * 0.5;
        tp[i * 3] = Math.cos(d.a) * wideR * funnel;
        tp[i * 3 + 1] = h;
        tp[i * 3 + 2] = Math.sin(d.a) * wideR * funnel;
      }
      tornadoGeo.getAttribute('position').needsUpdate = true;
    } else if (rp.phase === 3) {
      tornadoMat.opacity *= 0.9;
    } else {
      tornadoMat.opacity = 0;
    }
  });

  return <points ref={tornadoRef} geometry={tornadoGeo} material={tornadoMat} />;
}
