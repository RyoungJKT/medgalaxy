import React from 'react';
import { motion } from 'framer-motion';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';

export default function Legend() {
  const sizeMode = useStore(s => s.sizeMode);
  const mob = isMob();

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay: 2.1, ease: 'easeOut' }}
      className={`absolute bottom-0 left-0 right-0 z-40 flex text-[9px] text-slate-300
        bg-gradient-to-t from-[rgba(6,8,13,0.85)] to-transparent pointer-events-none
        ${mob ? 'px-3 py-2 gap-2' : 'px-4 py-2 gap-4'}`}
    >
      {mob ? (
        <span>Tap to explore &middot; Pinch to zoom</span>
      ) : (
        <>
          <span>Node size = {sizeMode === 'papers' ? 'publications' : 'mortality'}</span>
          <span>Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan &middot; Double-click to re-center</span>
        </>
      )}
      <span className="ml-auto">Data: PubMed &middot; WHO Global Health Estimates 2021 &middot; Project by Russell J. Young</span>
    </motion.div>
  );
}
