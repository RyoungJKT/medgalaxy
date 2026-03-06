import React from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function StoryCaption() {
  const storyCaption = useStore(s => s.storyCaption);
  const setStoryStep = useStore(s => s.setStoryStep);
  const storyStep = useStore(s => s.storyStep);

  if (!storyCaption) return null;
  const mob = isMob();

  const handleClick = () => {
    setStoryStep(storyStep + 1);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '14px 20px' : '18px 32px',
        fontFamily: 'IBM Plex Mono,monospace', fontSize: mob ? 13 : 15,
        color: '#f1f5f9', whiteSpace: mob ? 'normal' : 'nowrap',
        maxWidth: mob ? '92vw' : 'none', textAlign: 'center',
        cursor: 'pointer', opacity: 0, animation: 'fadeIn 0.4s ease forwards',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', letterSpacing: '0.01em', lineHeight: 1.5,
        pointerEvents: 'auto',
      }}
    >
      {storyCaption}
      <div style={{ color: '#94a3b8', fontSize: mob ? 10 : 11, marginTop: 8 }}>
        {mob ? 'tap' : 'click'} to continue
      </div>
    </div>
  );
}
