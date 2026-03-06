import React, { Suspense, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TIER, CFG } from './utils/tiers';
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
import RandomPick from './components/RandomPick';
import Spotlight from './components/Spotlight';
import SelectionDOF from './components/SelectionDOF';
import { sceneRefs } from './sceneRefs';

export default function App() {
  const rawMax = useStore(s => s.rawMax);
  const camDist = rawMax ? rawMax * 1.4 : 900;

  // Double-click to reset view (deselect + fly back to origin)
  const handleDoubleClick = useCallback(() => {
    const { deselect, setActiveMode, activeMode, selectedNode,
      spotlightActive, setSpotlightActive, setSpotlightCaption,
      stopRandomPick, randomPickPhase, storyActive, setStoryActive,
      setStoryCaption, setStoryStep, setStoryVisible,
      setNeglectMode, neglectMode, setConnFocusIdx } = useStore.getState();
    // Stop spotlight
    if (spotlightActive) { setSpotlightActive(false); setSpotlightCaption(''); }
    // Stop random pick
    if (randomPickPhase > 0) stopRandomPick();
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
      // Close sidebar (deselect node) first
      if (s.selectedNode) { s.deselect(); return; }
      // Close overlay modals
      if (s.activeMode) { s.setActiveMode(null); return; }
      // Stop spotlight
      if (s.spotlightActive) { s.setSpotlightActive(false); s.setSpotlightCaption(''); return; }
      // Stop random pick
      if (s.randomPickPhase > 0) { s.stopRandomPick(); return; }
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
      onDoubleClick={handleDoubleClick}
    >
      <Canvas
        dpr={[1, CFG.dprCap === 99 ? window.devicePixelRatio : CFG.dprCap]}
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
          toneMappingExposure: 1.1,
        }}
        style={{ background: '#000000' }}
        onCreated={({ gl }) => { sceneRefs.canvasElement = gl.domElement; }}
      >
        <ambientLight intensity={0.3} />
        <pointLight intensity={0.6} />
        <directionalLight
          color={0x6699cc}
          intensity={0.3}
          position={[-200, 150, -300]}
        />

        <Suspense fallback={null}>
          <DiseaseNodes />
          <EdgeNetwork />
          <GlowSprites />
          <CameraRig camDist={camDist} />
          <IdleDrift />
          <BackgroundParticles camDist={camDist} />
          <HighlightSystem />
          <StoryEngine />
          <ExplodeView />
          <ConnectionsView />
          <VelocityMap />
          <AttentionMap />
          <RandomPick />
          <Spotlight />
          <SelectionDOF />
        </Suspense>
      </Canvas>

      <HtmlOverlay />
    </div>
  );
}
