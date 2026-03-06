import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import SearchDropdown from './SearchDropdown';

function SizeToggle() {
  const sizeMode = useStore(s => s.sizeMode);
  const setSizeMode = useStore(s => s.setSizeMode);
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef(null);
  const sizeToggleRef = useRef(null);

  const handleClick = (m) => {
    setSizeMode(m);
    setShowTip(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowTip(false), 5000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div style={{ position: 'relative', pointerEvents: 'auto' }}>
      <div ref={sizeToggleRef} style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        {'papers,mortality'.split(',').map(m => (
          <button
            key={m}
            onClick={() => handleClick(m)}
            style={{
              padding: '6px 12px', fontSize: 11, fontFamily: 'inherit', border: 'none',
              cursor: 'pointer', background: sizeMode === m ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: sizeMode === m ? '#e2e8f0' : '#64748b',
            }}
          >
            {m === 'papers' ? 'Papers' : 'Mortality'}
          </button>
        ))}
      </div>
      {showTip && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 6, padding: '8px 12px', background: 'rgba(10,16,30,0.95)',
          backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6, fontSize: 10, color: '#94a3b8', width: 220, lineHeight: 1.5,
          opacity: 0, animation: 'fadeIn 0.4s ease forwards', textAlign: 'center', whiteSpace: 'normal',
        }}>
          {sizeMode === 'papers'
            ? 'Node size scaled by total publications on PubMed'
            : 'Node size scaled by annual deaths reported by WHO'}
        </div>
      )}
    </div>
  );
}

function ShaderToggle() {
  const shaderMode = useStore(s => s.shaderMode);
  const setShaderMode = useStore(s => s.setShaderMode);
  return (
    <div style={{ position: 'relative', pointerEvents: 'auto' }}>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        {['plasma', 'pulse'].map(m => (
          <button
            key={m}
            onClick={() => setShaderMode(m)}
            style={{
              padding: '6px 12px', fontSize: 11, fontFamily: 'inherit', border: 'none',
              cursor: 'pointer', background: shaderMode === m ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: shaderMode === m ? '#e2e8f0' : '#64748b',
            }}
          >
            {m === 'plasma' ? 'Plasma' : 'Pulse'}
          </button>
        ))}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '6px 12px', fontSize: 11, fontFamily: 'inherit',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
  cursor: 'pointer', background: 'transparent', color: '#e2e8f0',
  pointerEvents: 'auto', whiteSpace: 'nowrap',
};

export default function Header() {
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const searchQuery = useStore(s => s.searchQuery);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const neglectMode = useStore(s => s.neglectMode);
  const setNeglectMode = useStore(s => s.setNeglectMode);
  const spotlightActive = useStore(s => s.spotlightActive);
  const setSpotlightActive = useStore(s => s.setSpotlightActive);
  const setActiveMode = useStore(s => s.setActiveMode);
  const sizeMode = useStore(s => s.sizeMode);
  const setSizeMode = useStore(s => s.setSizeMode);
  const shaderMode = useStore(s => s.shaderMode);
  const setShaderMode = useStore(s => s.setShaderMode);
  const selectDisease = useStore(s => s.selectDisease);
  const idMap = useStore(s => s.idMap);
  const introStarted = useStore(s => s.introStarted);

  const mob = isMob();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!mob || !menuOpen) return;
    function onTouch(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('touchstart', onTouch, true);
    return () => document.removeEventListener('touchstart', onTouch, true);
  }, [mob, menuOpen]);

  const handleSearchSelect = (d) => {
    const idx = idMap[d.id];
    if (idx !== undefined) selectDisease(idx);
    setSearchQuery('');
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
      padding: mob ? '10px 12px' : '14px 20px', display: 'flex', alignItems: 'center',
      gap: mob ? 8 : 14, fontFamily: 'IBM Plex Mono,monospace', fontSize: 12,
      color: '#e2e8f0', background: 'linear-gradient(180deg,rgba(6,8,13,0.9) 0%,rgba(6,8,13,0) 100%)',
      pointerEvents: 'none', transform: 'translateY(-100%)', animation: introStarted ? 'slideDown 0.6s ease 3.0s forwards' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontWeight: 600, fontSize: mob ? 13 : 15 }}>MedGalaxy</span>
        {!mob && (
          <>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>3D visualization of global disease research</span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>&middot;</span>
            <span style={{ color: '#94a3b8', fontSize: 11 }}>{diseases.length} diseases &middot; {displayEdges.length} connections</span>
          </>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {mob ? (
        <>
          {searchOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, padding: '8px 12px', background: 'rgba(6,8,13,0.95)', pointerEvents: 'auto' }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search diseases..."
                autoFocus
                onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', width: '100%', outline: 'none' }}
              />
              <SearchDropdown onSelect={handleSearchSelect} />
            </div>
          )}
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            style={{ pointerEvents: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 8px', color: '#94a3b8', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            &#x1F50D;
          </button>
          <div ref={menuRef} style={{ position: 'relative', pointerEvents: 'auto' }}>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 14px', color: '#e2e8f0', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Menu
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'rgba(10,16,30,0.96)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                padding: 8, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ color: '#64748b', fontSize: 9, padding: '0 4px' }}>Size by</div>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {['papers', 'mortality'].map(m => (
                    <button key={m} onClick={() => { setSizeMode(m); setMenuOpen(false); }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: 'none', cursor: 'pointer', background: sizeMode === m ? 'rgba(255,255,255,0.12)' : 'transparent', color: sizeMode === m ? '#e2e8f0' : '#64748b' }}
                    >{m === 'papers' ? 'Papers' : 'Mortality'}</button>
                  ))}
                </div>
                <div style={{ color: '#64748b', fontSize: 9, padding: '4px 4px 0' }}>Shader</div>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {['plasma', 'pulse'].map(m => (
                    <button key={m} onClick={() => { setShaderMode(m); setMenuOpen(false); }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: 'none', cursor: 'pointer', background: shaderMode === m ? 'rgba(255,255,255,0.12)' : 'transparent', color: shaderMode === m ? '#e2e8f0' : '#64748b' }}
                    >{m === 'plasma' ? 'Plasma' : 'Pulse'}</button>
                  ))}
                </div>
                <div style={{ color: '#64748b', fontSize: 9, padding: '4px 4px 0' }}>Analysis</div>
                <button onClick={() => { setActiveMode('explode'); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Research Gap</button>
                <button onClick={() => { setActiveMode('connections'); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Connections</button>
                <button onClick={() => { setActiveMode('velocity'); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Trends</button>
                <button onClick={() => { setNeglectMode(!neglectMode); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: neglectMode ? 'rgba(255,255,255,0.12)' : 'transparent', color: neglectMode ? '#ef4444' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{neglectMode ? '✕ Attention Map' : 'Attention Map'}</button>
                <button onClick={() => { setSpotlightActive(!spotlightActive); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: spotlightActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: spotlightActive ? '#f59e0b' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{spotlightActive ? '✕ Spotlight' : 'Spotlight'}</button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <button onClick={() => setNeglectMode(!neglectMode)}
              style={{ ...btnStyle, background: neglectMode ? 'rgba(255,255,255,0.12)' : 'transparent', color: neglectMode ? '#ef4444' : '#e2e8f0' }}
            >{neglectMode ? '✕ Attention Map' : 'Attention Map'}</button>
            {neglectMode && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6,
                padding: '8px 12px', background: 'rgba(10,16,30,0.95)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 10,
                color: '#94a3b8', width: 260, lineHeight: 1.5, opacity: 0, animation: 'fadeIn 0.4s ease forwards',
              }}>
                Nodes colored by research papers per death. <span style={{ color: '#22c55e' }}>Green</span> = high attention. <span style={{ color: '#f59e0b' }}>Yellow</span> = moderate. <span style={{ color: '#ef4444' }}>Red</span> = overlooked.
              </div>
            )}
          </div>
          <SizeToggle />
          <ShaderToggle />
          <button onClick={() => setActiveMode('explode')} style={btnStyle}>Research Gap</button>
          <button onClick={() => setActiveMode('connections')} style={btnStyle}>Connections</button>
          <button onClick={() => setActiveMode('velocity')} style={btnStyle}>Trends</button>
          <button onClick={() => setSpotlightActive(!spotlightActive)}
            style={{ ...btnStyle, background: spotlightActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: spotlightActive ? '#f59e0b' : '#e2e8f0' }}
          >{spotlightActive ? '✕ Spotlight' : 'Spotlight'}</button>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search diseases..."
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 12px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', width: 200, outline: 'none' }}
            />
            <SearchDropdown onSelect={handleSearchSelect} />
          </div>
        </>
      )}
    </div>
  );
}
