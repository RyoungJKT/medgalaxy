import React from 'react';
import NodeLabels from './NodeLabels';
import Header from './ui/Header';
import FilterBar from './ui/FilterBar';
import Legend from './ui/Legend';
import Tooltip from './ui/Tooltip';
import Sidebar from './ui/Sidebar';
import StoryChips from './ui/StoryChips';
import StoryCaption from './ui/StoryCaption';
import SpotlightCaption from './ui/SpotlightCaption';
import RouletteCaption from './ui/RouletteCaption';
import ExplodeOverlay from './ui/ExplodeOverlay';
import ConnectionsOverlay from './ui/ConnectionsOverlay';
import VelocityOverlay from './ui/VelocityOverlay';
import LandingOverlay from './ui/LandingOverlay';
import CompareCards from './ui/CompareCards';
import SupernovaOverlay from './ui/SupernovaOverlay';

export default function HtmlOverlay() {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        overflow: 'hidden', fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <NodeLabels />
      <Header />
      <FilterBar />
      <Legend />
      <Tooltip />
      <CompareCards />
      <Sidebar />
      <StoryChips />
      <StoryCaption />
      <SpotlightCaption />
      <RouletteCaption />
      <ExplodeOverlay />
      <ConnectionsOverlay />
      <VelocityOverlay />
      <LandingOverlay />
      <SupernovaOverlay />
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideDown{to{transform:translateY(0)}}
        @keyframes slideUp{to{transform:translateY(0)}}
        @keyframes fadeIn{to{opacity:1}}
        @keyframes chipPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 12px 4px rgba(34,197,94,0.15)}}
      `}</style>
    </div>
  );
}
