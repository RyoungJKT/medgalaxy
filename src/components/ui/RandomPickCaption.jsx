import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function RandomPickCaption() {
  const randomPickCaption = useStore(s => s.randomPickCaption);
  const stopRandomPick = useStore(s => s.stopRandomPick);

  const mob = isMob();

  return (
    <AnimatePresence>
      {randomPickCaption && (
        <motion.div
          key={randomPickCaption.disease.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={stopRandomPick}
          className={`absolute left-1/2 -translate-x-1/2 z-[46] pointer-events-auto
            backdrop-blur-md bg-[rgba(10,16,30,0.95)]
            border border-amber-500/30 rounded-xl text-center cursor-pointer
            shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(245,158,11,0.1)]
            ${mob ? 'bottom-[90px] px-5 py-3.5 max-w-[92vw]' : 'bottom-[110px] px-8 py-5 max-w-[520px]'}`}
        >
          <div className="text-[8px] text-amber-500 font-semibold uppercase tracking-widest mb-2">
            &#x27f3; Random Pick
          </div>
          <div className={`text-slate-100 font-semibold mb-2.5 ${mob ? 'text-[15px]' : 'text-lg'}`}>
            {randomPickCaption.disease.label}
          </div>
          <div className={`text-slate-300 leading-relaxed ${mob ? 'text-[11px]' : 'text-[13px]'}`}>
            {randomPickCaption.fact}
          </div>
          <div className="text-slate-500 text-[10px] mt-3">
            {mob ? 'tap' : 'click'} to dismiss
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
