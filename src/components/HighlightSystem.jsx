import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { neglectColor, nR, matchesSearch } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';
import { igniteWeights } from '../utils/igniteWeights';

const _color = new THREE.Color();
const _graphite = new THREE.Color();
const _m4 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

// LOW tier (phones) renders nodes with MeshPhongMaterial, not the plasma/pulse
// shaders — there is no per-instance emissive channel, so the overture's
// beat 2 desat/ignite grade (plasma.frag.glsl section 8) does nothing there
// today. The flat approximation below mirrors that shader math one step
// simpler (instanceColor is one flat color per node, not the shader's radial
// rim-to-core ramp): every node drains toward graphite by fx.desat, then
// nodes with a nonzero ignite weight lerp further toward the same ember-red
// DIRECTION uses elsewhere (TimeRail's EMBER, the shockwave ring), weighted
// by fx.ignite * aIgnite[i].
const EMBER_RED = '#ff4d1a';
const _ember = new THREE.Color(EMBER_RED);
// The hero's black-body signature, the same white-hot core the shader ramps to
// (#fff3e0, DIRECTION section 1) and the same color the 2020 detonation flash
// uses. On the shader path the core is reached only where temperature, i.e.
// radial position TIMES the node's own ignite weight, approaches 1, which no
// node but the 1.0-weight hero can do. This flat path has no radial term, so
// the exclusivity is stated directly: only a weight of exactly 1.0 climbs past
// ember, and it climbs on the shader's own temp^3 curve. Without it LOW tier's
// thesis frame read as two similar red dots (review gate round 2, P1 #6).
const WHITE_HOT = '#fff3e0';
const _whiteHot = new THREE.Color(WHITE_HOT);
const HERO_W = 0.999; // ignite weights are normalized: the hero alone hits 1.0

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
  const supernovaPhase = useStore(s => s.supernovaPhase);
  const supernovaTargetIdx = useStore(s => s.supernovaTargetIdx);
  const supernovaRevealedLinks = useStore(s => s.supernovaRevealedLinks);
  const supernovaNeighborBatches = useStore(s => s.supernovaNeighborBatches);
  const tmFocusIdx = useStore(s => s.tmFocusIdx);
  const overtureActive = useStore(s => s.overtureActive);
  const diseases = useStore(s => s.diseases);

  // Ignite weights only matter on LOW tier (the only place this component
  // drives them), and only need recomputing when the disease list itself
  // changes — same caching shape RouletteDust/SupernovaDust use for the same
  // function.
  const igniteArr = useMemo(
    () => (TIER === 'LOW' ? igniteWeights(diseases).ignite : null),
    [diseases]
  );

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

      // Build supernova neighbor set for highlighting
      const supernovaActive = supernovaPhase !== 'idle' && supernovaPhase !== 'complete';
      const supernovaAllNeighbors = supernovaActive
        ? new Set(supernovaNeighborBatches.flat())
        : null;
      const supernovaRevealed = supernovaActive
        ? new Set(supernovaRevealedLinks)
        : null;

      const rouletteActive = roulettePhase !== 'idle';
      const ringSet = rouletteActive ? new Set(rouletteRingNodes) : null;

      for (let i = 0; i < diseases.length; i++) {
        const d = diseases[i];
        const ppd = d.mortality > 0 ? d.papers / d.mortality : 0;
        _color.set(neg ? neglectColor(ppd) : CC[d.category]);

        const catVis = activeCats.has(d.category);
        const searchMatch = matchesSearch(d, sq);

        if (supernovaActive) {
          if (i === supernovaTargetIdx) {
            // Target node: bright during charge/burst
            const boost = (supernovaPhase === 'charge' || supernovaPhase === 'burst') ? 1.6 : 1.0;
            _color.multiplyScalar(boost);
          } else if (supernovaPhase === 'linkwave' || supernovaPhase === 'settle') {
            // During linkwave: revealed neighbors at full color, others dimmed
            if (supernovaRevealed.has(i)) {
              _color.multiplyScalar(1.0); // full color
            } else if (supernovaAllNeighbors.has(i)) {
              _color.multiplyScalar(0.15); // not yet revealed
            } else {
              _color.multiplyScalar(0.08);
            }
          } else {
            // Prefocus/charge: target neighbors faintly visible, others heavily dimmed
            if (supernovaAllNeighbors.has(i)) {
              _color.multiplyScalar(0.2);
            } else {
              _color.multiplyScalar(0.08);
            }
          }
        } else if (rouletteActive) {
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
        } else if (tmFocusIdx >= 0) {
          // Time Machine finale: one disease keeps its full color and the other
          // 152 fall to 40 percent. Showing nothing happening is the closing
          // shot (DIRECTION section 3), so the isolation outranks hover, search
          // and category dimming while it is up.
          if (i !== tmFocusIdx) _color.multiplyScalar(0.4);
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

          if (supernovaActive) {
            if (supernovaPhase === 'linkwave' || supernovaPhase === 'settle') {
              const isTarget = e.si === supernovaTargetIdx || e.ti === supernovaTargetIdx;
              const otherIdx = e.si === supernovaTargetIdx ? e.ti : e.si;
              v = isTarget && supernovaRevealed.has(otherIdx) ? 1.0 : 0;
            } else {
              v = 0; // hide edges during prefocus/charge/burst
            }
          } else if (rouletteActive) {
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
    supernovaPhase,
    supernovaTargetIdx,
    supernovaRevealedLinks,
    supernovaNeighborBatches,
    tmFocusIdx,
    // Fires once at overture start (a harmless normal-color repaint, hover is
    // guarded off during the film anyway) and once at release — the release
    // firing is what restores every node's real color after the LOW-tier
    // ignite pass below has been overwriting instanceColor every frame.
    overtureActive,
  ]);

  // ── LOW tier only: beat 2's desat/ignite grade, driven onto instanceColor
  // every frame while the film owns it. HIGH/MEDIUM get this from the plasma/
  // pulse shader uniforms in DiseaseNodes instead (uniforms per fragment);
  // this is the same two-stage blend (desat toward graphite, then ignite
  // toward ember-red) flattened to one color per instance. Follows the write
  // pattern of the main effect above (:142 in the pre-Task-17 file):
  // iMesh.setColorAt(i, _color) then a single instanceColor.needsUpdate flip.
  useFrame(() => {
    if (!overtureActive || TIER !== 'LOW') return;
    const iMesh = sceneRefs.instancedMesh;
    if (!iMesh || !iMesh.instanceColor || !igniteArr) return;
    const fx = sceneRefs.fx;
    const desat = fx.desat || 0;
    const ignite = fx.ignite || 0;
    for (let i = 0; i < diseases.length; i++) {
      const d = diseases[i];
      _color.set(CC[d.category]);
      if (desat > 0.001) {
        const lum = _color.r * 0.299 + _color.g * 0.587 + _color.b * 0.114;
        _graphite.setRGB(lum * 0.72, lum * 0.78, lum * 0.92);
        _color.lerp(_graphite, Math.min(1, desat * 0.85));
      }
      const ig = ignite * igniteArr[i];
      if (ig > 0.001) {
        _color.lerp(_ember, Math.min(1, ig));
        // temp^3, the shader's own white-hot mix (plasma.frag section 8), with
        // core = 1 because a flat instance color has no rim-to-core ramp to
        // ride. Everything under weight 1.0 stays ember-red at every ignite
        // amount, so the phone frame has exactly one white node.
        if (igniteArr[i] >= HERO_W) {
          const t = Math.min(1, ig);
          _color.lerp(_whiteHot, t * t * t);
        }
      }
      iMesh.setColorAt(i, _color);
    }
    iMesh.instanceColor.needsUpdate = true;
  });

  return null;
}
