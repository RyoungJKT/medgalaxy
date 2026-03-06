import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import useStore from '../store';
import { CC } from '../utils/constants';
import { nR, isMob, neglectColor } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';

const pv = new THREE.Vector3();

/**
 * Renders disease-name labels as DOM elements positioned via 3D-to-2D
 * projection. Lives outside the R3F Canvas in HtmlOverlay.
 * Uses a requestAnimationFrame loop reading from sceneRefs.camera.
 */
export default function NodeLabels() {
  const diseases = useStore(s => s.diseases);
  const neglectMode = useStore(s => s.neglectMode);
  const containerRef = useRef(null);
  const mob = isMob();

  useEffect(() => {
    let running = true;

    function update() {
      if (!running) return;

      const camera = sceneRefs.camera;
      const canvas = sceneRefs.canvasElement;
      const container = containerRef.current;

      if (!camera || !canvas || !container) {
        requestAnimationFrame(update);
        return;
      }

      const curPos = useStore.getState().curPos;
      const hovIdx = useStore.getState().hoveredNode?.index ?? -1;
      const rc = canvas.getBoundingClientRect();
      const kids = container.children;

      // Approximate camera distance for screen-size estimation
      const camDist = camera.position.length();

      for (let i = 0; i < diseases.length; i++) {
        const el = kids[i];
        if (!el) continue;

        pv.set(curPos[i][0], curPos[i][1], curPos[i][2]).project(camera);

        // Behind camera or off-screen
        if (pv.z > 1 || pv.z < -1) {
          el.style.display = 'none';
          continue;
        }

        let sx = (pv.x * 0.5 + 0.5) * rc.width;
        const sy = (-pv.y * 0.5 + 0.5) * rc.height;

        // Clamp so labels don't get cut off at screen edges
        sx = Math.max(40, Math.min(rc.width - 40, sx));

        const nodeR = nR(diseases[i].papers);
        const screenR =
          nodeR * rc.height / (2 * camDist * Math.tan(Math.PI / 6));

        // Hide very tiny labels when zoomed out
        if (screenR < 0.3 && i !== hovIdx) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = '';
        el.style.left = sx + 'px';
        el.style.top = sy - Math.max(screenR * 1.2, 4) - 12 + 'px';
        el.style.opacity = i === hovIdx ? '1' : '0.75';

        const nameEl = el.firstChild;
        if (i === hovIdx) {
          nameEl.style.fontSize = '11px';
          nameEl.style.fontWeight = '600';
          nameEl.style.color = '#e2e8f0';
        } else {
          nameEl.style.fontSize = mob ? '7px' : '9px';
          nameEl.style.fontWeight = '400';
          nameEl.style.color = '';
        }
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
    return () => {
      running = false;
    };
  }, [diseases, mob]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-30 overflow-hidden"
    >
      {diseases.map((d) => (
        <div
          key={d.id}
          className="absolute"
          style={{
            transform: 'translateX(-50%)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: mob ? 7 : 9,
            color: neglectMode
              ? neglectColor(d.mortality > 0 ? d.papers / d.mortality : 0)
              : CC[d.category],
            textAlign: 'center',
            whiteSpace: 'nowrap',
            textShadow:
              '0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          <span className="lbl-name">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
