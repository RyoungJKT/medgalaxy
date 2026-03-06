import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC } from '../../utils/constants';

export default function SearchDropdown({ onSelect }) {
  const searchQuery = useStore(s => s.searchQuery);
  const diseases = useStore(s => s.diseases);

  if (!searchQuery || searchQuery.length < 1) return null;

  const q = searchQuery.toLowerCase();
  const matches = diseases.filter(d => d.label.toLowerCase().includes(q)).slice(0, 8);

  if (!matches.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="absolute top-full left-0 right-0 mt-1 z-[60]
        backdrop-blur-md bg-[rgba(10,16,30,0.96)] border border-white/[0.08]
        rounded-md p-1 text-[11px] min-w-[200px]"
    >
      {matches.map(d => (
        <div
          key={d.id}
          onClick={() => onSelect(d)}
          className="px-2 py-1.5 cursor-pointer rounded text-slate-200
            flex items-center gap-1.5 hover:bg-white/[0.06] transition-colors"
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: CC[d.category] }}
          />
          {d.label}
        </div>
      ))}
    </motion.div>
  );
}
