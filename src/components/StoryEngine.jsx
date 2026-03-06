import { useEffect, useRef } from 'react';
import useStore from '../store';

// ─── Story sequences keyed by chipId ─────────────────────────────────────────
function buildSequences(idMap) {
  const find = (id) => idMap[id];
  return {
    researched: [
      { id: find('breast-cancer'), caption: 'Breast Cancer \u2014 430K papers' },
      { id: find('lung-cancer'), caption: 'Lung Cancer \u2014 350K papers' },
      { id: find('type-2-diabetes'), caption: 'Type 2 Diabetes \u2014 380K papers' },
      { caption: 'These diseases each have 300,000+ papers.' },
    ],
    killers: [
      { id: find('heart-disease'), caption: 'Heart Disease \u2014 9.1M deaths/yr' },
      { id: find('stroke'), caption: 'Stroke \u2014 7.3M deaths/yr' },
      { id: find('copd'), caption: 'COPD \u2014 3.5M deaths/yr' },
      { caption: 'These diseases kill millions per year.' },
    ],
    forgotten: [
      { id: find('rotavirus'), caption: 'Rotavirus \u2014 200K child deaths/yr, research declining 18%' },
      { id: find('tetanus'), caption: 'Tetanus \u2014 35K deaths/yr, research declining 10%' },
      { id: find('hepatitis-c'), caption: 'Hepatitis C \u2014 242K deaths/yr, research declining' },
      { caption: 'These diseases still kill 470,000+ yearly while the world looks away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease \u2014 373K deaths/yr, only 9K papers (41 deaths per paper)' },
      { id: find('norovirus'), caption: 'Norovirus \u2014 200K deaths/yr, only 12K papers' },
      { id: find('pertussis'), caption: 'Pertussis \u2014 160K deaths/yr, only 14K papers' },
      { id: find('rotavirus'), caption: 'Rotavirus \u2014 200K child deaths/yr, research declining' },
      { caption: 'These diseases kill 930,000+ people every year in near-silence.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis \u2014 48 papers per death (wealthy nation disease)' },
      { id: find('multiple-sclerosis'), caption: 'Multiple Sclerosis \u2014 16 papers per death (wealthy nation disease)' },
      { id: find('tuberculosis'), caption: 'Tuberculosis \u2014 0.09 papers per death, 1.25M deaths/yr (developing nation)' },
      { id: find('malaria'), caption: 'Malaria \u2014 0.16 papers per death, 608K deaths/yr (developing nation)' },
      { caption: 'Where you are born determines how much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis \u2014 48K papers, 1K deaths (48 papers per death)' },
      { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease \u2014 9K papers, 373K deaths (0.02 papers per death)' },
      { caption: ' 2,000\u00d7 research intensity gap. Now toggle Mortality at the top of the page \u2192' },
    ],
  };
}

export default function StoryEngine() {
  const stateRef = useRef({ timer: null, seq: null, step: 0 });

  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.storyActive,
      (chipId) => {
        const sr = stateRef.current;

        // Clear any running timer
        if (sr.timer) {
          clearTimeout(sr.timer);
          sr.timer = null;
        }

        // Reset caption
        useStore.getState().setStoryCaption('');

        if (!chipId) {
          sr.seq = null;
          sr.step = 0;
          return;
        }

        // Build sequence
        const { idMap } = useStore.getState();
        const sequences = buildSequences(idMap);
        sr.seq = sequences[chipId];
        sr.step = 0;

        if (!sr.seq) return;

        // Step through
        const advance = () => {
          const seq = sr.seq;
          if (!seq || sr.step >= seq.length) {
            // Done: clear story state, fly back
            useStore.getState().setStoryCaption('');
            useStore.getState().deselect();
            useStore.setState({ storyActive: null });
            sr.seq = null;
            sr.step = 0;
            return;
          }

          const s = seq[sr.step];
          useStore.getState().setStoryCaption(s.caption || '');

          if (s.id !== undefined) {
            useStore.getState().selectDisease(s.id);
          }

          sr.step++;
          sr.timer = setTimeout(advance, 4500);
        };

        advance();
      }
    );

    return () => {
      unsub();
      const sr = stateRef.current;
      if (sr.timer) clearTimeout(sr.timer);
    };
  }, []);

  return null;
}
