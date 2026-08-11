import { useEffect, useRef } from 'react';
import useStore from '../store';
import { fmtFull, fmtWord, ppd, deathsPerPaper, trendLabel } from '../utils/captions';

// Ratio display rule: 2 decimals below 1, whole numbers at/above 1.
function ratioStr(val) {
  if (val == null) return 'N/A';
  return val < 1 ? val.toFixed(2) : String(Math.round(val));
}

// Capitalize the leading word of a trendLabel() fragment when it opens a
// caption clause (trendLabel itself returns lowercase, sentence-case text).
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Curated spotlight list ────────────────────────────────────────
// Every numeral is derived at render time from live disease data (papers,
// mortality, trend) so a weekly PubMed refresh can never leave a stale
// figure baked into a caption string.
function buildSpotlightList(idMap, diseases) {
  const find = (id) => idMap[id];
  const d = (id) => diseases[idMap[id]];
  const list = [
    // Most researched
    { id: find('breast-cancer'), caption: `Breast Cancer · ${fmtFull(d('breast-cancer').papers)} papers · Most researched cancer` },
    { id: find('heart-disease'), caption: `Heart Disease · ${fmtWord(d('heart-disease').mortality)} deaths/yr · #1 killer globally` },
    { id: find('type-2-diabetes'), caption: `Type 2 Diabetes · ${fmtFull(d('type-2-diabetes').papers)} papers · ${fmtWord(d('type-2-diabetes').mortality)} deaths/yr` },
    { id: find('hiv-aids'), caption: `HIV/AIDS · ${fmtFull(d('hiv-aids').papers)} papers · Reshaped modern medicine` },
    { id: find('lung-cancer'), caption: `Lung Cancer · ${fmtWord(d('lung-cancer').mortality)} deaths/yr · Deadliest cancer` },
    // Most deadly
    { id: find('sepsis'), caption: `Sepsis · ${fmtWord(d('sepsis').mortality)} deaths/yr but only ${fmtFull(d('sepsis').papers)} papers · ${ratioStr(deathsPerPaper(d('sepsis')))} deaths per paper` },
    { id: find('stroke'), caption: `Stroke · ${fmtWord(d('stroke').mortality)} deaths/yr · Every 3 seconds someone has one` },
    { id: find('copd'), caption: `COPD · ${fmtWord(d('copd').mortality)} deaths/yr · ${ratioStr(deathsPerPaper(d('copd')))} deaths per paper published` },
    { id: find('pneumonia'), caption: `Pneumonia · ${fmtWord(d('pneumonia').mortality)} deaths/yr · Leading killer of children` },
    { id: find('alzheimers-disease'), caption: `Alzheimer's · ${fmtWord(d('alzheimers-disease').mortality)} deaths/yr · ${cap(trendLabel(d('alzheimers-disease').trend))}` },
    // Most neglected
    { id: find('rheumatic-heart-disease'), caption: `Rheumatic Heart Disease · ${fmtFull(d('rheumatic-heart-disease').mortality)} deaths, only ${fmtFull(d('rheumatic-heart-disease').papers)} papers · ${ratioStr(deathsPerPaper(d('rheumatic-heart-disease')))} deaths per paper` },
    { id: find('norovirus'), caption: `Norovirus · ${fmtFull(d('norovirus').mortality)} deaths/yr · World's most common stomach bug` },
    { id: find('sickle-cell-disease'), caption: `Sickle Cell · ${fmtWord(d('sickle-cell-disease').mortality)} deaths/yr · Most common genetic disease in Africa` },
    { id: find('hepatitis-b'), caption: `Hepatitis B · ${fmtWord(d('hepatitis-b').mortality)} deaths/yr · ${ratioStr(deathsPerPaper(d('hepatitis-b')))} deaths for every paper` },
    // Most researched per death
    { id: find('cystic-fibrosis'), caption: `Cystic Fibrosis · ${ratioStr(ppd(d('cystic-fibrosis')))} papers per death · Most researched per capita` },
    { id: find('ebola'), caption: `Ebola · ${ratioStr(ppd(d('ebola')))} papers per death · Fear drives funding` },
    { id: find('west-nile-virus'), caption: `West Nile Virus · ${ratioStr(ppd(d('west-nile-virus')))} papers per death · Heavily studied, rarely fatal` },
    // Trending
    { id: find('nafld'), caption: `Fatty Liver Disease · ${cap(trendLabel(d('nafld').trend))} · Fastest growing liver disease` },
    { id: find('myocarditis'), caption: `Myocarditis · ${cap(trendLabel(d('myocarditis').trend))} · Heart inflammation gaining attention` },
    { id: find('dengue'), caption: `Dengue · ${cap(trendLabel(d('dengue').trend))} · Half the world at risk` },
    // Declining research
    { id: find('covid-19'), caption: `COVID-19 · ${fmtFull(d('covid-19').papers)} papers · ${cap(trendLabel(d('covid-19').trend))} when the pandemic began` },
    { id: find('rotavirus'), caption: `Rotavirus · ${fmtFull(d('rotavirus').mortality)} child deaths/yr · ${cap(trendLabel(d('rotavirus').trend))} despite mortality` },
    // Zero mortality, high impact
    { id: find('depression'), caption: `Depression · ${fmtFull(d('depression').papers)} papers · Zero mortality metric, massive burden` },
    { id: find('obesity'), caption: `Obesity · ${fmtFull(d('obesity').papers)} papers · Affects 1 billion people worldwide` },
    // Unique story
    { id: find('malaria'), caption: `Malaria · ${fmtWord(d('malaria').mortality)} deaths/yr · 94% of deaths in Africa` },
  ].filter((s) => s.id !== undefined);

  // Shuffle
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  return list;
}

export default function Spotlight() {
  const stateRef = useRef({ timer: null, list: null, step: 0 });

  useEffect(() => {
    const unsub = useStore.subscribe(
      (s) => s.spotlightActive,
      (active) => {
        const sr = stateRef.current;
        if (useStore.getState().roulettePhase !== 'idle') return;
        if (useStore.getState().overtureActive) return;

        if (active) {
          const { idMap, diseases } = useStore.getState();
          const list = buildSpotlightList(idMap, diseases);
          if (list.length === 0) return;

          sr.list = list;
          sr.step = 0;

          // Show first immediately
          useStore.getState().setSpotlightCaption(list[0].caption);
          useStore.getState().selectDisease(list[0].id);
          sr.step = 1;

          // Cycle every 6s
          sr.timer = setInterval(() => {
            const idx = sr.step % sr.list.length;
            useStore.getState().setSpotlightCaption(sr.list[idx].caption);
            useStore.getState().selectDisease(sr.list[idx].id);
            sr.step++;
          }, 6000);
        } else {
          // Stop
          if (sr.timer) {
            clearInterval(sr.timer);
            sr.timer = null;
          }
          useStore.getState().setSpotlightCaption('');
          useStore.getState().deselect();
          sr.list = null;
          sr.step = 0;
        }
      }
    );

    return () => {
      unsub();
      const sr = stateRef.current;
      if (sr.timer) clearInterval(sr.timer);
    };
  }, []);

  return null;
}
