import React from 'react';
import useStore from '../../store';

export default function SupernovaOverlay() {
  const phase = useStore(s => s.supernovaPhase);
  const caption = useStore(s => s.supernovaCaption);
  const storyActive = useStore(s => s.storyActive);

  const active = phase !== 'idle' && phase !== 'complete';
  const showVignette = phase === 'prefocus' || phase === 'charge' || phase === 'burst';
  // Hide telemetry caption when story is driving — story caption provides context instead
  const showCaption = (phase === 'prefocus' || phase === 'charge') && !storyActive;

  if (!active) return null;

  return (
    <>
      {/* Vignette overlay */}
      {showVignette && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
            opacity: phase === 'burst' ? 0.3 : 0.8,
            transition: 'opacity 0.4s ease',
            zIndex: 5,
          }}
        />
      )}

      {/* Telemetry caption */}
      {showCaption && caption && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 6,
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 6,
          }}>
            {phase === 'charge' ? 'ANALYZING' : 'FOCUSING'}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 0 20px rgba(255,255,255,0.3)',
            letterSpacing: '0.05em',
          }}>
            {caption}
          </div>
        </div>
      )}
    </>
  );
}
