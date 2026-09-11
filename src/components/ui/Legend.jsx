import React, { useEffect, useState } from 'react';
import useStore from '../../store';
import { isMob } from '../../utils/helpers';
import { TM_EXIT } from '../../utils/motion';
import meta from '../../../data/meta.json';

// How long after the exit begins the rail is off the frame, taken from the
// rail's own line in the exit script rather than restated: 100ms delay plus a
// 240ms slide. It also covers the fast (240ms) and reduced (300ms) exits, both
// of which run with no delay.
const RAIL_GONE_MS = TM_EXIT.rail.at + TM_EXIT.rail.dur;

export default function Legend() {
  const sizeMode = useStore(s => s.sizeMode);
  const uiRevealed = useStore(s => s.uiRevealed);
  const diseases = useStore(s => s.diseases);
  const displayEdges = useStore(s => s.displayEdges);
  const setMethodologyOpen = useStore(s => s.setMethodologyOpen);
  const tmPhase = useStore(s => s.tmPhase);
  const tmExitAt = useStore(s => s.tmExitAt);
  const mob = isMob();

  // tmPhase goes idle on the exit's first frame while the rail is still
  // sliding out, so the link waits out the rail's own leg of the script rather
  // than popping back in underneath it.
  const [railLeaving, setRailLeaving] = useState(false);
  useEffect(() => {
    if (!tmExitAt) return undefined;
    setRailLeaving(true);
    const t = setTimeout(() => setRailLeaving(false), RAIL_GONE_MS);
    return () => clearTimeout(t);
  }, [tmExitAt]);
  const railUp = tmPhase !== 'idle' || railLeaving;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: mob ? '8px 12px' : '8px 16px', display: 'flex', gap: mob ? 8 : 16,
      fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#cbd5e1',
      background: 'linear-gradient(0deg,rgba(6,8,13,0.85) 0%,rgba(6,8,13,0) 100%)',
      pointerEvents: 'none', transform: 'translateY(100%)', animation: uiRevealed ? 'slideUp 0.5s ease 0.4s forwards' : 'none',
    }}>
      {mob ? (
        <span>Tap to explore &middot; Pinch to zoom</span>
      ) : (
        <>
          <span>Node size = {sizeMode === 'papers' ? 'publications' : 'mortality'}</span>
          <span>Drag to rotate &middot; Scroll to zoom &middot; Right-drag to pan &middot; Double-click to re-center</span>
        </>
      )}
      {/* Header hides its count below 1539px with nothing standing in for it
          (Task 13 review finding 10), so the legend footer carries it on
          desktop. On mobile this pushed the legend to a second line (43px ->
          57px at 390px width), eating the TimeRail's tuned gutter above it
          (Task 17: rail clearance went to -4px). The stat is still reachable
          on mobile through the Methodology panel's own disease/connection
          counts, so it is scoped out here rather than duplicated. */}
      {!mob && (
        <span>{diseases.length} diseases &middot; {displayEdges.length} connections</span>
      )}
      {/* The Methodology panel is otherwise reachable only from the header's
          own button; desktop readers who scroll to the credit line for the
          sourcing get a route straight into it from here. The legend root is
          pointerEvents: none, so the span re-enables it for itself.
          Gated on the rail being down for the same reason the counts span is
          scoped out of mobile: this row does not wrap, so an eleventh item plus
          its 16px gap makes the credit span wrap its own text earlier and takes
          the row 43px to 57px at 768-820px, 8px into the gutter the TimeRail's
          bottom offset is tuned against. While the rail owns the bottom of the
          frame the legend stays the height the rail was tuned against; the
          panel is still one click away in the header the whole time. The rail's
          store phase is the gate rather than a width read because this
          component has no resize listener, so a width would be stale the moment
          the window changed. */}
      {!mob && !railUp && (
        <span
          onClick={() => setMethodologyOpen(true)}
          style={{ pointerEvents: 'auto', cursor: 'pointer', color: '#94a3b8', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >Methodology</span>
      )}
      {/* The full desktop credit line (with the refresh date, both source
          names and the author credit) is well over 100 characters — even
          alone, at 375px it wraps to multiple lines and the row grows past
          the rail's tuned gutter regardless of the counts span above (Task
          17 measured this live: removing only the counts span still left an
          18px overlap with the rail's hit target). Mobile gets the same
          shortened shape Header.jsx already uses for its own responsive
          breakpoints: the essential claim (source, cadence) survives here;
          the full citation (exact date, WHO source name, author credit) is
          one tap away in the Methodology panel. */}
      <span style={{ marginLeft: 'auto' }}>
        {mob ? 'Data: PubMed, weekly · sourced' : `Data: PubMed, refreshed weekly (latest: ${meta.pubmedLastRefresh}) · deaths: per-disease sources · Project by Russell J. Young`}
      </span>
    </div>
  );
}
