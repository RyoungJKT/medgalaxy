import React, { useState, useEffect } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function LandingOverlay() {
  const introStarted = useStore(s => s.introStarted);
  const setIntroStarted = useStore(s => s.setIntroStarted);
  const [exiting, setExiting] = useState(false);
  const mob = isMob();

  // Reduced motion: skip entirely
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      useStore.getState().skipIntro();
    }
  }, []);

  if (introStarted && !exiting) return null;

  const handleClick = () => {
    if (exiting) return;
    setExiting(true);
    setIntroStarted();
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        cursor: 'pointer',
        background: 'radial-gradient(ellipse at 30% 50%, rgba(8,12,24,0.92) 0%, rgba(2,4,10,0.98) 100%)',
        transition: 'opacity 0.8s ease',
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      <div style={{
        position: 'absolute',
        left: mob ? '6vw' : '8vw',
        top: '50%',
        transform: 'translateY(-54%)',
        maxWidth: mob ? '88vw' : 560,
      }}>
        {/* Title */}
        <h1 style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: mob ? 28 : 48,
          fontWeight: 300,
          lineHeight: 1.15,
          color: '#f1f5f9',
          letterSpacing: '-0.02em',
          margin: 0,
          opacity: 0,
          animation: 'landingFadeUp 1.2s ease 0.3s forwards',
        }}>
          The Cartography<br />of Human Disease
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: mob ? 12 : 15,
          fontWeight: 400,
          color: 'rgba(148,163,184,0.85)',
          letterSpacing: '0.04em',
          margin: 0,
          marginTop: mob ? 20 : 28,
          opacity: 0,
          animation: 'landingFadeUp 1.0s ease 1.0s forwards',
        }}>
          Papers, deaths, and what the world overlooks
        </p>

        {/* Prompt */}
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: mob ? 10 : 12,
          fontWeight: 400,
          color: 'rgba(162,174,190,0.68)',
          letterSpacing: '0.06em',
          margin: 0,
          marginTop: mob ? 36 : 52,
          opacity: 0,
          animation: 'landingFadeUp 0.8s ease 1.8s forwards, landingPulse 4s ease-in-out 3.0s infinite',
        }}>
          {mob ? 'Tap anywhere to begin' : 'Click anywhere to begin'}
        </p>
      </div>

      <style>{`
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes landingPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
