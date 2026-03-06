import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function SpotlightCaption() {
  const spotlightCaption = useStore(s => s.spotlightCaption);
  const spotlightActive = useStore(s => s.spotlightActive);

  if (!spotlightActive || !spotlightCaption) return null;
  const mob = isMob();

  return (
    <div
      key={spotlightCaption}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '12px 18px' : '16px 28px',
        fontFamily: 'IBM Plex Mono,monospace', textAlign: 'center',
        opacity: 0, animation: 'fadeIn 0.4s ease forwards',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>Spotlight</div>
      <div style={{ fontSize: mob ? 12 : 14, color: '#f1f5f9', lineHeight: 1.5, whiteSpace: mob ? 'normal' : 'nowrap', maxWidth: mob ? '85vw' : 'none' }}>{spotlightCaption}</div>
    </div>
  );
}
