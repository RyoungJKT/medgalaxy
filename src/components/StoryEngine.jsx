import { useEffect, useRef } from 'react';
import useStore from '../store';
import { fmtFull, fmtWord, ppd, trendLabel } from '../utils/captions';

// Papers-per-death display rule: 2 decimals below 1, whole numbers at/above 1.
function ppdStr(val) {
  if (val == null) return 'N/A';
  return val < 1 ? val.toFixed(2) : String(Math.round(val));
}

// ─── Story sequences keyed by chipId ─────────────────────────────────────────
// Every numeral below is derived at render time from live disease data
// (papers/mortality/trend), so a weekly PubMed refresh can never leave a
// stale figure baked into a caption string.
function buildSequences(idMap, diseases) {
  const find = (id) => idMap[id];
  const d = (id) => diseases[idMap[id]];
  return {
    researched: [
      { id: find('breast-cancer'), supernova: true, caption: `Breast Cancer\n${fmtFull(d('breast-cancer').papers)} published papers` },
      { id: find('lung-cancer'), supernova: true, caption: `Lung Cancer\n${fmtFull(d('lung-cancer').papers)} published papers` },
      { id: find('type-2-diabetes'), supernova: true, caption: `Type 2 Diabetes\n${fmtFull(d('type-2-diabetes').papers)} published papers` },
      { caption: 'Science is paying attention here.' },
    ],
    killers: [
      { id: find('heart-disease'), supernova: true, caption: `Heart Disease\n${fmtWord(d('heart-disease').mortality)} deaths every year` },
      { id: find('stroke'), supernova: true, caption: `Stroke\n${fmtWord(d('stroke').mortality)} deaths every year` },
      { id: find('copd'), supernova: true, caption: `COPD\n${fmtWord(d('copd').mortality)} deaths every year` },
      { caption: 'Each of these alone outranks entire categories of disease.' },
    ],
    forgotten: [
      { id: find('rotavirus'), supernova: true, caption: `Rotavirus\n${fmtFull(d('rotavirus').mortality)} children die yearly, ${trendLabel(d('rotavirus').trend)}` },
      { id: find('tetanus'), supernova: true, caption: `Tetanus\n${fmtFull(d('tetanus').mortality)} deaths yearly, ${trendLabel(d('tetanus').trend)}` },
      { id: find('hepatitis-c'), supernova: true, caption: `Hepatitis C\n${fmtFull(d('hepatitis-c').mortality)} deaths yearly, ${trendLabel(d('hepatitis-c').trend)}` },
      { caption: 'And the world is looking away.' },
    ],
    silent: [
      { id: find('rheumatic-heart-disease'), supernova: true, caption: `Rheumatic Heart Disease\n${fmtFull(d('rheumatic-heart-disease').mortality)} deaths, only ${fmtFull(d('rheumatic-heart-disease').papers)} papers` },
      { id: find('norovirus'), supernova: true, caption: `Norovirus\n${fmtFull(d('norovirus').mortality)} deaths, only ${fmtFull(d('norovirus').papers)} papers` },
      { id: find('pertussis'), supernova: true, caption: `Pertussis\n${fmtFull(d('pertussis').mortality)} deaths, only ${fmtFull(d('pertussis').papers)} papers` },
      { id: find('rotavirus'), supernova: true, caption: `Rotavirus\n${fmtFull(d('rotavirus').mortality)} child deaths, ${trendLabel(d('rotavirus').trend)}` },
      { caption: 'Almost no one is studying why.' },
    ],
    richpoor: [
      { id: find('cystic-fibrosis'), supernova: true, caption: `Cystic Fibrosis\n${ppdStr(ppd(d('cystic-fibrosis')))} papers per death, wealthy nations` },
      { id: find('multiple-sclerosis'), supernova: true, caption: `Multiple Sclerosis\n${ppdStr(ppd(d('multiple-sclerosis')))} papers per death, wealthy nations` },
      { id: find('tuberculosis'), supernova: true, caption: `Tuberculosis\n${ppdStr(ppd(d('tuberculosis')))} papers per death, ${fmtWord(d('tuberculosis').mortality)} die yearly` },
      { id: find('malaria'), supernova: true, caption: `Malaria\n${ppdStr(ppd(d('malaria')))} papers per death, ${fmtWord(d('malaria').mortality)} die yearly` },
      { caption: 'Where you are born decides\nhow much science fights for your life.' },
    ],
    mismatch: [
      { id: find('cystic-fibrosis'), supernova: true, caption: `Cystic Fibrosis\n${fmtFull(d('cystic-fibrosis').papers)} papers for ${fmtFull(d('cystic-fibrosis').mortality)} deaths` },
      { id: find('rheumatic-heart-disease'), supernova: true, caption: `Rheumatic Heart Disease\n${fmtFull(d('rheumatic-heart-disease').papers)} papers for ${fmtFull(d('rheumatic-heart-disease').mortality)} deaths` },
      { caption: `A ${fmtFull(Math.round(ppd(d('cystic-fibrosis')) / ppd(d('rheumatic-heart-disease'))))}x research gap.\nNow toggle Mortality at the top of the page.` },
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
        const { idMap, diseases } = useStore.getState();
        const sequences = buildSequences(idMap, diseases);
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
