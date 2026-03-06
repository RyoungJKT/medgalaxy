import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import SearchDropdown from './SearchDropdown';

function SizeToggle() {
  const sizeMode = useStore(s => s.sizeMode);
  const setSizeMode = useStore(s => s.setSizeMode);
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef(null);

  const handleClick = (m) => {
    setSizeMode(m);
    setShowTip(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowTip(false), 5000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="relative pointer-events-auto">
      <div className="flex rounded-md overflow-hidden border border-white/[0.08]">
        {['papers', 'mortality'].map(m => (
          <button
            key={m}
            onClick={() => handleClick(m)}
            className={`px-3 py-1.5 text-[11px] border-none cursor-pointer transition-colors
              ${sizeMode === m ? 'bg-white/[0.12] text-slate-200' : 'bg-transparent text-slate-500'}`}
          >
            {m === 'papers' ? 'Papers' : 'Mortality'}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {showTip && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-3 py-2
              backdrop-blur-xl bg-[rgba(10,16,30,0.95)] border border-white/[0.08]
              rounded-md text-[10px] text-slate-400 w-[220px] leading-relaxed text-center whitespace-normal"
          >
            {sizeMode === 'papers'
              ? 'Node size scaled by total publications on PubMed'
              : 'Node size scaled by annual deaths reported by WHO'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BTN = `px-3 py-1.5 rounded-md border border-white/[0.08] cursor-pointer
  bg-transparent text-slate-200 text-[11px] whitespace-nowrap pointer-events-auto
  hover:bg-white/[0.04] hover:border-white/20 transition-all`;

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
  const selectDisease = useStore(s => s.selectDisease);
  const idMap = useStore(s => s.idMap);

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
    <motion.div
      initial={{ y: '-100%' }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, delay: 1.8, ease: 'easeOut' }}
      className={`absolute top-0 left-0 right-0 z-40 flex items-center pointer-events-none
        bg-gradient-to-b from-[rgba(6,8,13,0.9)] to-transparent
        ${mob ? 'px-3 py-2.5 gap-2' : 'px-5 py-3.5 gap-3.5'}`}
    >
      {/* Title */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e] animate-pulse" />
        <span className={`font-semibold ${mob ? 'text-[13px]' : 'text-[15px]'} text-slate-200`}>
          MedGalaxy
        </span>
        {!mob && (
          <>
            <span className="text-slate-400 text-[11px]">
              3D visualization of global disease research
            </span>
            <span className="text-slate-400 text-[11px]">&middot;</span>
            <span className="text-slate-400 text-[11px]">
              {diseases.length} diseases &middot; {displayEdges.length} connections
            </span>
          </>
        )}
      </div>

      <div className="flex-1" />

      {mob ? (
        <>
          {/* Mobile search bar */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 px-3 py-2 bg-[rgba(6,8,13,0.95)] pointer-events-auto"
              >
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search diseases..."
                  autoFocus
                  onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                  className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1.5
                    text-slate-200 text-xs w-full outline-none"
                />
                <SearchDropdown onSelect={handleSearchSelect} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile search button */}
          <button
            onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}
            className="pointer-events-auto bg-transparent border border-white/[0.08] rounded-md
              px-2 py-1 text-slate-400 text-sm cursor-pointer"
          >
            &#x1F50D;
          </button>

          {/* Mobile menu */}
          <div ref={menuRef} className="relative pointer-events-auto">
            <button
              onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}
              className="bg-transparent border border-white/[0.08] rounded-md px-3.5 py-2
                text-slate-200 text-base cursor-pointer font-medium"
            >
              Menu
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 backdrop-blur-md
                    bg-[rgba(10,16,30,0.96)] border border-white/[0.08] rounded-md
                    p-2 min-w-[160px] flex flex-col gap-1.5"
                >
                  <div className="text-slate-500 text-[9px] px-1">Size by</div>
                  <div className="flex rounded-md overflow-hidden border border-white/[0.08]">
                    {['papers', 'mortality'].map(m => (
                      <button
                        key={m}
                        onClick={() => { setSizeMode(m); setMenuOpen(false); }}
                        className={`flex-1 px-2.5 py-1.5 text-[10px] border-none cursor-pointer
                          ${sizeMode === m ? 'bg-white/[0.12] text-slate-200' : 'bg-transparent text-slate-500'}`}
                      >
                        {m === 'papers' ? 'Papers' : 'Mortality'}
                      </button>
                    ))}
                  </div>
                  <div className="text-slate-500 text-[9px] px-1 pt-1">Analysis</div>
                  {[
                    { label: 'Research Gap', action: () => setActiveMode('explode') },
                    { label: 'Connections', action: () => setActiveMode('connections') },
                    { label: 'Trends', action: () => setActiveMode('velocity') },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={() => { item.action(); setMenuOpen(false); }}
                      className="px-2.5 py-1.5 text-[10px] border border-white/[0.08]
                        rounded-md cursor-pointer bg-transparent text-slate-200 w-full text-left
                        hover:bg-white/[0.04] transition-colors"
                    >
                      {item.label}
                    </button>
                  ))}
                  <button
                    onClick={() => { setNeglectMode(!neglectMode); setMenuOpen(false); }}
                    className={`px-2.5 py-1.5 text-[10px] border border-white/[0.08]
                      rounded-md cursor-pointer w-full text-left transition-colors
                      ${neglectMode ? 'bg-white/[0.12] text-red-500' : 'bg-transparent text-slate-200 hover:bg-white/[0.04]'}`}
                  >
                    {neglectMode ? '\u2715 Attention Map' : 'Attention Map'}
                  </button>
                  <button
                    onClick={() => { setSpotlightActive(!spotlightActive); setMenuOpen(false); }}
                    className={`px-2.5 py-1.5 text-[10px] border border-white/[0.08]
                      rounded-md cursor-pointer w-full text-left transition-colors
                      ${spotlightActive ? 'bg-white/[0.12] text-amber-500' : 'bg-transparent text-slate-200 hover:bg-white/[0.04]'}`}
                  >
                    {spotlightActive ? '\u2715 Spotlight' : 'Spotlight'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <>
          {/* Desktop: Attention Map */}
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setNeglectMode(!neglectMode)}
              className={`${BTN} ${neglectMode ? 'bg-white/[0.12] !text-red-500' : ''}`}
            >
              {neglectMode ? '\u2715 Attention Map' : 'Attention Map'}
            </button>
            <AnimatePresence>
              {neglectMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-full left-0 mt-1.5 px-3 py-2
                    backdrop-blur-xl bg-[rgba(10,16,30,0.95)] border border-white/[0.08]
                    rounded-md text-[10px] text-slate-400 w-[260px] leading-relaxed"
                >
                  Nodes colored by research papers per death.{' '}
                  <span className="text-green-500">Green</span> = high attention.{' '}
                  <span className="text-amber-500">Yellow</span> = moderate.{' '}
                  <span className="text-red-500">Red</span> = overlooked.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop: Size Toggle */}
          <SizeToggle />

          {/* Desktop: Analysis buttons */}
          <button onClick={() => setActiveMode('explode')} className={BTN}>
            Research Gap
          </button>
          <button onClick={() => setActiveMode('connections')} className={BTN}>
            Connections
          </button>
          <button onClick={() => setActiveMode('velocity')} className={BTN}>
            Trends
          </button>
          <button
            onClick={() => setSpotlightActive(!spotlightActive)}
            className={`${BTN} ${spotlightActive ? 'bg-white/[0.12] !text-amber-500' : ''}`}
          >
            {spotlightActive ? '\u2715 Spotlight' : 'Spotlight'}
          </button>

          {/* Desktop: Search */}
          <div className="relative pointer-events-auto">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search diseases..."
              className="bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1.5
                text-slate-200 text-xs w-[200px] outline-none focus:border-white/20 transition-colors"
            />
            <SearchDropdown onSelect={handleSearchSelect} />
          </div>
        </>
      )}
    </motion.div>
  );
}
