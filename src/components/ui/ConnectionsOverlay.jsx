import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC } from '../../utils/constants';
import { fmt, isMob } from '../../utils/helpers';

export default function ConnectionsOverlay() {
  const activeMode = useStore(s => s.activeMode);
  const setActiveMode = useStore(s => s.setActiveMode);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const connFocusSelect = useStore(s => s.connFocusSelect);

  const connData = useMemo(() => {
    const counts = new Map();
    diseases.forEach(d => counts.set(d.id, 0));
    displayEdges.forEach(c => {
      counts.set(diseases[c.si].id, (counts.get(diseases[c.si].id) || 0) + 1);
      counts.set(diseases[c.ti].id, (counts.get(diseases[c.ti].id) || 0) + 1);
    });
    const catMap = new Map();
    diseases.forEach(d => catMap.set(d.id, d.category));
    const labelMap = new Map();
    diseases.forEach(d => labelMap.set(d.id, d.label));

    const hubs = [...counts.entries()]
      .map(([id, count]) => ({ id, label: labelMap.get(id), category: catMap.get(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const reasons = {
      'infectious-respiratory': 'shared pathogen-host pathways',
      'cardiovascular-metabolic': 'metabolic-cardiovascular syndrome',
      'autoimmune-metabolic': 'autoimmune metabolic overlap',
      'neurological-metabolic': 'neurometabolic pathways',
      'cancer-infectious': 'oncogenic infection link',
      'respiratory-cancer': 'shared carcinogenic exposure',
      'infectious-neurological': 'neuroinfectious pathway',
      'cardiovascular-respiratory': 'cardiopulmonary comorbidity',
      'mental-neurological': 'neuropsychiatric overlap',
      'mental-metabolic': 'metabolic-psychiatric link',
    };

    const crossLinks = displayEdges
      .filter(e => diseases[e.si].category !== diseases[e.ti].category)
      .sort((a, b) => b.sharedPapers - a.sharedPapers)
      .slice(0, 10)
      .map(e => {
        const s = diseases[e.si], t = diseases[e.ti];
        const key = [s.category, t.category].sort().join('-');
        return {
          sLabel: s.label, tLabel: t.label,
          sCat: s.category, tCat: t.category,
          shared: e.sharedPapers,
          reason: reasons[key] || 'cross-category link',
        };
      });

    return { hubs, crossLinks };
  }, [diseases, displayEdges]);

  const show = activeMode === 'connections';
  const mob = isMob();

  if (!show) return null;

  const maxConn = connData.hubs[0]?.count || 1;

  const handleSelect = (id) => {
    if (connFocusSelect) connFocusSelect(id);
    setActiveMode(null);
  };

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
          overflow-y-auto ${mob ? 'p-4 max-w-[95vw]' : 'p-7 max-w-[880px]'} w-full max-h-[85vh]`}
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
          Connection Clusters
        </div>
        <div className={`text-slate-500 ${mob ? 'text-[9px] mb-4' : 'text-xs mb-6'}`}>
          Diseases that appear together in published medical research, suggesting shared biology,
          risk factors, or clinical overlap — revealing comorbidities, shared biology, and research overlap
        </div>

        <div className={`flex ${mob ? 'flex-col gap-5' : 'flex-row gap-9'}`}>
          {/* Hub diseases */}
          <div className="flex-1">
            <div className="text-[10px] text-[#3399ff] font-semibold mb-1 uppercase tracking-wider">
              Hub Diseases
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Most connected — tap to explore</div>
            {connData.hubs.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                onClick={() => handleSelect(d.id)}
                className="mb-2 cursor-pointer group"
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className={`text-slate-300 flex items-center gap-1.5 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CC[d.category] }} />
                    {d.label}
                  </span>
                  <span className={`text-[#3399ff] font-semibold ml-2 whitespace-nowrap ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    {d.count}
                  </span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-sm overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max((d.count / maxConn) * 100, 2)}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="h-full rounded-sm bg-gradient-to-r from-[#3399ff] to-[#1d6fcf]
                      group-hover:brightness-130 transition-[filter]"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {!mob && <div className="w-px bg-white/[0.06]" />}

          {/* Cross-category links */}
          <div className="flex-1">
            <div className="text-[10px] text-[#ffd500] font-semibold mb-1 uppercase tracking-wider">
              Surprising Links
            </div>
            <div className="text-[8px] text-slate-600 mb-3">Cross-category connections with most shared research</div>
            {connData.crossLinks.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.05 }}
                className="mb-2.5"
              >
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className={`text-slate-300 flex items-center gap-1 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className="w-[5px] h-[5px] rounded-full" style={{ background: CC[d.sCat] }} />
                    {d.sLabel}
                  </span>
                  <span className="text-[9px] text-[#ffd500]">&#x27f7;</span>
                  <span className={`text-slate-300 flex items-center gap-1 ${mob ? 'text-[9px]' : 'text-[11px]'}`}>
                    <span className="w-[5px] h-[5px] rounded-full" style={{ background: CC[d.tCat] }} />
                    {d.tLabel}
                  </span>
                </div>
                <div className={`text-slate-500 ${mob ? 'text-[8px]' : 'text-[9px]'}`}>
                  {fmt(d.shared)} shared papers &middot; {d.reason}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
