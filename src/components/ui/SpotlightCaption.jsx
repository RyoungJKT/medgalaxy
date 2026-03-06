import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function SpotlightCaption() {
  const spotlightCaption = useStore(s => s.spotlightCaption);
  const spotlightActive = useStore(s => s.spotlightActive);

  const mob = isMob();
  const show = spotlightActive && spotlightCaption;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={spotlightCaption}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`absolute left-1/2 -translate-x-1/2 z-[46] pointer-events-none
            backdrop-blur-md bg-[rgba(10,16,30,0.95)] border border-white/[0.15]
            rounded-xl text-center
            shadow-[0_8px_32px_rgba(0,0,0,0.5)]
            ${mob ? 'bottom-[90px] px-[18px] py-3' : 'bottom-[110px] px-7 py-4'}`}
        >
          <div className="text-[8px] text-amber-500 font-semibold uppercase tracking-widest mb-1.5">
            Spotlight
          </div>
          <div
            className={`text-slate-100 leading-relaxed
              ${mob ? 'text-xs max-w-[85vw]' : 'text-sm whitespace-nowrap'}`}
          >
            {spotlightCaption}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
