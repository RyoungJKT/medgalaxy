import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';

function fG(v) { return v >= 10 ? String(Math.round(v)) + '\u00d7' : v >= 1 ? v.toFixed(1) + '\u00d7' : v.toFixed(2) + '\u00d7'; }
function fP(v) { return v >= 0 ? '+' + Math.round(v) + '%' : Math.round(v) + '%'; }

export default function VelocityOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const diseases = useStore(s => s.diseases);

  const velocityData = useMemo(() => {
    const items = diseases
      .filter(d => d.yearlyPapers && d.yearlyPapers.length >= 6)
      .map(d => {
        const yp = d.yearlyPapers;
        const early = yp.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const late = yp.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const growth = early > 0 ? late / early : 0;
        const pctChange = early > 0 ? ((late / early) - 1) * 100 : 0;
        return { ...d, growth, pctChange, early, late };
      });
    const nonCovid = items.filter(d => d.id !== 'covid-19');
    const rising = [...nonCovid].sort((a, b) => b.growth - a.growth).slice(0, 10);
    const declining = [...items].filter(d => d.pctChange < 0).sort((a, b) => a.growth - b.growth).slice(0, 10);
    return { rising, declining };
  }, [diseases]);

  const show = activeMode === 'velocity';
  const mob = isMob();

  if (!show) return null;

  const maxG = velocityData.rising[0]?.growth || 1;
  const maxD = Math.abs(velocityData.declining[0]?.growth) || 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="absolute inset-0 z-[55] flex items-center justify-center
        bg-black/50 backdrop-blur-sm pointer-events-auto"
    >
      <div
        className={`bg-[rgba(10,16,30,0.97)] border border-white/10 rounded-xl relative
          overflow-y-auto ${mob ? 'p-4 max-w-[95vw]' : 'p-7 max-w-[820px]'} w-full max-h-[85vh]`}
      >
        <button
          onClick={() => setActiveMode(null)}
          className="absolute top-3 right-3.5 bg-white/[0.06] border border-white/10
            rounded-md text-slate-400 cursor-pointer text-sm leading-none px-2 py-1
            hover:bg-white/[0.1] transition-colors"
        >
          &#x2715; Close
        </button>

        <div className={`font-semibold text-slate-200 mb-1 ${mob ? 'text-sm' : 'text-lg'}`}>
          Research Trends
        </div>
        <div className={`text-slate-500 ${mob ? 'text-[9px] mb-4' : 'text-xs mb-6'}`}>
          Publication growth rate over the last decade — which diseases are surging and which are fading
        </div>

        <div className={`flex ${mob ? 'flex-col gap-5' : 'flex-row gap-9'}`}>
          {/* Rising */}
          <div className="flex-1">
            <div className="text-[10px] text-amber-500 font-semibold mb-1 uppercase tracking-wider">
              Fastest Rising
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Highest publication growth (excl. COVID-19)</div>
            {velocityData.rising.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="mb-2"
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-slate-300 flex items-center gap-1.5 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CC[d.category] }} />
                    {d.label}
                  </span>
                  <span className={`text-amber-500 font-semibold ml-2 whitespace-nowrap ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    {fG(d.growth)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((d.growth / maxG) * 100, 2)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="h-full rounded-sm bg-gradient-to-r from-amber-500 to-amber-600"
                  />
                </div>
                <div className="text-[8px] text-slate-600 mt-0.5">
                  {fP(d.pctChange)} &middot; avg {fmt(Math.round(d.early))}/yr &rarr; {fmt(Math.round(d.late))}/yr
                </div>
              </motion.div>
            ))}
          </div>

          {!mob && <div className="w-px bg-white/[0.06]" />}

          {/* Declining */}
          <div className="flex-1">
            <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">
              Fading Research
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Declining publication trends</div>
            {velocityData.declining.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="mb-2"
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-slate-300 flex items-center gap-1.5 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CC[d.category] }} />
                    {d.label}
                  </span>
                  <span className={`text-slate-500 font-semibold ml-2 whitespace-nowrap ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    {fP(d.pctChange)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((Math.abs(d.growth) / maxD) * 100, 2)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="h-full rounded-sm bg-gradient-to-r from-slate-500 to-slate-600"
                  />
                </div>
                <div className="text-[8px] text-slate-600 mt-0.5">
                  avg {fmt(Math.round(d.early))}/yr &rarr; {fmt(Math.round(d.late))}/yr &middot;{' '}
                  {d.mortality > 0 ? fmt(d.mortality) + ' deaths/yr' : '\u2014'}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
