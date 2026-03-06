import React from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store';
import { CC, CL, CATS } from '../../utils/constants';
import { isMob } from '../../utils/helpers';

export default function FilterBar() {
  const activeCats = useStore(s => s.activeCats);
  const toggleCat = useStore(s => s.toggleCat);
  const neglectMode = useStore(s => s.neglectMode);

  if (isMob()) return null;

  if (neglectMode) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute top-[50px] left-0 right-0 z-40 px-5 flex items-center gap-2.5
          text-[10px] pointer-events-none"
      >
        <span className="text-red-500 font-semibold">OVERLOOKED</span>
        <div className="w-[180px] h-2 rounded bg-gradient-to-r from-red-500 via-amber-500 to-green-500" />
        <span className="text-green-500 font-semibold">HIGH ATTENTION</span>
        <span className="text-slate-500 ml-2">&middot;</span>
        <span className="text-slate-500">Papers per death (log scale)</span>
      </motion.div>
    );
  }

  const allActive = activeCats.size === CATS.length;

  return (
    <motion.div
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 1.95, ease: 'easeOut' }}
      className="absolute top-[50px] left-0 right-0 z-40 px-5 flex flex-wrap gap-1.5
        text-[11px] pointer-events-none"
    >
      <button
        onClick={() => toggleCat('ALL')}
        className={`pointer-events-auto px-3 py-1 rounded border border-white/[0.08]
          cursor-pointer text-[10px] transition-colors
          ${allActive ? 'bg-white/[0.12] text-slate-200' : 'bg-transparent text-slate-500'}`}
      >
        ALL
      </button>
      {CATS.map(cat => {
        const on = activeCats.has(cat);
        return (
          <button
            key={cat}
            onClick={() => toggleCat(cat)}
            className={`pointer-events-auto px-3 py-1 rounded border border-white/[0.08]
              cursor-pointer text-[10px] flex items-center gap-1 transition-colors
              ${on ? 'bg-white/[0.08] text-slate-200' : 'bg-transparent text-slate-500 opacity-50'}`}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: CC[cat] }} />
            {CL[cat]}
          </button>
        );
      })}
    </motion.div>
  );
}
