import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function RouletteCaption() {
  const roulettePhase = useStore(s => s.roulettePhase);
  const rouletteCaption = useStore(s => s.rouletteCaption);

  if (roulettePhase !== 'reveal' || !rouletteCaption) return null;
  const mob = isMob();

  const handleDismiss = () => {
    useStore.getState().deselect();
    useStore.getState().stopRoulette();
  };

  return (
    <div
      key={rouletteCaption}
      onClick={handleDismiss}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%',
        transform: 'translateX(-50%)', zIndex: 46,
        background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(245,158,11,0.4)', borderRadius: 12,
        padding: mob ? '14px 20px' : '18px 32px',
        fontFamily: 'IBM Plex Mono,monospace', textAlign: 'center',
        cursor: 'pointer', opacity: 0,
        animation: 'fadeIn 0.6s ease forwards',
        boxShadow: '0 8px 32px rgba(245,158,11,0.15)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        fontSize: 9, color: '#f59e0b', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8,
      }}>
        Galaxy Roulette
      </div>
      <div style={{
        fontSize: mob ? 13 : 16, color: '#f1f5f9', lineHeight: 1.5,
        maxWidth: mob ? '85vw' : 420,
      }}>
        {rouletteCaption}
      </div>
      <div style={{
        color: '#94a3b8', fontSize: mob ? 10 : 11, marginTop: 10,
      }}>
        {mob ? 'tap' : 'click'} to return to galaxy
      </div>
    </div>
  );
}
