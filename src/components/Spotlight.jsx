import { useEffect, useRef } from 'react';
import useStore from '../store';

// ─── Curated spotlight list ──────────────────────────────────────────────────
function buildSpotlightList(idMap) {
  const find = (id) => idMap[id];
  const list = [
    // Most researched
    { id: find('breast-cancer'), caption: 'Breast Cancer \u00b7 430K papers \u00b7 Most researched cancer' },
    { id: find('heart-disease'), caption: 'Heart Disease \u00b7 9.1M deaths/yr \u00b7 #1 killer globally' },
    { id: find('type-2-diabetes'), caption: 'Type 2 Diabetes \u00b7 380K papers \u00b7 1.6M deaths/yr' },
    { id: find('hiv-aids'), caption: 'HIV/AIDS \u00b7 350K papers \u00b7 Reshaped modern medicine' },
    { id: find('lung-cancer'), caption: 'Lung Cancer \u00b7 1.8M deaths/yr \u00b7 Deadliest cancer' },
    // Most deadly
    { id: find('sepsis'), caption: 'Sepsis \u00b7 11M deaths/yr but only 95K papers \u00b7 115 deaths per paper' },
    { id: find('stroke'), caption: 'Stroke \u00b7 7.3M deaths/yr \u00b7 Every 3 seconds someone has one' },
    { id: find('copd'), caption: 'COPD \u00b7 3.5M deaths/yr \u00b7 41 deaths per paper published' },
    { id: find('pneumonia'), caption: 'Pneumonia \u00b7 2.2M deaths/yr \u00b7 Leading killer of children' },
    { id: find('alzheimers-disease'), caption: "Alzheimer's \u00b7 1.9M deaths/yr \u00b7 Research surging +6%" },
    // Most neglected
    { id: find('rheumatic-heart-disease'), caption: 'Rheumatic Heart Disease \u00b7 373K deaths, only 9K papers \u00b7 41 deaths per paper' },
    { id: find('norovirus'), caption: "Norovirus \u00b7 200K deaths/yr \u00b7 World's most common stomach bug" },
    { id: find('sickle-cell-disease'), caption: 'Sickle Cell \u00b7 376K deaths/yr \u00b7 Most common genetic disease in Africa' },
    { id: find('hepatitis-b'), caption: 'Hepatitis B \u00b7 1.1M deaths/yr \u00b7 15 deaths for every paper' },
    // Most researched per death
    { id: find('cystic-fibrosis'), caption: 'Cystic Fibrosis \u00b7 48 papers per death \u00b7 Most researched per capita' },
    { id: find('ebola'), caption: 'Ebola \u00b7 40 papers per death \u00b7 Fear drives funding' },
    { id: find('west-nile-virus'), caption: 'West Nile Virus \u00b7 45 papers per death \u00b7 Heavily studied, rarely fatal' },
    // Trending
    { id: find('nafld'), caption: 'Fatty Liver Disease \u00b7 Research up 15% \u00b7 Fastest growing liver disease' },
    { id: find('myocarditis'), caption: 'Myocarditis \u00b7 Research up 10% \u00b7 Heart inflammation gaining attention' },
    { id: find('dengue'), caption: 'Dengue \u00b7 Research up 12% \u00b7 Half the world at risk' },
    // Declining research
    { id: find('covid-19'), caption: 'COVID-19 \u00b7 300K papers \u00b7 Research declining 10% as pandemic fades' },
    { id: find('rotavirus'), caption: 'Rotavirus \u00b7 200K child deaths/yr \u00b7 Research declining despite mortality' },
    // Zero mortality, high impact
    { id: find('depression'), caption: 'Depression \u00b7 280K papers \u00b7 Zero mortality metric, massive burden' },
    { id: find('obesity'), caption: 'Obesity \u00b7 200K papers \u00b7 Affects 1 billion people worldwide' },
    // Unique story
    { id: find('malaria'), caption: 'Malaria \u00b7 608K deaths/yr \u00b7 94% of deaths in Africa' },
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

        if (active) {
          const { idMap } = useStore.getState();
          const list = buildSpotlightList(idMap);
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
