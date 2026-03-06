import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function StoryCaption() {
  const storyCaption = useStore(s => s.storyCaption);
  const setStoryStep = useStore(s => s.setStoryStep);
  const storyStep = useStore(s => s.storyStep);

  const mob = isMob();

  // Clicking advances the story step
  const handleClick = () => {
    setStoryStep(storyStep + 1);
  };

  return (
    <AnimatePresence>
      {storyCaption && (
        <motion.div
          key={storyCaption}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={handleClick}
          className={`absolute left-1/2 -translate-x-1/2 z-[46] pointer-events-auto
            backdrop-blur-md bg-[rgba(10,16,30,0.95)] border border-white/[0.15]
            rounded-xl text-center cursor-pointer
            shadow-[0_8px_32px_rgba(0,0,0,0.5)] tracking-[0.01em] leading-relaxed
            ${mob
              ? 'bottom-[90px] px-5 py-3.5 text-[13px] max-w-[92vw]'
              : 'bottom-[110px] px-8 py-[18px] text-[15px] whitespace-nowrap'}`}
        >
          <span className="text-slate-100">{storyCaption}</span>
          <div className={`text-slate-400 mt-2 ${mob ? 'text-[10px]' : 'text-[11px]'}`}>
            {mob ? 'tap' : 'click'} to continue
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
