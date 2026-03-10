import { useEffect, useRef } from 'react';
import useStore from '../store';

// ─── Story sequences keyed by chipId ─────────────────────────────────────────
function buildSequences(idMap) {
  const find = (id) => idMap[id];
  return {
    researched: [
      { id: find('breast-cancer'), supernova: true, caption: 'Breast Cancer — 430K papers' },
      { id: find('lung-cancer'), supernova: true, caption: 'Lung Cancer — 350K papers' },
      { id: find('type-2-diabetes'), supernova: true, caption: 'Type 2 Diabetes — 380K papers' },
      { caption: 'These diseases each have 300,000+ papers.' },
    ],
    killers: [
      { id: find('heart-disease'), supernova: true, caption: 'Heart Disease — 9.1M deaths/yr' },
      { id: find('stroke'), supernova: true, caption: 'Stroke — 7.3M deaths/yr' },
      { id: find('copd'), supernova: true, caption: 'COPD — 3.5M deaths/yr' },
      { caption: 'These diseases kill millions per year.' },
    ],
    forgotten: [
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus — 200K child deaths/yr, research declining 4%' },
      { id: find('tetanus'), supernova: true, caption: 'Tetanus — 35K deaths/yr, research declining 3%' },
      { id: find('hepatitis-c'), supernova: true, caption: 'Hepatitis C — 242K deaths/yr, research declining 2%' },
      { caption: 'These diseases still kill 470,000+ yearly while the world looks away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease — 373K deaths/yr, only 9K papers (41 deaths per paper)' },
      { id: find('norovirus'), supernova: true, caption: 'Norovirus — 200K deaths/yr, only 12K papers' },
      { id: find('pertussis'), supernova: true, caption: 'Pertussis — 160K deaths/yr, only 14K papers' },
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus — 200K child deaths/yr, research declining' },
      { caption: 'These diseases kill 930,000+ people every year in near-silence.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis — 48 papers per death (wealthy nation disease)' },
      { id: find('multiple-sclerosis'), supernova: true, caption: 'Multiple Sclerosis — 16 papers per death (wealthy nation disease)' },
      { id: find('tuberculosis'), supernova: true, caption: 'Tuberculosis — 0.09 papers per death, 1.25M deaths/yr (developing nation)' },
      { id: find('malaria'), supernova: true, caption: 'Malaria — 0.16 papers per death, 608K deaths/yr (developing nation)' },
      { caption: 'Where you are born determines how much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis — 48K papers, 1K deaths (48 papers per death)' },
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease — 9K papers, 373K deaths (0.02 papers per death)' },
      { caption: ' 2,000× research intensity gap. Now toggle Mortality at the top of the page →' },
    ],
  };
}

function showStep(sr) {
  const seq = sr.seq;
  if (!seq || sr.step >= seq.length) {
    // Done: cinematic exit — clear caption and pull back immediately
    useStore.getState().setStoryCaption('');
    sr.seq = null;
    sr.step = 0;

    // Slow pull-back to default view — also clean up supernova dust
    useStore.setState({ selectedNode: null, supernovaTargetIdx: -1 });
    useStore.getState().setFlyTarget({
      position: [0, 0, 0],
      radius: null,
      duration: 3.0,
    });

    // Restore story chips after camera has settled
    setTimeout(() => {
      useStore.setState({ storyActive: null, storyStep: 0, storyVisible: true });
    }, 2800);
    return;
  }

  const s = seq[sr.step];
  useStore.getState().setStoryCaption(s.caption || '');

  if (s.id !== undefined) {
    if (s.supernova) {
      // Dramatic supernova reveal — triggerSupernova with keepStory flag
      useStore.getState().triggerSupernova(s.id, { keepStory: true });
    } else {
      // Select node, then override flyTarget with a slower cinematic duration
      useStore.getState().selectDisease(s.id);
      const ft = useStore.getState().flyTarget;
      if (ft) {
        useStore.getState().setFlyTarget({ ...ft, duration: 2.0 });
      }
    }
  }
}

export default function StoryEngine() {
  const stateRef = useRef({ seq: null, step: 0 });

  useEffect(() => {
    // When a story chip is clicked, build sequence and show first step
    const unsubActive = useStore.subscribe(
      (s) => s.storyActive,
      (chipId) => {
        const sr = stateRef.current;

        // Reset caption
        useStore.getState().setStoryCaption('');

        if (!chipId) {
          sr.seq = null;
          sr.step = 0;
          return;
        }

        // Build sequence and show first step
        const { idMap } = useStore.getState();
        const sequences = buildSequences(idMap);
        sr.seq = sequences[chipId];
        sr.step = 0;

        if (!sr.seq) return;

        useStore.setState({ storyStep: 0, storyVisible: false });
        showStep(sr);
      }
    );

    // When user clicks caption ("click to continue"), advance to next step
    const unsubStep = useStore.subscribe(
      (s) => s.storyStep,
      (step) => {
        const sr = stateRef.current;
        if (!sr.seq) return;
        // Only advance if the store step is ahead of our internal step
        if (step > sr.step) {
          sr.step = step;
          showStep(sr);
        }
      }
    );

    return () => {
      unsubActive();
      unsubStep();
    };
  }, []);

  return null;
}
