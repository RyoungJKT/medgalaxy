import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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

  // Expose camera to sceneRefs for NodeLabels projection
  useEffect(() => {
    sceneRefs.camera = camera;
  }, [camera]);

  // Initial zoom-out animation
  useEffect(() => {
    camera.position.set(0, 0, camDist * 0.4);
    gsap.to(camera.position, {
      z: camDist,
      duration: 2.3,
      ease: 'power2.out',
    });
  }, [camera, camDist]);

  // Subscribe to flyTarget changes
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.flyTarget,
      (flyTarget) => {
        if (!flyTarget || !controlsRef.current) return;
        const controls = controlsRef.current;

        // Kill existing tweens
        tweenRef.current.forEach(t => t.kill());
        tweenRef.current = [];

        const dur = flyTarget.duration || 1.2;

        tweenRef.current.push(
          gsap.to(controls.target, {
            x: flyTarget.position[0],
            y: flyTarget.position[1],
            z: flyTarget.position[2],
            duration: dur,
            ease: 'power3.inOut',
          })
        );

        if (flyTarget.radius) {
          const dir = camera.position.clone().sub(controls.target).normalize();
          const targetPos = controls.target.clone().add(dir.multiplyScalar(flyTarget.radius));
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease: 'power3.inOut',
            })
          );
        } else {
          // No radius = reset to default zoom (fly back to camDist on z-axis)
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: 0,
              y: 0,
              z: camDist,
              duration: dur,
              ease: 'power3.inOut',
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

  useFrame(() => {
    if (controlsRef.current) {
      idleFrames.current++;
      controlsRef.current.autoRotate = idleFrames.current > 300;
    }

    // Subtle cursor parallax: offset camera position slightly based on mouse
    if (TIER !== 'LOW') {
      const targetX = mouseRef.current.x * PARALLAX_STRENGTH;
      const targetY = -mouseRef.current.y * PARALLAX_STRENGTH;
      // Smooth lerp
      const prev = parallaxOffset.current;
      const dx = targetX - prev.x;
      const dy = targetY - prev.y;
      prev.x += dx * 0.05;
      prev.y += dy * 0.05;
      // Apply as small camera offset (additive, won't fight orbit controls)
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
