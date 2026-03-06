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
import RandomPickCaption from './ui/RandomPickCaption';
import ExplodeOverlay from './ui/ExplodeOverlay';
import ConnectionsOverlay from './ui/ConnectionsOverlay';
import VelocityOverlay from './ui/VelocityOverlay';

export default function HtmlOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <NodeLabels />
      <Header />
      <FilterBar />
      <Legend />
      <Tooltip />
      <Sidebar />
      <StoryChips />
      <StoryCaption />
      <SpotlightCaption />
      <RandomPickCaption />
      <ExplodeOverlay />
      <ConnectionsOverlay />
      <VelocityOverlay />
    </div>
  );
}
