import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';

function fR(v) {
  return v >= 10 ? String(Math.round(v)) : v >= 1 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(2) : v.toFixed(3);
}

export default function ExplodeOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const diseases = useStore(s => s.diseases);

  const ppdData = useMemo(() => {
    const withRatio = diseases
      .filter(d => d.mortality > 0)
      .map(d => ({ ...d, ppd: d.papers / d.mortality }));
    const sorted = [...withRatio].sort((a, b) => b.ppd - a.ppd);
    return { highest: sorted.slice(0, 10), lowest: sorted.slice(-10).reverse() };
  }, [diseases]);

  const show = activeMode === 'explode';
  const mob = isMob();

  if (!show) return null;

  const maxH = ppdData.highest[0]?.ppd || 1;
  const minPPD = ppdData.lowest[0]?.ppd || 0.001;

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
        {/* Close */}
        <button
          onClick={() => setActiveMode(null)}
          className="absolute top-3 right-3.5 bg-white/[0.06] border border-white/10
            rounded-md text-slate-400 cursor-pointer text-sm leading-none px-2 py-1
            hover:bg-white/[0.1] transition-colors"
        >
          &#x2715; Close
        </button>

        <div className={`font-semibold text-slate-200 mb-1 ${mob ? 'text-sm' : 'text-lg'}`}>
          Research Intensity
        </div>
        <div className={`text-slate-500 ${mob ? 'text-[9px] mb-4' : 'text-xs mb-6'}`}>
          Papers published per reported death — revealing where research attention doesn&apos;t match disease burden
        </div>

        <div className={`flex ${mob ? 'flex-col gap-5' : 'flex-row gap-9'}`}>
          {/* Over-researched */}
          <div className="flex-1">
            <div className="text-[10px] text-green-500 font-semibold mb-1 uppercase tracking-wider">
              Most Over-Researched
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Highest papers per death</div>
            {ppdData.highest.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="mb-2"
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-slate-300 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>{d.label}</span>
                  <span className={`text-green-500 font-semibold ml-2 whitespace-nowrap ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    {fR(d.ppd)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((d.ppd / maxH) * 100, 2)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="h-full rounded-sm bg-gradient-to-r from-green-500 to-emerald-600"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Divider */}
          {!mob && <div className="w-px bg-white/[0.06]" />}

          {/* Under-researched */}
          <div className="flex-1">
            <div className="text-[10px] text-red-500 font-semibold mb-1 uppercase tracking-wider">
              Most Under-Researched
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Fewest papers per death</div>
            {ppdData.lowest.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="mb-2"
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-slate-300 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>{d.label}</span>
                  <span className={`text-red-500 font-semibold ml-2 whitespace-nowrap ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    {fR(d.ppd)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((minPPD / d.ppd) * 100, 2)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="h-full rounded-sm bg-gradient-to-r from-red-500 to-red-600"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
