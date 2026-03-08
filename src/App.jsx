import React, { Suspense, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TIER, CFG } from './utils/tiers';
import { isMob } from './utils/helpers';
import useStore from './store';
import DiseaseNodes from './components/DiseaseNodes';
import EdgeNetwork from './components/EdgeNetwork';
import GlowSprites from './components/GlowSprites';
import CameraRig from './components/CameraRig';
import IdleDrift from './components/IdleDrift';
import BackgroundParticles from './components/BackgroundParticles';
import HtmlOverlay from './components/HtmlOverlay';
import HighlightSystem from './components/HighlightSystem';
import StoryEngine from './components/StoryEngine';
import ExplodeView from './components/ExplodeView';
import ConnectionsView from './components/ConnectionsView';
import VelocityMap from './components/VelocityMap';
import AttentionMap from './components/AttentionMap';
import Spotlight from './components/Spotlight';
import SelectionDOF from './components/SelectionDOF';
import SelectionRipple from './components/SelectionRipple';
import IntroSequence from './components/IntroSequence';
import AdaptiveDpr from './components/AdaptiveDpr';
import GravityLens from './components/GravityLens';
import GalaxyRoulette from './components/GalaxyRoulette';
import RouletteDust from './components/RouletteDust';
import { sceneRefs } from './sceneRefs';

export default function App() {
  const rawMax = useStore(s => s.rawMax);
  const mob = isMob();
  const camDist = rawMax ? rawMax * (mob ? 2.4 : 1.4) : 900;

  // Single click on blank area: deselect + fly back (only on clean click, not drag)
  const pointerDownRef = React.useRef({ x: 0, y: 0, time: 0 });
  const handlePointerMissed = useCallback((e) => {
    const dx = e.clientX - pointerDownRef.current.x;
    const dy = e.clientY - pointerDownRef.current.y;
    const dt = Date.now() - pointerDownRef.current.time;
    // Only treat as click if mouse barely moved and was quick
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5 || dt > 300) return;
    // Only left click
    if (e.button !== 0) return;
    const s = useStore.getState();
    if (s.roulettePhase !== 'idle') return;
    if (s.activeMode === 'connections') {
      s.setConnFocusIdx(-1);
      s.setActiveMode(null);
      s.deselect();
      return;
    }
    if (s.selectedNode) s.deselect();
  }, []);

  // Double-click to reset view (deselect + fly back to origin)
  const handleDoubleClick = useCallback(() => {
    const { deselect, setActiveMode, activeMode, selectedNode,
      spotlightActive, setSpotlightActive, setSpotlightCaption,
      storyActive, setStoryActive,
      setStoryCaption, setStoryStep, setStoryVisible,
      setNeglectMode, neglectMode, setConnFocusIdx,
      roulettePhase, stopRoulette } = useStore.getState();
    // Cancel roulette if active
    if (roulettePhase !== 'idle') { deselect(); stopRoulette(); return; }
    // Stop spotlight
    if (spotlightActive) { setSpotlightActive(false); setSpotlightCaption(''); }
    // Stop story
    if (storyActive) { setStoryActive(null); setStoryCaption(''); setStoryStep(0); setStoryVisible(true); }
    // Close overlays
    if (activeMode) setActiveMode(null);
    // Exit neglect mode
    if (neglectMode) setNeglectMode(false);
    // Reset connection focus
    setConnFocusIdx(-1);
    // Deselect node and fly back
    deselect();
  }, []);

  // Escape key to exit focus view, close overlays, stop tours
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      const s = useStore.getState();
      // Cancel roulette (highest priority)
      if (s.roulettePhase !== 'idle') {
        if (!s.selectedNode) s.deselect(); // only deselect if no winner selected yet
        s.stopRoulette();
        return;
      }
      // Exit connections hub view — reset everything at once
      if (s.activeMode === 'connections') {
        s.setConnFocusIdx(-1);
        s.setActiveMode(null);
        s.deselect();
        return;
      }
      // Close sidebar (deselect node) first
      if (s.selectedNode) { s.deselect(); return; }
      // Close overlay modals
      if (s.activeMode) { s.setActiveMode(null); return; }
      // Stop spotlight
      if (s.spotlightActive) { s.setSpotlightActive(false); s.setSpotlightCaption(''); return; }
      // Stop story
      if (s.storyActive) { s.setStoryActive(null); s.setStoryCaption(''); s.setStoryStep(0); s.setStoryVisible(true); return; }
      // Exit neglect mode
      if (s.neglectMode) { s.setNeglectMode(false); return; }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerDown={(e) => { pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }; }}
      onDoubleClick={handleDoubleClick}
    >
      <Canvas
        dpr={[1, CFG.dprCap]}
        camera={{
          fov: 60,
          near: 1,
          far: camDist * 4,
          position: [0, 0, camDist],
        }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: mob ? 1.4 : 1.1,
        }}
        style={{ background: '#000000' }}
        onCreated={({ gl }) => { sceneRefs.canvasElement = gl.domElement; }}
        onPointerMissed={handlePointerMissed}
      >
        <ambientLight intensity={mob ? 0.6 : 0.3} />
        <pointLight intensity={mob ? 1.2 : 0.6} position={[0, 0, 0]} />
        <directionalLight
          color={mob ? 0xffffff : 0x6699cc}
          intensity={mob ? 1.0 : 0.3}
          position={[-200, 250, 300]}
        />
        {mob && (
          <directionalLight
            color={0xffffff}
            intensity={0.5}
            position={[200, -100, -200]}
          />
        )}

        <Suspense fallback={null}>
          <DiseaseNodes />
          <EdgeNetwork />
          <GlowSprites />
          <CameraRig camDist={camDist} />
          <IdleDrift />
          <GravityLens />
          <BackgroundParticles camDist={camDist} />
          <HighlightSystem />
          <StoryEngine />
          <ExplodeView />
          <ConnectionsView />
          <VelocityMap />
          <AttentionMap />
          <Spotlight />
          <SelectionDOF />
          <SelectionRipple />
          <IntroSequence />
          <AdaptiveDpr />
          <GalaxyRoulette />
          <RouletteDust />
        </Suspense>
      </Canvas>

      <HtmlOverlay />
    </div>
  );
}
