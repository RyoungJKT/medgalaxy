import React, { useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC, CL } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';
import Sparkline from './Sparkline';

function StatBox({ label, value, suffix, valueColor }) {
  return (
    <div className="bg-white/[0.03] rounded-md p-2 border border-white/[0.04]">
      <div className="text-slate-400 text-[9px] mb-0.5">{label}</div>
      <div className="text-sm font-semibold" style={{ color: valueColor || '#e2e8f0' }}>
        {value} {suffix && <span className="text-[10px] font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const selectedNode = useStore(s => s.selectedNode);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const connCounts = useStore(s => s.connCounts);
  const deselect = useStore(s => s.deselect);
  const selectDisease = useStore(s => s.selectDisease);

  const mob = isMob();
  const panelRef = useRef(null);
  const [panelH, setPanelH] = useState(60);
  const swipeRef = useRef({ startY: 0, curY: 0, swiping: false, startH: 60 });

  const onClose = useCallback(() => {
    deselect();
  }, [deselect]);

  const onSwipeStart = useCallback((e) => {
    if (!mob) return;
    const touch = e.touches[0];
    swipeRef.current = { startY: touch.clientY, curY: touch.clientY, swiping: true, startH: panelH };
    if (panelRef.current) panelRef.current.style.transition = 'none';
  }, [mob, panelH]);

  const onSwipeMove = useCallback((e) => {
    if (!mob || !swipeRef.current.swiping) return;
    const touch = e.touches[0];
    swipeRef.current.curY = touch.clientY;
    const dy = touch.clientY - swipeRef.current.startY;
    const vhPx = window.innerHeight / 100;
    const dh = dy / vhPx;
    const newH = Math.max(10, Math.min(85, swipeRef.current.startH - dh));
    if (panelRef.current) {
      panelRef.current.style.height = newH + 'vh';
      panelRef.current.style.maxHeight = newH + 'vh';
    }
  }, [mob]);

  const onSwipeEnd = useCallback(() => {
    if (!mob || !swipeRef.current.swiping) return;
    swipeRef.current.swiping = false;
    const dy = swipeRef.current.curY - swipeRef.current.startY;
    const vhPx = window.innerHeight / 100;
    const newH = Math.max(10, Math.min(85, swipeRef.current.startH - (dy / vhPx)));
    if (panelRef.current) {
      panelRef.current.style.transition = 'height 0.25s ease, max-height 0.25s ease, opacity 0.25s ease';
    }
    if (newH <= 12) {
      if (panelRef.current) {
        panelRef.current.style.height = '0vh';
        panelRef.current.style.maxHeight = '0vh';
        panelRef.current.style.opacity = '0';
      }
      setTimeout(onClose, 250);
    } else {
      setPanelH(Math.round(newH));
    }
  }, [mob, onClose]);

  if (!selectedNode) return null;

  const disease = selectedNode.disease;
  const idx = selectedNode.index;
  const c = CC[disease.category];
  const cc = connCounts.get(idx);
  const t = disease.trend;
  const ar = t > 0 ? '\u2191' : t < 0 ? '\u2193' : '\u2192';
  const tc = t > 0 ? '#22c55e' : t < 0 ? '#ef4444' : '#94a3b8';
  const gc = { high: '#ef4444', medium: '#eab308', low: '#22c55e' };
  const ppd = disease.mortality > 0 ? disease.papers / disease.mortality : null;
  const ppdStr = ppd === null ? 'N/A' : ppd >= 10 ? String(Math.round(ppd)) : ppd >= 1 ? ppd.toFixed(1) : ppd >= 0.01 ? ppd.toFixed(2) : ppd.toFixed(3);

  const conns = displayEdges
    .filter(e => e.si === idx || e.ti === idx)
    .map(e => {
      const oi = e.si === idx ? e.ti : e.si;
      return { d: diseases[oi], sp: e.sharedPapers, t: e.trend, oi };
    })
    .sort((a, b) => b.sp - a.sp);

  return (
    <AnimatePresence>
      {mob ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[49] bg-black/40 pointer-events-auto"
            onClick={onClose}
          />
          {/* Bottom sheet */}
          <motion.div
            key="sidebar-mobile"
            ref={panelRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-50 pointer-events-auto
              backdrop-blur-md bg-[rgba(10,16,30,0.96)]
              border-t border-white/[0.08] rounded-t-2xl
              text-slate-200 text-[11px] overflow-y-auto overflow-x-hidden"
            style={{ height: panelH + 'vh', maxHeight: panelH + 'vh' }}
          >
            {/* Swipe handle */}
            <div
              onTouchStart={onSwipeStart}
              onTouchMove={onSwipeMove}
              onTouchEnd={onSwipeEnd}
              className="flex justify-center py-4 cursor-grab touch-none min-h-[48px]"
            >
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
            <SidebarContent
              disease={disease} c={c} cc={cc} t={t} ar={ar} tc={tc} gc={gc}
              ppdStr={ppdStr} conns={conns} onClose={onClose} onSelect={selectDisease}
            />
          </motion.div>
        </>
      ) : (
        <motion.div
          key="sidebar-desktop"
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute top-[75px] right-0 w-80 z-50 pointer-events-auto
            backdrop-blur-md bg-[rgba(10,16,30,0.94)]
            border-l border-white/[0.06]
            text-slate-200 text-[11px] overflow-y-auto overflow-x-hidden"
          style={{ height: 'calc(100% - 75px)' }}
        >
          <SidebarContent
            disease={disease} c={c} cc={cc} t={t} ar={ar} tc={tc} gc={gc}
            ppdStr={ppdStr} conns={conns} onClose={onClose} onSelect={selectDisease}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SidebarContent({ disease, c, cc, t, ar, tc, gc, ppdStr, conns, onClose, onSelect }) {
  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-white/[0.06]">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[15px] font-semibold mb-1">{disease.label}</div>
            <span
              className="text-[9px] px-2 py-0.5 rounded"
              style={{ background: c + '22', color: c }}
            >
              {CL[disease.category]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-slate-500 cursor-pointer text-lg leading-none px-1
              hover:text-slate-300 transition-colors"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-2.5 text-slate-400 leading-relaxed">
        {disease.description}
      </div>

      {/* Stats grid */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2">
        <StatBox
          label="Publications"
          value={fmt(disease.papers)}
          suffix={<span style={{ color: tc }}>{ar}{Math.abs(t)}%</span>}
        />
        <StatBox label="Connections" value={cc} />
        <StatBox
          label="WHO Deaths/yr"
          value={disease.mortality > 0 ? fmt(disease.mortality) : 'N/A'}
        />
        <StatBox
          label="Funding Gap"
          value={disease.fundingGap.toUpperCase()}
          valueColor={gc[disease.fundingGap]}
        />
        <StatBox label="Papers/Death" value={ppdStr} />
      </div>

      {/* Sparkline */}
      <div className="px-4 pb-3">
        <div className="text-slate-400 text-[9px] mb-1">Publication Trend (2014-2024)</div>
        <Sparkline data={disease.yearlyPapers} color={c} />
      </div>

      {/* PubMed link */}
      <div className="px-4 pb-3">
        <a
          href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(disease.label)}&sort=date`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-2 rounded-md text-[11px] font-medium no-underline
            hover:brightness-110 transition-all"
          style={{ background: c + '22', color: c }}
        >
          View on PubMed &rarr;
        </a>
      </div>

      {/* Connections */}
      <div className="px-4 pb-4">
        <div className="text-slate-400 text-[9px] mb-0.5">Connections ({conns.length})</div>
        <div className="text-slate-500 text-[8px] mb-1.5">
          Diseases that appear together in published medical research, suggesting shared biology,
          risk factors, or clinical overlap
        </div>
        <div className="max-h-60 overflow-y-auto">
          {conns.map((cn, i) => {
            const cc2 = CC[cn.d.category];
            const ta = cn.t === 'up' ? '\u2191' : cn.t === 'down' ? '\u2193' : '\u2192';
            return (
              <div
                key={i}
                onClick={() => onSelect(cn.oi)}
                className="flex items-center gap-2 py-1 px-1.5 cursor-pointer rounded
                  border-b border-white/[0.03] hover:bg-white/[0.04] transition-colors"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: cc2 }}
                />
                <span className="flex-1 text-slate-300">{cn.d.label}</span>
                <span className="text-slate-400 text-[10px]">{fmt(cn.sp)}</span>
                <span
                  className="text-[10px]"
                  style={{
                    color: cn.t === 'up' ? '#22c55e' : cn.t === 'down' ? '#ef4444' : '#64748b',
                  }}
                >
                  {ta}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
