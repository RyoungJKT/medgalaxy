import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CFG, TIER } from '../utils/tiers';
import { sceneRefs } from '../sceneRefs';
import { ASM } from '../utils/assembly';
import { AMBIENT } from '../utils/motion';

// ADDENDUM 1 section 4 item 2: star parallax, three shells. One flat shell at
// 4x camDist turning at one rate is a turntable; three shells at 2.8 / 4.0 /
// 6.2x camDist turning at 0.00090 / 0.00040 / 0.00015 rad/s make depth readable
// from motion alone, which is what makes an orbit feel like space. The near
// shell sweeps visibly across the far one on any camera move the viewer makes
// themselves — that differential IS the parallax, and it costs two extra draw
// calls of points on HIGH.
const S = AMBIENT.stars;

// HIGH's twinkle. `pointsMaterial`'s own size attenuation is
// `size * (scale / -mvPosition.z)` with `scale = 0.5 * viewportHeight`, so the
// shader reproduces it exactly and a tier switch is not a size change.
const TWINKLE_VERT = `
attribute float aPhase;
attribute float aRate;
uniform float uSize;
uniform float uScale;
uniform float uTime;
varying float vTw;
void main() {
  vTw = 0.5 + 0.5 * sin(uTime * aRate + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const TWINKLE_FRAG = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uLo;
varying float vTw;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(uColor, uOpacity * mix(uLo, 1.0, vTw));
}`;

const BASE_OPACITY = 0.6;

export default function BackgroundParticles({ camDist }) {
  const count = CFG.particles;
  const groupRef = useRef();
  const shellRefs = [useRef(), useRef(), useRef()];
  // Beat 0's dust settle (ADDENDUM 1 section 3, HIGH only): the whole volume
  // moves with the streams instead of sitting still behind them. Zero new
  // objects — the drift is the existing group's scale and the bump is its
  // existing rotation rate.
  const dust = useRef({ t: null });

  // Per-shell geometry. The counts are CFG.particles split 0.30 / 0.45 / 0.25,
  // with the remainder pushed into the last shell so the tier's own budget is
  // spent exactly and never exceeded.
  const shells = useMemo(() => {
    if (count === 0) return [];
    const out = [];
    let spent = 0;
    for (let s = 0; s < 3; s++) {
      const n = s === 2 ? count - spent : Math.round(count * S.split[s]);
      spent += n;
      const pos = new Float32Array(n * 3);
      const phase = new Float32Array(n);
      const rate = new Float32Array(n);
      const r0 = camDist * S.radii[s];
      for (let i = 0; i < n; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r = r0 * (1 + (Math.random() * 2 - 1) * S.jitter);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        pos[i * 3 + 2] = r * Math.cos(ph);
        phase[i] = Math.random() * Math.PI * 2;
        rate[i] = 0.35 + Math.random() * 0.9;
      }
      out.push({ n, pos, phase, rate, size: S.sizes[s], color: S.colors[s], spin: S.rates[s] });
    }
    return out;
  }, [count, camDist]);

  // HIGH's twinkle materials, one per shell (each owns its color and size).
  const mats = useMemo(() => {
    if (TIER !== 'HIGH') return null;
    return shells.map((sh) => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: sh.size },
        uScale: { value: 450 },
        uColor: { value: new THREE.Color(sh.color) },
        uOpacity: { value: BASE_OPACITY },
        uLo: { value: S.twinkle[0] },
      },
      vertexShader: TWINKLE_VERT,
      fragmentShader: TWINKLE_FRAG,
      transparent: true,
      depthWrite: false,
    }));
  }, [shells]);

  useEffect(() => () => { if (mats) mats.forEach((m) => m.dispose()); }, [mats]);

  // The harness reads the shells straight off the scene (radii, counts, sizes,
  // and the projected travel of a sample point per shell during an orbit).
  useEffect(() => {
    sceneRefs.starShells = shellRefs.map((r) => r.current).filter(Boolean);
    return () => { sceneRefs.starShells = null; };
  }, [shells]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // "The existing background particles drift inward by 3 percent of their
    // radius over the 5.2 s with a 0.4 percent per second rotation bump, easing
    // back to the resting rate by 5.6 s." A uniform inward drift of every
    // particle by a fraction of its own radius is exactly a scale on the shells
    // they already live in, which is why this costs nothing.
    let spin = 1;
    if (TIER === 'HIGH') {
      const d = dust.current;
      const asm = sceneRefs.assembly;
      // While beat 0 is live the dust rides the assembly's own clock, so a
      // harness seek settles the volume to the same place it would have been;
      // afterwards it carries on alone for the 400 ms ease-out.
      if (asm && asm.active) d.t = asm.t;
      else if (d.t != null && d.t < ASM.dustSettle) {
        d.t = Math.min(ASM.dustSettle, d.t + Math.min(delta, 0.05));
      }
      if (d.t != null) {
        const e = -(Math.cos(Math.PI * Math.min(1, d.t / ASM.total)) - 1) / 2; // sine.inOut
        const s = 1 - ASM.dustDrift * e;
        g.scale.set(s, s, s);
        const decay = d.t <= ASM.total
          ? 1
          : Math.max(0, 1 - (d.t - ASM.total) / (ASM.dustSettle - ASM.total));
        spin = 1 + ASM.dustSpin * Math.min(d.t, ASM.total) * decay;
      }
    }

    // Three rates, in rad/s off the frame's own delta rather than per-frame
    // increments, so the parallax is the same on a 60 Hz and a 120 Hz display.
    const dt = delta > 0.05 ? 0.05 : delta;
    for (let s = 0; s < shells.length; s++) {
      const sh = shellRefs[s].current;
      if (sh) sh.rotation.y += shells[s].spin * spin * dt;
    }
    if (mats) {
      const t = state.clock.getElapsedTime();
      const scale = state.size.height * 0.5 * state.gl.getPixelRatio();
      for (let i = 0; i < mats.length; i++) {
        mats[i].uniforms.uTime.value = t;
        mats[i].uniforms.uScale.value = scale;
      }
    }
  });

  if (!shells.length) return null;

  return (
    <group ref={groupRef}>
      {shells.map((sh, s) => (
        <group key={s} ref={shellRefs[s]}>
          <points material={mats ? mats[s] : undefined}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={sh.n} array={sh.pos} itemSize={3} />
              {mats && (
                <bufferAttribute attach="attributes-aPhase" count={sh.n} array={sh.phase} itemSize={1} />
              )}
              {mats && (
                <bufferAttribute attach="attributes-aRate" count={sh.n} array={sh.rate} itemSize={1} />
              )}
            </bufferGeometry>
            {!mats && (
              <pointsMaterial color={sh.color} size={sh.size} transparent opacity={BASE_OPACITY} />
            )}
          </points>
        </group>
      ))}
    </group>
  );
}
