import { useEffect, useRef } from 'react';
import useStore from '../store';

// ─── Story sequences keyed by chipId ─────────────────────────────────────────
function buildSequences(idMap) {
  const find = (id) => idMap[id];
  return {
    researched: [
      { id: find('breast-cancer'), supernova: true, caption: 'Breast Cancer\n430,000 published papers' },
      { id: find('lung-cancer'), supernova: true, caption: 'Lung Cancer\n350,000 published papers' },
      { id: find('type-2-diabetes'), supernova: true, caption: 'Type 2 Diabetes\n380,000 published papers' },
      { caption: 'Over 1 million papers combined.\nScience is paying attention here.' },
    ],
    killers: [
      { id: find('heart-disease'), supernova: true, caption: 'Heart Disease\n9.1 million deaths every year' },
      { id: find('stroke'), supernova: true, caption: 'Stroke\n7.3 million deaths every year' },
      { id: find('copd'), supernova: true, caption: 'COPD\n3.5 million deaths every year' },
      { caption: 'Together, nearly 20 million lives lost annually.' },
    ],
    forgotten: [
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus\n200,000 children die yearly — research down 4%' },
      { id: find('tetanus'), supernova: true, caption: 'Tetanus\n35,000 deaths yearly — research down 3%' },
      { id: find('hepatitis-c'), supernova: true, caption: 'Hepatitis C\n242,000 deaths yearly — research down 2%' },
      { caption: '470,000+ deaths a year.\nAnd the world is looking away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease\n373,000 deaths — only 9,000 papers' },
      { id: find('norovirus'), supernova: true, caption: 'Norovirus\n200,000 deaths — only 12,000 papers' },
      { id: find('pertussis'), supernova: true, caption: 'Pertussis\n160,000 deaths — only 14,000 papers' },
      { id: find('rotavirus'), supernova: true, caption: 'Rotavirus\n200,000 child deaths — research declining' },
      { caption: '930,000+ people die every year.\nAlmost no one is studying why.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis\n48 papers per death — wealthy nations' },
      { id: find('multiple-sclerosis'), supernova: true, caption: 'Multiple Sclerosis\n16 papers per death — wealthy nations' },
      { id: find('tuberculosis'), supernova: true, caption: 'Tuberculosis\n0.09 papers per death — 1.25M die yearly' },
      { id: find('malaria'), supernova: true, caption: 'Malaria\n0.16 papers per death — 608,000 die yearly' },
      { caption: 'Where you are born decides\nhow much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), supernova: true, caption: 'Cystic Fibrosis\n48,000 papers for 1,000 deaths' },
      { id: find('rheumatic-heart-disease'), supernova: true, caption: 'Rheumatic Heart Disease\n9,000 papers for 373,000 deaths' },
      { caption: 'A 2,000x research gap.\nNow toggle Mortality at the top of the page.' },
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
