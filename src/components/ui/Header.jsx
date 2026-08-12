import React, { useState, useRef, useEffect } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import SearchDropdown from './SearchDropdown';
import audioEngine from '../../audio/engine';
import { TM_EXIT, exitDelay } from '../../utils/motion';

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
            : 'Node size scaled by annual deaths, per-disease sources shown in each sidebar'}
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

// The exit's micro-line: 9px #64748b under the Time Machine button, up 2.6 s
// then a 200 ms fade (ADDENDUM 1 section 1, exit table t = 1.75).
function ExitMicroLine({ delay, mob }) {
  return (
    <div
      style={{
        position: 'absolute', top: '100%',
        // Centred under the button on desktop; on mobile the button it hangs
        // from is the Menu, hard against the right edge, so a centred line runs
        // off the viewport (measured: "the decades live he|"). Right-anchored
        // there, it extends inward instead.
        ...(mob
          ? { right: 0, left: 'auto', transform: 'none' }
          : { left: '50%', transform: 'translateX(-50%)' }),
        // Cleared past the filter bar, which sits directly under the control
        // row and paints over anything the header tries to put in that gap.
        // Still unmistakably the button's own line: same column, nothing else
        // in the band, and it arrives on the same frame as the pulse.
        marginTop: 34, fontSize: 9, color: '#64748b', whiteSpace: 'nowrap',
        background: 'rgba(6,8,13,0.92)', padding: '2px 6px', borderRadius: 4,
        zIndex: 60, pointerEvents: 'none', opacity: 0,
        animation: `tmHdrLine ${TM_EXIT.header.line + TM_EXIT.header.lineOut}ms linear ${delay}ms both`,
      }}
    >
      the decades live here
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
  const soundOn = useStore(s => s.soundOn);
  const setSoundOn = useStore(s => s.setSoundOn);
  const setActiveMode = useStore(s => s.setActiveMode);
  const sizeMode = useStore(s => s.sizeMode);
  const setSizeMode = useStore(s => s.setSizeMode);
  const shaderMode = useStore(s => s.shaderMode);
  const setShaderMode = useStore(s => s.setShaderMode);
  const selectDisease = useStore(s => s.selectDisease);
  const idMap = useStore(s => s.idMap);
  const uiRevealed = useStore(s => s.uiRevealed);
  const tmPhase = useStore(s => s.tmPhase);
  const startTimeMachine = useStore(s => s.startTimeMachine);
  const stopTimeMachine = useStore(s => s.stopTimeMachine);
  const setMethodologyOpen = useStore(s => s.setMethodologyOpen);
  const tmTourSeen = useStore(s => s.tmTourSeen);
  const tmActive = tmPhase !== 'idle';
  // First press owes the viewer the story (review gate F1c): if no narrated
  // tour has run yet in this session — the film's auto-tour preempted, the
  // hint chip never taken — this button is the only way the decade story can
  // still be delivered, so it starts the tour rather than a bare scrubber.
  // Once any tour has been seen, the button is the plain instrument it was.
  const toggleTimeMachine = () => { if (tmActive) stopTimeMachine(); else startTimeMachine(!tmTourSeen); };

  // First activation is the user gesture that primes the AudioContext
  // (autoplay-safe); init() is idempotent so every toggle just calls it.
  const toggleSound = () => {
    const next = !soundOn;
    audioEngine.init();
    audioEngine.setEnabled(next);
    setSoundOn(next);
  };

  // ── The exit's header channel (ADDENDUM 1 section 1, t = 1.75) ──
  // One-shot Time Machine button pulse, 1.4 s: two cycles of scale 1.000 to
  // 1.060 and border opacity 0.35 to 0.90. Under it a 9px micro-line, "the
  // decades live here", up 2.6 s then a 200 ms fade. This is the whole of what
  // tells a viewer, on the home screen the film just landed them on, where the
  // instrument they watched went. Reduced motion gets a static ring instead.
  const tmExitAt = useStore(s => s.tmExitAt);
  const tmExitMode = useStore(s => s.tmExitMode);
  const [exitCue, setExitCue] = useState(0);
  useEffect(() => {
    if (!tmExitAt || tmExitMode === 'fast') { setExitCue(0); return undefined; }
    setExitCue(tmExitAt);
    const life = exitDelay(tmExitAt, TM_EXIT.header.at) + TM_EXIT.header.line + TM_EXIT.header.lineOut;
    const timer = setTimeout(() => setExitCue(0), life);
    return () => clearTimeout(timer);
  }, [tmExitAt, tmExitMode]);
  const cueDelay = exitCue ? exitDelay(exitCue, TM_EXIT.header.at) : 0;
  const cueReduced = tmExitMode === 'reduced';
  const pulseStyle = !exitCue ? null : cueReduced
    // No pulse under reduced motion: a static ring, held for the same 2.6 s.
    // `forwards`, never `both`: a backwards fill would apply the pulse's 0%
    // keyframe through the whole 1.75 s delay, lighting the button up before
    // its moment.
    ? { animation: `tmBtnRing ${TM_EXIT.header.line}ms step-end ${cueDelay}ms forwards` }
    : { animation: `tmBtnPulse ${TM_EXIT.header.dur}ms ease ${cueDelay}ms forwards` };

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
      pointerEvents: 'none', transform: 'translateY(-100%)', animation: uiRevealed ? 'slideDown 0.6s ease forwards' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontWeight: 600, fontSize: mob ? 13 : 15 }}>MedGalaxy</span>
        {!mob && (
          <>
            {/* The tagline is the first thing to go as the row tightens: below
                1500px it would otherwise push the controls into a second line,
                which lands on top of the filter bar. The counts follow at
                1360px, and the wordmark alone survives anything narrower. */}
            <span className="mg-hdr-tagline" style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>
              3D visualization of global disease research
            </span>
            <span className="mg-hdr-tagline" style={{ color: '#94a3b8', fontSize: 11 }}>&middot;</span>
            <span className="mg-hdr-counts" style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>
              {diseases.length} diseases &middot; {displayEdges.length} connections
            </span>
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
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 14px', color: '#e2e8f0', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, ...pulseStyle }}
            >
              Menu
            </button>
            {/* Mobile collapses the control row into this menu, so the Time
                Machine button the exit means to point at is two taps deep. The
                pulse and its micro-line ride the Menu button instead: the cue
                is "the instrument lives up here", and up here is where it is. */}
            {exitCue > 0 && !menuOpen && <ExitMicroLine delay={cueDelay} mob />}
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
                <button onClick={() => { useStore.getState().setConnFocusIdx(-1); setActiveMode('connections'); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Connections</button>
                <button onClick={() => { setActiveMode('velocity'); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Trends</button>
                <button onClick={() => { toggleTimeMachine(); setMenuOpen(false); }}
                  style={{ padding: '8px 10px', minHeight: 44, fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: tmActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: tmActive ? '#f59e0b' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{tmActive ? '✕ Time Machine' : 'Time Machine'}</button>
                <button onClick={() => { setNeglectMode(!neglectMode); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: neglectMode ? 'rgba(255,255,255,0.12)' : 'transparent', color: neglectMode ? '#ef4444' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{neglectMode ? '✕ Attention Map' : 'Attention Map'}</button>
                <button onClick={() => { setSpotlightActive(!spotlightActive); setMenuOpen(false); }}
                  style={{ padding: '6px 10px', fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: spotlightActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: spotlightActive ? '#f59e0b' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{spotlightActive ? '✕ Spotlight' : 'Spotlight'}</button>
                <button onClick={() => { toggleSound(); setMenuOpen(false); }}
                  style={{ padding: '8px 10px', minHeight: 44, fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: soundOn ? 'rgba(255,255,255,0.12)' : 'transparent', color: soundOn ? '#f59e0b' : '#e2e8f0', width: '100%', textAlign: 'left' }}
                >{soundOn ? '✕ sound' : 'sound'}</button>
                <div style={{ color: '#64748b', fontSize: 9, padding: '4px 4px 0' }}>About</div>
                <button onClick={() => { setMethodologyOpen(true); setMenuOpen(false); }}
                  style={{ padding: '8px 10px', minHeight: 44, fontSize: 10, fontFamily: 'inherit', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: '#e2e8f0', width: '100%', textAlign: 'left' }}
                >Methodology</button>
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
          <button onClick={() => { useStore.getState().setConnFocusIdx(-1); setActiveMode('connections'); }} style={btnStyle}>Connections</button>
          <button onClick={() => setActiveMode('velocity')} style={btnStyle}>Trends</button>
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <button onClick={toggleTimeMachine}
              style={{
                ...btnStyle,
                background: tmActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tmActive ? '#f59e0b' : '#e2e8f0',
                ...pulseStyle,
              }}
            >{tmActive ? '✕ Time Machine' : 'Time Machine'}</button>
            {exitCue > 0 && <ExitMicroLine delay={cueDelay} />}
          </div>
          <button onClick={() => setSpotlightActive(!spotlightActive)}
            style={{ ...btnStyle, background: spotlightActive ? 'rgba(255,255,255,0.12)' : 'transparent', color: spotlightActive ? '#f59e0b' : '#e2e8f0' }}
          >{spotlightActive ? '✕ Spotlight' : 'Spotlight'}</button>
          <button onClick={toggleSound}
            style={{ ...btnStyle, background: soundOn ? 'rgba(255,255,255,0.12)' : 'transparent', color: soundOn ? '#f59e0b' : '#e2e8f0' }}
          >{soundOn ? '✕ sound' : 'sound'}</button>
          <button onClick={() => setMethodologyOpen(true)} aria-label="Methodology" title="Methodology"
            style={{ ...btnStyle, width: 26, height: 26, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: 700, fontSize: 12, flexShrink: 0 }}
          >?</button>
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
      {/* Measured, not guessed: the control row needs 1527px on its own, the
          counts add 212 and the tagline 310. Each is dropped exactly where it
          would otherwise wrap the header into the filter bar underneath. */}
      <style>{`
        @media (max-width: 1839px) { .mg-hdr-tagline { display: none; } }
        @media (max-width: 1539px) { .mg-hdr-counts  { display: none; } }
        /* Two cycles across 1.4 s, ending on the button's own resting border so
           the animation can be removed without a second state change. */
        @keyframes tmBtnPulse {
          0%   { transform: scale(1);    border-color: rgba(255,255,255,0.35); }
          25%  { transform: scale(1.06); border-color: rgba(255,255,255,0.90); }
          50%  { transform: scale(1);    border-color: rgba(255,255,255,0.35); }
          75%  { transform: scale(1.06); border-color: rgba(255,255,255,0.90); }
          100% { transform: scale(1);    border-color: rgba(255,255,255,0.08); }
        }
        @keyframes tmBtnRing {
          0%   { border-color: rgba(255,255,255,0.90); }
          100% { border-color: rgba(255,255,255,0.08); }
        }
        @keyframes tmHdrLine {
          0%      { opacity: 0; }
          7.14%   { opacity: 1; }
          92.86%  { opacity: 1; }
          100%    { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
