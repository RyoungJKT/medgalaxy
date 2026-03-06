import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function Legend() {
  const sizeMode = useStore(s => s.sizeMode);
  const introStarted = useStore(s => s.introStarted);
  const mob = isMob();

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: mob ? '8px 12px' : '8px 16px', display: 'flex', gap: mob ? 8 : 16,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#cbd5e1',
      background: 'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',
      pointerEvents: 'none', transform: 'translateY(100%)', animation: introStarted ? 'slideUp 0.5s ease 3.4s forwards' : 'none',
    }}>
      {mob ? (
        <span>Tap to explore &middot; Pinch to zoom</span>
      ) : (
        <>
          <span>Node size = {sizeMode === 'papers' ? 'publications' : 'mortality'}</span>
          <span>Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan &middot; Double-click to re-center</span>
        </>
      )}
      <span style={{ marginLeft: 'auto' }}>Data: PubMed &middot; WHO Global Health Estimates 2021 &middot; Project by Russell J. Young</span>
    </div>
  );
}
