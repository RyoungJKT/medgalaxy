import React from 'react';
import useStore from '../../store';
import { CC, CL, CATS } from '../../utils/constants';
import { isMob } from '../../utils/helpers';
import { DUR, EASE } from '../../utils/motion';

export default function FilterBar() {
  const activeCats = useStore(s => s.activeCats);
  const toggleCat = useStore(s => s.toggleCat);
  const neglectMode = useStore(s => s.neglectMode);
  const uiRevealed = useStore(s => s.uiRevealed);
  const storyActive = useStore(s => s.storyActive);

  if (isMob()) return null;

  // A story owns the frame while it runs (Task 3, 2026-09-10 plan): the bar
  // dims rather than hides, matching the header's own controls.
  const dim = { opacity: storyActive ? 0.3 : 1, transition: `opacity ${DUR.ui}ms ${EASE.ui}` };

  if (neglectMode) {
    return (
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, zIndex: 40,
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: 10,
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, pointerEvents: 'none',
        // A still-attached forwards-filling animation keeps owning this
        // property in the cascade even after it finishes, which otherwise
        // beats dim's own opacity below once a story starts (Task 3 review
        // finding). Naming no animation at all while a story is active lets
        // dim be the sole ongoing opacity authority.
        opacity: 0, animation: storyActive ? 'none' : 'fadeIn 0.4s ease forwards',
        // dim is only spread in while a story is active. Spreading it
        // unconditionally used to overwrite the literal opacity:0 above with
        // dim.opacity (1 outside a story), leaving the fadeIn keyframe
        // (`to{opacity:1}`) nothing to animate from, since its implicit 0%
        // keyframe takes the element's own non-animated cascaded opacity as
        // its underlying value (Task 3 round 2 review finding).
        ...(storyActive ? { opacity: 0.3, transition: dim.transition } : {}),
      }}>
        <span style={{ color: '#ef4444', fontWeight: 600 }}>OVERLOOKED</span>
        <div style={{ width: 180, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e)' }} />
        <span style={{ color: '#22c55e', fontWeight: 600 }}>HIGH ATTENTION</span>
        <span style={{ color: '#64748b', marginLeft: 8 }}>&middot;</span>
        <span style={{ color: '#64748b' }}>Papers per death (log scale)</span>
      </div>
    );
  }

  const allActive = activeCats.size === CATS.length;

  return (
    <div style={{
      position: 'absolute', top: 50, left: 0, right: 0, zIndex: 40,
      padding: '0 20px', display: 'flex', flexWrap: 'wrap', gap: 5,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, pointerEvents: 'none',
      transform: 'translateY(-120px)', animation: uiRevealed ? 'slideDown 0.5s ease 0.15s forwards' : 'none',
      ...dim,
    }}>
      <button
        onClick={() => toggleCat('ALL')}
        style={{
          pointerEvents: 'auto', padding: '4px 12px', borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 10,
          background: allActive ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: allActive ? '#e2e8f0' : '#64748b',
        }}
      >ALL</button>
      {CATS.map(cat => {
        const on = activeCats.has(cat);
        return (
          <button
            key={cat}
            onClick={() => toggleCat(cat)}
            style={{
              pointerEvents: 'auto', padding: '4px 12px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4,
              background: on ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: on ? '#e2e8f0' : '#475569', opacity: on ? 1 : 0.5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: CC[cat] }} />
            {CL[cat]}
          </button>
        );
      })}
    </div>
  );
}
