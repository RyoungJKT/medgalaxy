import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../../store';
import { CC, CL } from '../../utils/constants';
import { fmt } from '../../utils/helpers';

export default function Tooltip() {
  const hoveredNode = useStore(s => s.hoveredNode);
  const connCounts = useStore(s => s.connCounts);
  const selectedNode = useStore(s => s.selectedNode);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Don't show tooltip if same node is selected (desktop sidebar visible)
  const show = hoveredNode && !(selectedNode && hoveredNode.index === selectedNode.index);
  const disease = hoveredNode?.disease;
  const connCount = hoveredNode ? (connCounts.get(hoveredNode.index) || 0) : 0;

  return (
    <AnimatePresence>
      {show && disease && (
        <motion.div
          key="tooltip"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[100] pointer-events-none max-w-[240px]
            backdrop-blur-md bg-[rgba(10,16,30,0.94)] border border-white/[0.08]
            rounded-lg px-3 py-2 text-[11px] text-slate-200"
          style={{ left: pos.x + 15, top: pos.y + 15 }}
        >
          <div className="font-semibold text-xs mb-0.5">{disease.label}</div>
          <span
            className="text-[9px] px-1.5 rounded"
            style={{ background: CC[disease.category] + '22', color: CC[disease.category] }}
          >
            {CL[disease.category]}
          </span>
          <div className="text-slate-400 mt-1">
            {fmt(disease.papers)} papers{' '}
            <span
              className={
                disease.trend > 0
                  ? 'text-green-500'
                  : disease.trend < 0
                  ? 'text-red-500'
                  : 'text-slate-400'
              }
            >
              {disease.trend > 0 ? '\u2191' : disease.trend < 0 ? '\u2193' : '\u2192'}
              {Math.abs(disease.trend)}%
            </span>
          </div>
          <div className="text-slate-500">{connCount} connections</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
