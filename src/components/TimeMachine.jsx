import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import useStore from '../store';
import { nR, nRM } from '../utils/helpers';
import { sceneRefs } from '../sceneRefs';
import { buildTimeMachineData } from '../utils/timeMachineData';

// Critically damped spring (damping ratio 1) with a 120ms time constant:
// v += (k*(target-x) - c*v)*dt; x += v*dt, where k = (1/tau)^2, c = 2/tau.
const TAU = 0.12;
const OMEGA = 1 / TAU;
const SPRING_K = OMEGA * OMEGA;
const SPRING_C = 2 * OMEGA;

// Exit blend duration: how long `tm.exit` takes to ramp 0->1 after
// stopTimeMachine(), mixing the last Time Machine radius toward the normal
// papers/mortality radius before DiseaseNodes stops calling radiusAt at all.
const EXIT_DUR = 0.4;

// Null-rendering engine half of the Time Machine. Owns `sceneRefs.tm`, the
// interface DiseaseNodes' render loop already guards on (Task 9):
//   { active: bool, yearFloat: number, targetYear: number, data, radiusAt(i), exit: number }
export default function TimeMachine() {
  const tmRef = useRef(null);
  const velRef = useRef(0);

  if (!tmRef.current) {
    const diseases = useStore.getState().diseases;
    const count = diseases.length;
    const data = buildTimeMachineData(diseases);
    const lastYear = data.nYears - 1;

    const tm = {
      active: false,
      yearFloat: lastYear,
      targetYear: lastYear,
      data,
      exit: 0,
      radiusAt: null,
    };

    // radiusAt(i): DiseaseNodes calls this with only the instance index (its
    // existing call site is `tm.radiusAt(i)`), so the exit-blend fallback —
    // mixing toward the normal morph radius — is computed in here, reading
    // sizeMode/fx.morphOverride directly rather than depending on DiseaseNodes'
    // own smoothed morph state (which this component has no access to).
    tm.radiusAt = (i) => {
      const { radii, nYears } = tm.data;
      const yf = tm.yearFloat < 0 ? 0 : (tm.yearFloat > nYears - 1 ? nYears - 1 : tm.yearFloat);
      const y0 = Math.floor(yf);
      const y1 = y0 + 1 < nYears ? y0 + 1 : y0;
      const frac = yf - y0;
      const r0 = radii[y0 * count + i];
      const r1 = radii[y1 * count + i];
      const tmR = r0 + (r1 - r0) * frac;
      if (tm.exit <= 0) return tmR;

      const store = useStore.getState();
      const fx = sceneRefs.fx;
      const morphT = fx.morphOverride != null ? fx.morphOverride : (store.sizeMode === 'mortality' ? 1 : 0);
      const ease = morphT * morphT * (3 - 2 * morphT); // smoothstep, same curve DiseaseNodes uses
      const d = store.diseases[i];
      const normalR = nR(d.papers) * (1 - ease) + nRM(d.mortality) * ease;
      return tmR + (normalR - tmR) * tm.exit;
    };

    tmRef.current = tm;
    sceneRefs.tm = tm;
    if (typeof window !== 'undefined') window.__tm = tm;
  }

  useFrame((state, delta) => {
    const tm = tmRef.current;
    const dt = delta > 0.05 ? 0.05 : delta; // clamp so a stalled tab doesn't fling the spring
    const tmPhase = useStore.getState().tmPhase;
    const maxY = tm.data.nYears - 1;

    if (tmPhase === 'scrub') {
      tm.active = true;
      tm.exit = 0;
      const target = tm.targetYear < 0 ? 0 : (tm.targetYear > maxY ? maxY : tm.targetYear);
      const v = velRef.current + (SPRING_K * (target - tm.yearFloat) - SPRING_C * velRef.current) * dt;
      velRef.current = v;
      tm.yearFloat += v * dt;
      if (tm.yearFloat < 0) tm.yearFloat = 0;
      if (tm.yearFloat > maxY) tm.yearFloat = maxY;
    } else if (tmPhase === 'tour') {
      // Task 13's script drives yearFloat/targetYear directly; this engine
      // just keeps the node radii live while it does.
      tm.active = true;
      tm.exit = 0;
      velRef.current = 0;
    } else if (tm.active) {
      // idle, but still blending out: ramp the 400ms exit mix, then hand
      // radius fully back to DiseaseNodes' own morph.
      velRef.current = 0;
      tm.exit += dt / EXIT_DUR;
      if (tm.exit >= 1) {
        tm.exit = 0;
        tm.active = false;
      }
    }
  });

  return null;
}
