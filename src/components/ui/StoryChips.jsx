import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

const chips = [
  { id: 'researched', label: 'Most Researched', desc: 'See the biggest research spheres' },
  { id: 'killers', label: 'Top Killers', desc: 'Diseases with highest mortality' },
  { id: 'forgotten', label: 'Forgotten Diseases', desc: 'Declining research, rising deaths' },
  { id: 'silent', label: 'Silent Killers', desc: 'High mortality, minimal attention' },
  { id: 'richpoor', label: 'Rich vs. Poor', desc: 'Who gets the research?' },
  { id: 'mismatch', label: 'The Mismatch', desc: 'The 2,000:1 research gap' },
];

export default function StoryChips() {
  const storyVisible = useStore(s => s.storyVisible);
  const setStoryActive = useStore(s => s.setStoryActive);
  const startRandomPick = useStore(s => s.startRandomPick);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2800);
    return () => clearTimeout(t);
  }, []);

  const mob = isMob();
  const show = storyVisible && mounted;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`absolute z-[45] left-1/2 -translate-x-1/2 pointer-events-auto
            ${mob ? 'bottom-8 grid grid-cols-4 gap-1.5 w-[92vw]' : 'bottom-[50px] flex gap-2.5'}`}
        >
          {chips.map(c => (
            <motion.button
              key={c.id}
              onClick={() => setStoryActive(c.id)}
              whileHover={{
                boxShadow: '0 0 8px 1px rgba(57,255,20,0.4), 0 0 20px 3px rgba(57,255,20,0.15)',
                borderColor: 'rgba(57,255,20,0.6)',
              }}
              className={`rounded-lg border border-white/10 bg-[rgba(10,16,30,0.92)]
                text-slate-200 cursor-pointer transition-[background]
                ${mob ? 'px-1 py-1.5 text-[9px]' : 'px-4 py-2 text-[11px]'}`}
            >
              {c.label}
            </motion.button>
          ))}
          <motion.button
            onClick={startRandomPick}
            whileHover={{
              boxShadow: '0 0 8px 1px rgba(245,158,11,0.4), 0 0 20px 3px rgba(245,158,11,0.15)',
              borderColor: 'rgba(245,158,11,0.6)',
            }}
            className={`rounded-lg border border-amber-500/30 bg-[rgba(10,16,30,0.92)]
              text-amber-500 cursor-pointer transition-[background]
              ${mob ? 'px-1 py-1.5 text-[9px]' : 'px-4 py-2 text-[11px]'}`}
          >
            &#x27f3; Random Pick
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
