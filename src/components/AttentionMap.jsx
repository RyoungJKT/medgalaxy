import { useEffect } from 'react';
import * as THREE from 'three';
import useStore from '../store';
import { neglectColor } from '../utils/helpers';
import { CC } from '../utils/constants';
import { sceneRefs } from '../sceneRefs';

/**
 * Hook that recolors disease nodes based on neglectMode.
 * Call inside DiseaseNodes, passing the InstancedMesh ref.
 *
 * When neglectMode is true:  recolor using papers/mortality ratio (red=neglected, green=well-researched)
 * When neglectMode is false: restore original category colors
 */
export function useAttentionColors(meshRef) {
  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.neglectMode,
      (neglectMode) => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const { diseases } = useStore.getState();
        const color = new THREE.Color();

        for (let i = 0; i < diseases.length; i++) {
          const d = diseases[i];
          if (neglectMode) {
            const ppd = d.mortality > 0 ? d.papers / d.mortality : 0;
            color.set(neglectColor(ppd));
          } else {
            color.set(CC[d.category]);
          }
          mesh.setColorAt(i, color);
        }

        mesh.instanceColor.needsUpdate = true;
      }
    );

    return unsub;
  }, [meshRef]);
}

// Also export as a logic-only component for standalone use via sceneRefs
export default function AttentionMap() {
  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.neglectMode,
      (neglectMode) => {
        const mesh = sceneRefs.instancedMesh;
        if (!mesh) return;

        const { diseases } = useStore.getState();
        const color = new THREE.Color();

        for (let i = 0; i < diseases.length; i++) {
          const d = diseases[i];
          if (neglectMode) {
            const ppd = d.mortality > 0 ? d.papers / d.mortality : 0;
            color.set(neglectColor(ppd));
          } else {
            color.set(CC[d.category]);
          }
          mesh.setColorAt(i, color);
        }

        mesh.instanceColor.needsUpdate = true;
      }
    );

    return unsub;
  }, []);

  return null;
}
