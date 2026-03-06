import React, { Suspense } from 'react';
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
import { sceneRefs } from './sceneRefs';

export default function App() {
  const rawMax = useStore(s => s.rawMax);
  const camDist = rawMax ? rawMax * 1.1 : 700;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        </Suspense>
      </Canvas>

      <HtmlOverlay />
    </div>
  );
}
