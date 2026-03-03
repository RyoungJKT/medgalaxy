import React from 'react';

export default function MedGalaxy() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#e2e8f0',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          MedGalaxy
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Session 1 complete — data loaded. Session 2 builds the 3D scene.
        </p>
      </div>
    </div>
  );
}
