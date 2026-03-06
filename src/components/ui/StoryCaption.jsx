import React, { useEffect, useRef, useCallback } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

function endStory() {
  useStore.getState().setStoryCaption('');
  useStore.setState({ selectedNode: null });
  useStore.getState().setFlyTarget({ position: [0, 0, 0], radius: null, duration: 2.0 });
  setTimeout(() => {
    useStore.setState({ storyActive: null, storyStep: 0, storyVisible: true });
  }, 1800);
}

export default function StoryCaption() {
  const storyCaption = useStore(s => s.storyCaption);
  const setStoryStep = useStore(s => s.setStoryStep);
  const storyStep = useStore(s => s.storyStep);
  const boxRef = useRef(null);
  const rafRef = useRef(null);

  // JS-driven border pulse — bypasses CSS specificity issues
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let t = 0;
    const tick = () => {
      t += 0.02; // ~3s full cycle at 60fps
      const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t));
      el.style.borderColor = `rgba(255,255,255,${a.toFixed(3)})`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [storyCaption]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') endStory();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!storyCaption) return null;
  const mob = isMob();

  const handleClick = () => {
    setStoryStep(storyStep + 1);
  };

  return (
    <div
      ref={boxRef}
      onClick={handleClick}
      style={{
        position: 'absolute', bottom: mob ? 90 : 110, left: '50%', transform: 'translateX(-50%)',
        zIndex: 46, background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
        padding: mob ? '14px 20px' : '18px 32px',
        fontFamily: 'IBM Plex Mono,monospace', fontSize: mob ? 14 : 17,
        color: '#f1f5f9', whiteSpace: mob ? 'normal' : 'nowrap',
        maxWidth: mob ? '92vw' : 'none', textAlign: 'center',
        cursor: 'pointer', opacity: 0,
        animation: 'fadeIn 0.4s ease forwards',
        letterSpacing: '0.01em', lineHeight: 1.5,
        pointerEvents: 'auto',
      }}
    >
      {storyCaption}
      <div style={{ color: '#94a3b8', fontSize: mob ? 11 : 12, marginTop: 8 }}>
        {mob ? 'tap' : 'click'} to continue &middot; esc to exit
      </div>
    </div>
  );
}
