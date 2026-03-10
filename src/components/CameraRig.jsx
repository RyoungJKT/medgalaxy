import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';

const PARALLAX_STRENGTH = 3.0;

export default function CameraRig({ camDist }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const tweenRef = useRef([]);
  const idleFrames = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const parallaxOffset = useRef({ x: 0, y: 0 });
  const introStarted = useRef(false);

  // Expose camera to sceneRefs for NodeLabels projection
  useEffect(() => {
    sceneRefs.camera = camera;
  }, [camera]);

  // Cinematic intro: start close, delayed pullback
  useEffect(() => {
    // Start camera close to hero, slightly off-axis for cinematic angle
    camera.position.set(8, 5, camDist * 0.3);

    // Delayed pullback: wait 1.0s for hero to emerge, then pull back over 2.5s
    // Animate all axes so camera settles smoothly to final position
    const pullbackTween = gsap.to(camera.position, {
      x: 0,
      y: 0,
      z: camDist,
      duration: 2.5,
      delay: 1.0,
      ease: 'power2.out',
    });

    // Listen for skip: if intro is skipped, fast-forward camera
    const unsub = useStore.subscribe(
      s => s.introPhase,
      (phase) => {
        if (phase >= 5 && !introStarted.current) {
          pullbackTween.kill();
          gsap.to(camera.position, {
            x: 0, y: 0, z: camDist,
            duration: 0.5,
            ease: 'power2.out',
          });
        }
      }
    );

    return () => { pullbackTween.kill(); unsub(); };
  }, [camera, camDist]);

  // Subscribe to flyTarget changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.flyTarget,
      (flyTarget) => {
        if (!flyTarget || !controlsRef.current) return;
        // During supernova, only allow the prefocus camera move (phase will be 'prefocus')
        // Block the selectDisease flyTarget during burst/linkwave/settle
        const sp = useStore.getState().supernovaPhase;
        if (sp === 'charge' || sp === 'burst' || sp === 'linkwave') return;
        const controls = controlsRef.current;

        // Kill existing tweens
        tweenRef.current.forEach(t => t.kill());
        tweenRef.current = [];

        // Pause autoRotate during fly to prevent fighting GSAP
        controls.autoRotate = false;
        idleFrames.current = 0;

        const dur = flyTarget.duration || 1.2;
        const onUpdate = () => controls.update();

        tweenRef.current.push(
          gsap.to(controls.target, {
            x: flyTarget.position[0],
            y: flyTarget.position[1],
            z: flyTarget.position[2],
            duration: dur,
            ease: 'power3.inOut',
            onUpdate,
          })
        );

        if (flyTarget.cameraPos) {
          // Explicit camera position (e.g. supernova cinematic angle)
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: flyTarget.cameraPos[0],
              y: flyTarget.cameraPos[1],
              z: flyTarget.cameraPos[2],
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        } else if (flyTarget.radius) {
          // Fly toward node from current viewing angle
          const nodePos = new THREE.Vector3(flyTarget.position[0], flyTarget.position[1], flyTarget.position[2]);
          const dir = camera.position.clone().sub(nodePos).normalize();
          const targetPos = nodePos.clone().add(dir.multiplyScalar(flyTarget.radius));
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        } else {
          // Fly back: maintain current viewing direction toward origin
          const dir = camera.position.clone().normalize();
          const targetPos = dir.multiplyScalar(camDist);
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        }
      }
    );
    return unsub;
  }, [camera]);

  // Track mouse for parallax (desktop only)
  useEffect(() => {
    if (TIER === 'LOW') return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((state) => {
    const { introPhase, roulettePhase, supernovaPhase } = useStore.getState();

    if (controlsRef.current) {
      if (introPhase < 5) {
        controlsRef.current.autoRotate = false;
      } else if (supernovaPhase !== 'idle' && supernovaPhase !== 'complete') {
        controlsRef.current.autoRotate = false;
      } else if (roulettePhase === 'reveal') {
        controlsRef.current.autoRotate = true;
      } else {
        if (!introStarted.current) introStarted.current = true;
        idleFrames.current++;
        controlsRef.current.autoRotate = idleFrames.current > 300;
      }
    }

    // Subtle cursor parallax (desktop only, after intro)
    if (TIER !== 'LOW' && introPhase >= 5) {
      const targetX = mouseRef.current.x * PARALLAX_STRENGTH;
      const targetY = -mouseRef.current.y * PARALLAX_STRENGTH;
      const prev = parallaxOffset.current;
      prev.x += (targetX - prev.x) * 0.05;
      prev.y += (targetY - prev.y) * 0.05;
      camera.position.x += (prev.x - (camera.userData.lastParX || 0));
      camera.position.y += (prev.y - (camera.userData.lastParY || 0));
      camera.userData.lastParX = prev.x;
      camera.userData.lastParY = prev.y;
    }
  });

  const onStart = () => { idleFrames.current = 0; };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      autoRotateSpeed={0.3}
      minDistance={50}
      maxDistance={camDist * 4}
      onStart={onStart}
      makeDefault
    />
  );
}
