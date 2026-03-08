import { useEffect } from 'react';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { neglectColor, nR } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';

const _color = new THREE.Color();
const _m4 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/**
 * Logic-only component that updates instanced mesh colors and edge
 * visibility whenever highlight-relevant store state changes.
 * Returns null — renders nothing to the scene.
 */
export default function HighlightSystem() {
  const hoveredNode = useStore(s => s.hoveredNode);
  const selectedNode = useStore(s => s.selectedNode);
  const activeCats = useStore(s => s.activeCats);
  const searchQuery = useStore(s => s.searchQuery);
  const neglectMode = useStore(s => s.neglectMode);
  const connFocusIdx = useStore(s => s.connFocusIdx);
  const activeMode = useStore(s => s.activeMode);
  const sizeMode = useStore(s => s.sizeMode);
  const roulettePhase = useStore(s => s.roulettePhase);
  const rouletteWinner = useStore(s => s.rouletteWinner);
  const rouletteEligible = useStore(s => s.rouletteEligible);
  const rouletteRingNodes = useStore(s => s.rouletteRingNodes);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const iMesh = sceneRefs.instancedMesh;
      const edgeMesh = sceneRefs.edgeMesh;
      const edgeMeta = sceneRefs.edgeMeta;
      if (!iMesh) return;

      const { diseases, displayEdges, neighbors, connCounts, idMap } =
        useStore.getState();
      const hIdx = hoveredNode ? hoveredNode.index : -1;
      const sIdx = selectedNode ? selectedNode.index : -1;
      const aIdx =
        hIdx >= 0 ? hIdx : sIdx >= 0 ? sIdx : connFocusIdx >= 0 ? connFocusIdx : -1;
      const nbrs = aIdx >= 0 ? neighbors.get(aIdx) : null;
      const sq = searchQuery.toLowerCase();
      const connMode = activeMode === 'connections';

      // Build hub set for connections mode (top 10 most connected)
      const hubSet = new Set();
      if (connMode && connCounts) {
        const sorted = [...connCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        sorted.forEach(([idx]) => hubSet.add(idx));
      }

      const neg = neglectMode;
      const rouletteActive = roulettePhase !== 'idle';
      const ringSet = rouletteActive ? new Set(rouletteRingNodes) : null;

      for (let i = 0; i < diseases.length; i++) {
        const d = diseases[i];
        const ppd = d.mortality > 0 ? d.papers / d.mortality : 0;
        _color.set(neg ? neglectColor(ppd) : CC[d.category]);

        const catVis = activeCats.has(d.category);
        const searchMatch = !sq || d.label.toLowerCase().includes(sq);

        if (rouletteActive) {
          // Roulette overrides all other highlight logic
          if (!ringSet.has(i)) {
            _color.multiplyScalar(0.02); // aggressively dim non-ring nodes
            // Shrink non-ring nodes to near-invisible
            iMesh.getMatrixAt(i, _m4);
            _m4.decompose(_p, _q, _s);
            _s.set(0.001, 0.001, 0.001);
            _m4.compose(_p, _q, _s);
            iMesh.setMatrixAt(i, _m4);
          } else if (i === rouletteWinner && roulettePhase === 'reveal') {
            _color.multiplyScalar(1.6); // strong hero brightness, category color preserved
          } else {
            // Ring non-winner: slightly dim to make winner stand out more
            _color.multiplyScalar(0.55);
          }
        } else if (!neg && !catVis) {
          _color.multiplyScalar(0.05);
        } else if (connMode && connFocusIdx >= 0) {
          // Hub focused — highlight focused node and its neighbors
          if (i === connFocusIdx) { /* full color */ }
          else if (nbrs && nbrs.has(i)) { /* keep original */ }
          else _color.multiplyScalar(0.15);
        } else if (connMode) {
          if (hubSet.has(i)) _color.multiplyScalar(1.3);
          else _color.multiplyScalar(0.4);
        } else if (aIdx >= 0) {
          if (i === aIdx) { /* was: _color.multiplyScalar(1.15) */ }
          else if (nbrs && nbrs.has(i)) {
            /* keep original color */
          } else _color.multiplyScalar(0.25);
        } else if (sq && !searchMatch) {
          _color.multiplyScalar(0.15);
        }

        iMesh.setColorAt(i, _color);

        // Shrink filtered-out nodes to near-invisible size
        // (roulette non-ring shrinking handled above in the roulette block)
        if (rouletteActive && ringSet.has(i)) {
          // Ensure ring nodes have proper scale (restore if previously shrunk)
          iMesh.getMatrixAt(i, _m4);
          _m4.decompose(_p, _q, _s);
          const r = nR(d.papers);
          if (_s.x < 0.01) {
            _s.set(r, r, r);
            _m4.compose(_p, _q, _s);
            iMesh.setMatrixAt(i, _m4);
          }
        } else if (rouletteActive) {
          // Non-ring nodes already shrunk above — skip normal size logic
        } else if (!neg && !catVis) {
          iMesh.getMatrixAt(i, _m4);
          _m4.decompose(_p, _q, _s);
          _s.set(0.001, 0.001, 0.001);
          _m4.compose(_p, _q, _s);
          iMesh.setMatrixAt(i, _m4);
        } else {
          // Restore proper scale for visible nodes
          iMesh.getMatrixAt(i, _m4);
          _m4.decompose(_p, _q, _s);
          const r = sizeMode === 'papers' ? nR(d.papers) : nR(d.papers);
          if (_s.x < 0.01) {
            _s.set(r, r, r);
            _m4.compose(_p, _q, _s);
            iMesh.setMatrixAt(i, _m4);
          }
        }
      }

      iMesh.instanceColor.needsUpdate = true;
      iMesh.instanceMatrix.needsUpdate = true;

      // ── Edge highlighting (ribbon geometry) ──
      if (edgeMeta && displayEdges) {
        const { geo, visArr, vertsPerEdge } = edgeMeta;
        const visAttr = geo.getAttribute('aVis');
        if (!visAttr) return;

        const hasActive = aIdx >= 0;

        for (let i = 0; i < displayEdges.length; i++) {
          const e = displayEdges[i];
          const sv = activeCats.has(diseases[e.si].category);
          const tv = activeCats.has(diseases[e.ti].category);
          let v = 0;

          if (rouletteActive) {
            v = 0; // Hide all edges during roulette
          } else if (connMode && connFocusIdx >= 0 && sv && tv) {
            // Hub focused — only show edges connected to the focused node
            const isFocused = e.si === connFocusIdx || e.ti === connFocusIdx;
            v = isFocused ? 1.0 : 0.0;
          } else if (connMode && sv && tv) {
            // Overlay showing (no hub focused) — show hub edges brighter
            const isHub = hubSet.has(e.si) || hubSet.has(e.ti);
            v = isHub ? 1.0 : 0.3;
          } else if (hasActive) {
            const isNb = e.si === aIdx || e.ti === aIdx;
            v = isNb && sv && tv ? 1.0 : 0.0;
          }

          // Set visibility for all vertices of this edge
          const vBase = i * vertsPerEdge;
          for (let vi = 0; vi < vertsPerEdge; vi++) {
            visArr[vBase + vi] = v;
          }
        }

        visAttr.needsUpdate = true;
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [
    hoveredNode,
    selectedNode,
    activeCats,
    searchQuery,
    neglectMode,
    connFocusIdx,
    activeMode,
    sizeMode,
    roulettePhase,
    rouletteWinner,
    rouletteEligible,
    rouletteRingNodes,
  ]);

  return null;
}
