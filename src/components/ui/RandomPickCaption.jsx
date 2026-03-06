import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function RandomPickCaption() {
  const randomPickCaption = useStore(s => s.randomPickCaption);
  const stopRandomPick = useStore(s => s.stopRandomPick);

  if (!randomPickCaption) return null;
  const mob = isMob();

  return (
    <div
      key={randomPickCaption.disease.id}
      onClick={stopRandomPick}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12,
        padding: mob ? '14px 20px' : '20px 32px',
        fontFamily: 'IBM Plex Mono,monospace', textAlign: 'center',
        opacity: 0, animation: 'fadeIn 0.5s ease forwards',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.1)',
        maxWidth: mob ? '92vw' : 520, cursor: 'pointer', pointerEvents: 'auto',
      }}
    >
      <div style={{ fontSize: 8, color: '#f59e0b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>&#x27f3; Random Pick</div>
      <div style={{ fontSize: mob ? 15 : 18, color: '#f1f5f9', fontWeight: 600, marginBottom: 10 }}>{randomPickCaption.disease.label}</div>
      <div style={{ fontSize: mob ? 11 : 13, color: '#cbd5e1', lineHeight: 1.6 }}>{randomPickCaption.fact}</div>
      <div style={{ color: '#64748b', fontSize: 10, marginTop: 12 }}>{mob ? 'tap' : 'click'} to dismiss</div>
    </div>
  );
}
