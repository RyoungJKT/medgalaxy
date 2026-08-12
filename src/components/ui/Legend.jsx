import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import meta from '../../../data/meta.json';

export default function Legend() {
  const sizeMode = useStore(s => s.sizeMode);
  const uiRevealed = useStore(s => s.uiRevealed);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const mob = isMob();

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: mob ? '8px 12px' : '8px 16px', display: 'flex', gap: mob ? 8 : 16,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#cbd5e1',
      background: 'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',
      pointerEvents: 'none', transform: 'translateY(100%)', animation: uiRevealed ? 'slideUp 0.5s ease 0.4s forwards' : 'none',
    }}>
      {mob ? (
        <span>Tap to explore &middot; Pinch to zoom</span>
      ) : (
        <>
          <span>Node size = {sizeMode === 'papers' ? 'publications' : 'mortality'}</span>
          <span>Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan &middot; Double-click to re-center</span>
        </>
      )}
      {/* Header hides its count below 1539px with nothing standing in for it
          (Task 13 review finding 10); the legend footer carries it always. */}
      <span>{diseases.length} diseases &middot; {displayEdges.length} connections</span>
      <span style={{ marginLeft: 'auto' }}>{`Data: PubMed, refreshed weekly (latest: ${meta.pubmedLastRefresh}) · WHO GHE 2021 and per-disease sources · Project by Russell J. Young`}</span>
    </div>
  );
}
