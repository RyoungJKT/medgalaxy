# medgalaxy-next — shaders / postfx / tiers map

Repo root: `/Users/darwin/Documents/Claude/medgalaxy-next`. Active entry is `src/main.jsx` → `src/App.jsx` (src/main.jsx:3-10); `src/MedGalaxy.jsx` is a legacy monolith NOT imported anywhere in the active tree (grep of main.jsx/App.jsx shows no `MedGalaxy` import).

---

## 1. Shader sources (verbatim, full)

### src/shaders/plasma.frag.glsl:1-125

```glsl
// src/shaders/plasma.frag.glsl:1-125
uniform float time;
uniform float usePlasma;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal, vObjPos;
varying float vPhase, vFogDepth, vCatId;

// ── Tuning constants ──
const vec3  KEY_DIR    = normalize(vec3(0.6, 0.8, 0.5));
const float KEY_INT    = 1.0;
const float FILL_INT   = 0.18;
const float AMB_INT    = 0.12;
const float SPEC_POW   = 32.0;
const float SPEC_INT   = 0.25;
const float FRESNEL_POW = 3.5;
const float FRESNEL_INT = 0.3;
const float PLASMA_MIX  = 0.55;
const float SSS_INT     = 0.12;
const float CRATER_DEPTH = 0.35;                             // crater shadow depth
const float CRATER_SCALE = 5.5;                              // crater density

// ── Noise ──
float hash(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
float nse(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 2; i++){ v += a * nse(p); p *= 2.1; a *= 0.48; } return v; }

// ── Voronoi for craters ──
vec2 voronoi(vec3 p) {
  vec3 b = floor(p);
  vec3 f = fract(p);
  float d1 = 1.0, d2 = 1.0;
  for(int x = -1; x <= 1; x++)
  for(int y = -1; y <= 1; y++)
  for(int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(b + g), hash(b + g + 31.7), hash(b + g + 67.3));
    vec3 diff = g + o - f;
    float dist = dot(diff, diff);
    if(dist < d1) { d2 = d1; d1 = dist; }
    else if(dist < d2) { d2 = dist; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

void main(){
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vViewPos);
  float NdotV = max(dot(vNormal, V), 0.0);

  // ── 1. Crater texture + bump normal (HIGH tier only) ──
  vec3 bumpN = N;
  float craterBowl = 1.0;
  if (usePlasma > 0.5) {
    vec3 objN = normalize(vObjPos);
    vec3 phaseOff = vec3(vPhase * 10.0);
    vec3 cp1 = objN * CRATER_SCALE + phaseOff;
    vec2 vor1 = voronoi(cp1);
    craterBowl = smoothstep(0.0, 0.45, vor1.x);

    // Bump-map normal from finite differences
    float eps = 0.02;
    float hC = vor1.x;
    float hX = voronoi(cp1 + vec3(eps, 0.0, 0.0)).x;
    float hY = voronoi(cp1 + vec3(0.0, eps, 0.0)).x;
    float hZ = voronoi(cp1 + vec3(0.0, 0.0, eps)).x;
    vec3 grad = vec3(hX - hC, hY - hC, hZ - hC) / eps;
    bumpN = normalize(N - grad * 0.35);
  }

  // ── 2. Directional lighting ──
  float NdotL = max(dot(bumpN, KEY_DIR), 0.0);
  float wrap = max(dot(bumpN, KEY_DIR) * 0.5 + 0.5, 0.0);
  float key = pow(wrap, 1.3) * KEY_INT;
  float fill = max(dot(bumpN, -KEY_DIR) * 0.5 + 0.5, 0.0) * FILL_INT;
  float diffuse = (key + fill + AMB_INT) * mix(1.0 - CRATER_DEPTH, 1.0, craterBowl);

  // ── 3. Specular ──
  vec3 H = normalize(KEY_DIR + V);
  float NdotH = max(dot(bumpN, H), 0.0);
  float spec = pow(NdotH, SPEC_POW) * SPEC_INT * NdotL;
  vec3 specCol = mix(vColor, vec3(1.0), 0.3) * spec;

  // ── 4. Fresnel rim ──
  float fresnel = pow(1.0 - NdotV, FRESNEL_POW) * FRESNEL_INT;

  // ── 5. Subsurface scattering ──
  float sss = pow(max(dot(V, -KEY_DIR), 0.0), 2.0) * SSS_INT * (1.0 - NdotV);

  // ── 6. Surface texture ──
  vec3 baseCol = vColor * diffuse;
  vec3 col = baseCol;

  // Static FBM rocky bump (no time cost). TO DISABLE: change `true` to `false`
  if (true) {
    vec3 bp = normalize(vObjPos) * 4.0 + vec3(vPhase * 10.0);
    float bump = fbm(bp) * 0.5 + fbm(bp * 2.5) * 0.25;
    col = col * (0.85 + bump * 0.35);
  }

  // Animated plasma (HIGH tier). TO ENABLE: change `false` to `usePlasma > 0.5`
  if (false) {
    vec3 np = vWorldPos * 1.8 + vec3(time * 0.35 + vPhase);
    float plasma = fbm(np) + fbm(np * 1.5 + vec3(0.0, time * 0.25, 0.0));
    plasma = pow(plasma * 0.5, 0.7);
    col = mix(col, col * (0.7 + plasma * 0.6), PLASMA_MIX);
  }

  col += specCol;
  col += vColor * fresnel;
  col += vColor * sss;

  // ── 7. Atmospheric fog ──
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  float alpha = mix(0.82, 0.97, NdotV);
  alpha = mix(alpha, 0.1, fogFactor * 0.5);

  col = min(col, vColor * 1.15);

  gl_FragColor = vec4(col, alpha);
}
```

Note: the animated-plasma branch is compiled out (`if (false)` at plasma.frag.glsl:103); the crater/bump branch is gated at runtime by `usePlasma` (plasma.frag.glsl:55); the static FBM rocky bump is hardcoded on (`if (true)` at plasma.frag.glsl:96). `time` and `vCatId` are declared but only consumed by the dead plasma branch / not at all, respectively.

### src/shaders/plasma.vert.glsl:1-31

```glsl
// src/shaders/plasma.vert.glsl:1-31
attribute float aPhase;
attribute float aCatId;
varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal, vObjPos;
varying float vPhase, vFogDepth, vCatId;

void main(){
  vPhase = aPhase;
  vCatId = aCatId;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  vObjPos = position;  // raw unit-sphere vertex
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorldPos = (modelMatrix * wp).xyz;
  vec4 mv = modelViewMatrix * wp;
  vViewPos = mv.xyz;
  vec3 tn = normal;
  #ifdef USE_INSTANCING
    tn = mat3(instanceMatrix) * tn;
  #endif
  vWorldNormal = normalize(mat3(modelMatrix) * tn);
  vNormal = normalize(normalMatrix * tn);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
```

### src/shaders/pulse.frag.glsl:1-72

```glsl
// src/shaders/pulse.frag.glsl:1-72
uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal;
varying float vPhase, vFogDepth, vCatId;

// ── Tuning constants (matched to plasma shader) ──
const vec3  KEY_DIR    = normalize(vec3(0.6, 0.8, 0.5));
const float KEY_INT    = 1.0;
const float FILL_INT   = 0.18;
const float AMB_INT    = 0.12;
const float SPEC_POW   = 32.0;
const float SPEC_INT   = 0.25;
const float FRESNEL_POW = 3.5;
const float FRESNEL_INT = 0.3;
const float PULSE_MIX   = 0.2;
const float SSS_INT     = 0.12;

void main(){
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vViewPos);
  float NdotV = max(dot(vNormal, V), 0.0);

  // ── 1. Directional lighting ──
  float wrap = max(dot(N, KEY_DIR) * 0.5 + 0.5, 0.0);
  float NdotL = max(dot(N, KEY_DIR), 0.0);
  float key = pow(wrap, 1.3) * KEY_INT;
  float fill = max(dot(N, -KEY_DIR) * 0.5 + 0.5, 0.0) * FILL_INT;
  float diffuse = key + fill + AMB_INT;

  // ── 2. Specular ──
  vec3 H = normalize(KEY_DIR + V);
  float NdotH = max(dot(vNormal, H), 0.0);
  float spec = pow(NdotH, SPEC_POW) * SPEC_INT * NdotL;
  vec3 specCol = mix(vColor, vec3(1.0), 0.3) * spec;

  // ── 3. Fresnel rim ──
  float fresnel = pow(1.0 - NdotV, FRESNEL_POW) * FRESNEL_INT;

  // ── 4. Subsurface scattering ──
  float sss = pow(max(dot(V, -KEY_DIR), 0.0), 2.0) * SSS_INT * (1.0 - NdotV);

  // ── 5. Pulse rings (secondary surface effect) ──
  float lat = asin(clamp(N.y, -1.0, 1.0));
  float ring = lat * 3.0 - time * 2.5 - vPhase;
  float pulse = 0.5 + 0.5 * sin(ring);
  pulse = pow(pulse, 3.0);
  float breath = 0.5 + 0.5 * sin(time * 1.2 + vPhase);

  // Pulse modulates diffuse subtly
  vec3 baseCol = vColor * diffuse;
  vec3 col = mix(baseCol, baseCol * (0.8 + pulse * 0.5 * breath), PULSE_MIX);

  // Add specular, rim, SSS
  col += specCol;
  col += vColor * fresnel;
  col += vColor * sss;

  // ── 6. Atmospheric fog ──
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  float alpha = mix(0.82, 0.97, NdotV);
  alpha = mix(alpha, 0.1, fogFactor * 0.5);

  col = min(col, vColor * 1.15);

  gl_FragColor = vec4(col, alpha);
}
```

### src/shaders/pulse.vert.glsl:1-30

```glsl
// src/shaders/pulse.vert.glsl:1-30
attribute float aPhase;
attribute float aCatId;
varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal;
varying float vPhase, vFogDepth, vCatId;

void main(){
  vPhase = aPhase;
  vCatId = aCatId;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorldPos = (modelMatrix * wp).xyz;
  vec4 mv = modelViewMatrix * wp;
  vViewPos = mv.xyz;
  vec3 tn = normal;
  #ifdef USE_INSTANCING
    tn = mat3(instanceMatrix) * tn;
  #endif
  vWorldNormal = normalize(mat3(modelMatrix) * tn);
  vNormal = normalize(normalMatrix * tn);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
```

### src/shaders/edge.frag.glsl:1-39

```glsl
// src/shaders/edge.frag.glsl:1-39
uniform float time;

varying float vT;
varying float vVis;
varying float vPhase;
varying vec3  vColor;

void main(){
  // Hidden when inactive, visible when active
  if (vVis < 0.01) discard;
  float baseAlpha = mix(0.1, 0.35, vVis);

  // Taper alpha: fade at endpoints for soft falloff
  float taper = sin(vT * 3.14159);
  baseAlpha *= mix(0.3, 1.0, taper);

  // Traveling pulse — only on active edges
  float pulseT = fract(time * 0.25 + vPhase);
  // Wrap-aware distance for smooth looping
  float dist = min(abs(vT - pulseT), min(abs(vT - pulseT + 1.0), abs(vT - pulseT - 1.0)));
  float pulse = exp(-dist * dist * 80.0);

  // Second counter-pulse for visual richness
  float pulseT2 = fract(time * 0.18 + vPhase + 0.5);
  float dist2 = min(abs(vT - pulseT2), min(abs(vT - pulseT2 + 1.0), abs(vT - pulseT2 - 1.0)));
  float pulse2 = exp(-dist2 * dist2 * 120.0) * 0.5;

  float totalPulse = (pulse + pulse2) * vVis;

  // Final color: muted base + bright pulse
  vec3 col = vColor * (0.6 + 0.4 * taper);
  col += vColor * totalPulse * 2.0;

  float alpha = baseAlpha + totalPulse * 0.6;
  alpha = clamp(alpha, 0.0, 0.9);

  gl_FragColor = vec4(col, alpha);
}
```

### src/shaders/edge.vert.glsl:1-24

```glsl
// src/shaders/edge.vert.glsl:1-24
attribute float aT;       // 0..1 along curve
attribute float aVis;     // visibility (0 = hidden, 1 = active)
attribute float aPhase;   // per-edge random phase for pulse offset

varying float vT;
varying float vVis;
varying float vPhase;
varying vec3  vColor;

void main(){
  vT     = aT;
  vVis   = aVis;
  vPhase = aPhase;

  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = color;
  #endif

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
```

### Inline ripple shaders — src/components/SelectionRipple.jsx:12-31

```glsl
// src/components/SelectionRipple.jsx:12-31 (JS template literals)
const rippleVert = `
  varying float vEdge;
  void main() {
    vEdge = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const rippleFrag = `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vEdge;
  void main() {
    // Soft falloff from center of ring width
    float edge = abs(vEdge - 0.5) * 2.0;
    float a = uAlpha * (1.0 - edge * edge);
    if (a < 0.005) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;
```

---

## 2. ShaderMaterial constructions + uniform ownership

### Node materials — src/components/DiseaseNodes.jsx

Shaders imported via Vite `?raw` (src/components/DiseaseNodes.jsx:10-13). `mobDevice = TIER === 'LOW'` (src/components/DiseaseNodes.jsx:29).

```jsx
// src/components/DiseaseNodes.jsx:95-126
  const fogUniforms = useMemo(() => ({
    fogColor: { value: new THREE.Color(0x000000) },
    fogNear: { value: 400.0 },
    fogFar: { value: 2000.0 },
  }), []);

  const plasmaMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, usePlasma: { value: TIER === 'HIGH' ? 1.0 : 0.0 }, ...fogUniforms },
      vertexShader: plasmaVert,
      fragmentShader: plasmaFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const pulseMat = useMemo(() => {
    if (mobDevice) return null;
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, ...fogUniforms },
      vertexShader: pulseVert,
      fragmentShader: pulseFrag,
      transparent: true,
    });
  }, [mobDevice, fogUniforms]);

  const fallbackMat = useMemo(() => {
    if (!mobDevice) return null;
    return new THREE.MeshPhongMaterial({ transparent: true, opacity: 1.0, shininess: 90, specular: new THREE.Color(0x444444) });
  }, [mobDevice]);

  const mat = mobDevice ? fallbackMat : (shaderMode === 'pulse' ? pulseMat : plasmaMat);
```

Uniform sets and updaters:

| Material | Uniform | Initial value | Updated by |
|---|---|---|---|
| plasmaMat | `time` | 0 | per-frame `mat.uniforms.time.value = state.clock.getElapsedTime()` — only on the currently active `mat` (src/components/DiseaseNodes.jsx:180-182) |
| plasmaMat | `usePlasma` | `TIER === 'HIGH' ? 1.0 : 0.0` | never updated after construction (src/components/DiseaseNodes.jsx:104) |
| plasmaMat / pulseMat | `fogColor` | `Color(0x000000)` | never updated (src/components/DiseaseNodes.jsx:96) |
| plasmaMat / pulseMat | `fogNear` / `fogFar` | 400 / 2000 | once in useEffect from `rawMax`: `near = rawMax * 0.6`, `far = rawMax * 3.0` (src/components/DiseaseNodes.jsx:157-170). Note `fogUniforms` objects are spread into both materials, so both share the same uniform objects. |
| pulseMat | `time` | 0 | same per-frame block, only when it is the active `mat` (src/components/DiseaseNodes.jsx:180-182) |

Per-frame time update + material selection excerpt:

```jsx
// src/components/DiseaseNodes.jsx:173-182
  useFrame((state) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const store = useStore.getState();
    const curPos = store.curPos;
    const sizeMode = store.sizeMode;

    if (mat.uniforms) {
      mat.uniforms.time.value = state.clock.getElapsedTime();
    }
```

The instanced mesh (keyed by shaderMode so material swaps remount it):

```jsx
// src/components/DiseaseNodes.jsx:259-268
  return (
    <instancedMesh
      key={shaderMode}
      ref={meshRef}
      args={[geo, mat, count]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    />
  );
```

Geometry attributes feeding the vert shaders — sphere is 16-seg on LOW, 32-seg otherwise; `aPhase` (random 0..2π) and `aCatId` are InstancedBufferAttributes (src/components/DiseaseNodes.jsx:82-93):

```jsx
// src/components/DiseaseNodes.jsx:82-93
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, mobDevice ? 16 : 32, mobDevice ? 16 : 32);
    const phases = new Float32Array(count);
    const catIds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() * Math.PI * 2;
      catIds[i] = CAT_INDEX[diseases[i].category] || 0;
    }
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    g.setAttribute('aCatId', new THREE.InstancedBufferAttribute(catIds, 1));
    return g;
  }, [count, mobDevice, diseases]);
```

`vColor` comes from `instanceColor`, seeded per instance with category color `CC[diseases[i].category]` via `setColorAt` (src/components/DiseaseNodes.jsx:149-152); instance colors are subsequently rewritten by HighlightSystem (`setColorAt` at src/components/HighlightSystem.jsx:142, `instanceColor.needsUpdate` at :177) and by AttentionMap's `useAttentionColors` (src/components/AttentionMap.jsx:34-37, 65-68). `shaderMode` store state: default `'plasma'`, values `'plasma' | 'pulse'` (src/store.js:51), setter `setShaderMode` (src/store.js:119), toggled from the Header UI (src/components/ui/Header.jsx:57-69, 191-192).

### Edge material — src/components/EdgeNetwork.jsx

```jsx
// src/components/EdgeNetwork.jsx:146-156
  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: edgeVert,
      fragmentShader: edgeFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
  }, []);
```

- `time` updated per frame: `mat.uniforms.time.value = state.clock.getElapsedTime()` (src/components/EdgeNetwork.jsx:188). `mat.opacity` also lerped per frame for intro fade (src/components/EdgeNetwork.jsx:182-186) though the ShaderMaterial fragment does not read a uniform for it (only `mesh.visible` gating matters).
- Attributes: `position`, `color` (non-indexed vertex colors → `vColor` via the `#else color` branch of edge.vert.glsl:18), `aT`, `aVis`, `aPhase` built in src/components/EdgeNetwork.jsx:95-144. `aVis` written externally by HighlightSystem through `sceneRefs.edgeMesh` / `sceneRefs.edgeMeta` (exposed at src/components/EdgeNetwork.jsx:159-168).
- Mesh: `<mesh ref={meshRef} geometry={geo} material={mat} renderOrder={-1} />` (src/components/EdgeNetwork.jsx:257).

### Ripple material — src/components/SelectionRipple.jsx

```jsx
// src/components/SelectionRipple.jsx:75-86
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffffff') },
      uAlpha: { value: 0 },
    },
    vertexShader: rippleVert,
    fragmentShader: rippleFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
```

- `uColor` set on selection-change subscription: `mat.uniforms.uColor.value.set(CC[disease.category])` (src/components/SelectionRipple.jsx:101).
- `uAlpha` per frame while ripple active: `mat.uniforms.uAlpha.value = (1 - p * p) * 0.7` (src/components/SelectionRipple.jsx:146).

---

## 3. Tier config — src/utils/tiers.js (verbatim, full)

```js
// src/utils/tiers.js:1-13
export const TC = {
  HIGH:  { dprCap: 1.5, particles: 400, glowAll: true, pulse: true },
  MEDIUM:{ dprCap: 1.5, particles: 150, glowAll: false, pulse: true },
  LOW:   { dprCap: 1, particles: 0, glowAll: false, pulse: false },
};
export function detectTier() {
  if (typeof window === 'undefined') return 'HIGH';
  if (matchMedia('(pointer:coarse)').matches || window.innerWidth < 768) return 'LOW';
  return window.innerWidth < 1200 ? 'MEDIUM' : 'HIGH';
}
export const TIER = detectTier();
export const CFG = TC[TIER];
```

| Field | HIGH | MEDIUM | LOW |
|---|---|---|---|
| dprCap | 1.5 | 1.5 | 1 |
| particles | 400 | 150 | 0 |
| glowAll | true | false | false |
| pulse | true | true | false |

Detection: SSR → HIGH; coarse pointer OR width < 768 → LOW; width < 1200 → MEDIUM; else HIGH. Module-level constant, evaluated once at import (src/utils/tiers.js:6-12).

Tier-derived constants elsewhere (all cited):
- `MAX_BOKEH = TIER === 'HIGH' ? 3.0 : 2.0`; `DOF_RES_SCALE = TIER === 'HIGH' ? 0.667 : 0.5` (src/components/SelectionDOF.jsx:12-14)
- `usePlasma` uniform `= TIER === 'HIGH' ? 1.0 : 0.0` (src/components/DiseaseNodes.jsx:104)
- sphere segments 16 vs 32; Phong fallback when LOW (src/components/DiseaseNodes.jsx:83, 121-124)
- `PARTICLE_COUNT = TIER === 'HIGH' ? 200 : TIER === 'MEDIUM' ? 100 : 0` (src/components/SupernovaDust.jsx:9)
- `TREMBLE_FRACTION = TIER === 'LOW' ? 0.12 : 0.25` (src/components/SupernovaReveal.jsx:15)
- `N_CAP = TIER === 'LOW' ? 5 : TIER === 'MEDIUM' ? 7 : 10` (src/components/GravityLens.jsx:6)
- RouletteDust `DUST_COUNT = TIER === 'LOW' ? 60 : TIER === 'MID' ? 150 : 280` — note comparisons against `'MID'`, a value `detectTier` never returns, so the MID branches are dead (src/components/RouletteDust.jsx:8, 60, 129; same `'MID'` pattern at src/components/GalaxyRoulette.jsx:13-19)
- CameraRig auto-drift gated `if (TIER === 'LOW') return;` (src/components/CameraRig.jsx:143) and `TIER !== 'LOW' && introPhase >= 5` (src/components/CameraRig.jsx:170)
- BackgroundParticles `count = CFG.particles` (src/components/BackgroundParticles.jsx:7)

---

## 4. EffectComposer / postfx — src/components/SelectionDOF.jsx (verbatim, full)

```jsx
// src/components/SelectionDOF.jsx:1-79
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three';
import useStore from '../store';
import { sceneRefs } from '../sceneRefs';
import { TIER } from '../utils/tiers';

const _target = new THREE.Vector3();

// Tier-based bokeh caps
const MAX_BOKEH = TIER === 'HIGH' ? 3.0 : 2.0;
// Render DOF at reduced resolution (half for MEDIUM, two-thirds for HIGH)
const DOF_RES_SCALE = TIER === 'HIGH' ? 0.667 : 0.5;

export default function SelectionDOF() {
  const dofRef = useRef();
  const curBokeh = useRef(0);
  const prevCamRef = useRef({ x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0 });
  const idleFrames = useRef(0);

  if (TIER === 'LOW') return null;

  useFrame(() => {
    const effect = dofRef.current;
    if (!effect) return;

    const { selectedNode, curPos, spotlightActive, flyTarget } = useStore.getState();
    const cam = sceneRefs.camera;

    // Detect camera motion
    if (cam) {
      const p = cam.position;
      const q = cam.quaternion;
      const prev = prevCamRef.current;
      const moved =
        Math.abs(p.x - prev.x) > 0.01 ||
        Math.abs(p.y - prev.y) > 0.01 ||
        Math.abs(p.z - prev.z) > 0.01 ||
        Math.abs(q.x - prev.qx) > 0.0001 ||
        Math.abs(q.y - prev.qy) > 0.0001 ||
        Math.abs(q.z - prev.qz) > 0.0001;
      prev.x = p.x; prev.y = p.y; prev.z = p.z;
      prev.qx = q.x; prev.qy = q.y; prev.qz = q.z;

      if (moved) idleFrames.current = 0;
      else idleFrames.current++;
    }

    // Suppress DOF during motion, fly-to, or spotlight
    const cameraSettled = idleFrames.current > 20;
    const suppress = !cameraSettled || spotlightActive || !!flyTarget;

    if (selectedNode && cam && !suppress) {
      const pos = curPos[selectedNode.index];
      _target.set(pos[0], pos[1], pos[2]);
      if (effect.target) effect.target.copy(_target);
      curBokeh.current += (MAX_BOKEH - curBokeh.current) * 0.06;
    } else {
      curBokeh.current += (0 - curBokeh.current) * 0.1;
    }

    if (curBokeh.current < 0.01) curBokeh.current = 0;
    effect.bokehScale = curBokeh.current;
  });

  return (
    <EffectComposer resolutionScale={DOF_RES_SCALE}>
      <DepthOfField
        ref={dofRef}
        focusDistance={0}
        focalLength={0.04}
        bokehScale={0}
        resolutionScale={DOF_RES_SCALE}
      />
    </EffectComposer>
  );
}
```

Facts:
- Only composer in the active app; single pass: `DepthOfField` from `@react-three/postprocessing` (src/components/SelectionDOF.jsx:3, 68-76). Mounted inside Canvas Suspense (src/App.jsx:174).
- `resolutionScale` on both composer and pass: 0.667 (HIGH) / 0.5 (MEDIUM) (src/components/SelectionDOF.jsx:14, 68, 74).
- LOW tier: component returns null before hooks — no composer at all (src/components/SelectionDOF.jsx:22).
- Enable/disable is via `bokehScale` lerp, not unmounting: lerp up toward MAX_BOKEH at 0.06/frame when a node is selected AND camera idle > 20 frames AND not spotlight AND no flyTarget; lerp down at 0.1/frame otherwise; snapped to 0 below 0.01 (src/components/SelectionDOF.jsx:51-64). DOF focus target = selected node's `curPos`, copied into `effect.target` (src/components/SelectionDOF.jsx:54-57).
- Tone mapping is set on the renderer, not the composer: `toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: mob ? 1.4 : 1.1` in the Canvas `gl` props, alongside `antialias: true, alpha: true`; `dpr={[1, CFG.dprCap]}` (src/App.jsx:126-139). `mob` here is `isMob()` from helpers, not TIER (src/App.jsx:5, 34).

Canvas/lighting excerpt (lights only affect the LOW-tier MeshPhongMaterial path; ShaderMaterials ignore scene lights):

```jsx
// src/App.jsx:126-157
      <Canvas
        dpr={[1, CFG.dprCap]}
        camera={{
          fov: 60,
          near: 1,
          far: camDist * 4,
          position: [0, 0, camDist],
        }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: mob ? 1.4 : 1.1,
        }}
        style={{ background: '#000000' }}
        onCreated={({ gl }) => { sceneRefs.canvasElement = gl.domElement; }}
        onPointerMissed={handlePointerMissed}
      >
        <ambientLight intensity={mob ? 0.6 : 0.3} />
        <pointLight intensity={mob ? 1.2 : 0.6} position={[0, 0, 0]} />
        <directionalLight
          color={mob ? 0xffffff : 0x6699cc}
          intensity={mob ? 1.0 : 0.3}
          position={[-200, 250, 300]}
        />
        {mob && (
          <directionalLight
            color={0xffffff}
            intensity={0.5}
            position={[200, -100, -200]}
          />
        )}
```

### Adaptive DPR (interacts with postfx resolution) — src/components/AdaptiveDpr.jsx:6-48

`REST_DPR = CFG.dprCap`, `MOTION_DPR = 1`, `IDLE_THRESHOLD = 30` frames; drops `gl.setPixelRatio(1)` on camera motion or spotlight, restores `CFG.dprCap` after 30 idle frames (src/components/AdaptiveDpr.jsx:6-8, 33-48). Same motion-detection thresholds as SelectionDOF (0.01 position / 0.0001 quaternion).

---

## 5. GlowSprites material config — src/components/GlowSprites.jsx

Texture: 64x64 canvas radial gradient, white at 0.3 → 0.1 → 0.02 → 0 alpha stops (src/components/GlowSprites.jsx:9-21):

```jsx
// src/components/GlowSprites.jsx:9-21
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
```

Sprite selection: all nodes when `CFG.glowAll` (HIGH), else top-40 by papers (MEDIUM and LOW) (src/components/GlowSprites.jsx:29-38). Material + JSX:

```jsx
// src/components/GlowSprites.jsx:74-97
  return (
    <group ref={groupRef} renderOrder={-2} visible={false}>
      {glowIndices.map(idx => {
        const r = nR(diseases[idx].papers) * 3.5;
        return (
          <sprite
            key={idx}
            ref={el => { if (el) refsMap.current[idx] = el; }}
            scale={[r, r, 1]}
          >
            <spriteMaterial
              map={tex}
              color={CC[diseases[idx].category]}
              transparent
              blending={THREE.AdditiveBlending}
              depthTest={false}
              depthWrite={false}
              opacity={0}
            />
          </sprite>
        );
      })}
    </group>
  );
```

Per-frame: opacity lerps to 0.35 once `introPhase >= 4` (0.08/frame factor); group hidden below 0.005; each sprite's position tracks `curPos[idx]`; supernova target's sprite gets phase-based opacity boost (charge 0.8, burst 1.0, linkwave 0.5, prefocus 0.5) (src/components/GlowSprites.jsx:42-72).

---

## 6. LOW-tier (mobile) material swap path

- `mobDevice = TIER === 'LOW'` in DiseaseNodes (src/components/DiseaseNodes.jsx:29). When true: `plasmaMat` and `pulseMat` memos return null (src/components/DiseaseNodes.jsx:102, 112) and `fallbackMat` is constructed instead:

```jsx
// src/components/DiseaseNodes.jsx:121-126
  const fallbackMat = useMemo(() => {
    if (!mobDevice) return null;
    return new THREE.MeshPhongMaterial({ transparent: true, opacity: 1.0, shininess: 90, specular: new THREE.Color(0x444444) });
  }, [mobDevice]);

  const mat = mobDevice ? fallbackMat : (shaderMode === 'pulse' ? pulseMat : plasmaMat);
```

- The per-frame time update is guarded by `if (mat.uniforms)` so the Phong path (no `.uniforms`) is skipped (src/components/DiseaseNodes.jsx:180-182). Phong picks up per-instance color from the same `setColorAt` instanceColor data (src/components/DiseaseNodes.jsx:149) and is lit by the Canvas lights, which are brightened when `isMob()`: ambient 0.6 vs 0.3, point 1.2 vs 0.6, directional white 1.0 vs blue-tinted 0x6699cc 0.3, plus a second white directional 0.5 only on mobile (src/App.jsx:144-157), and higher exposure 1.4 vs 1.1 (src/App.jsx:138). Sphere geometry drops to 16 segments (src/components/DiseaseNodes.jsx:83).
- SelectionDOF returns null on LOW (src/components/SelectionDOF.jsx:22); BackgroundParticles count 0 via `CFG.particles` (src/components/BackgroundParticles.jsx:7 + src/utils/tiers.js:4); GlowSprites capped at top-40 via `CFG.glowAll:false` (src/components/GlowSprites.jsx:31). No pulse-shader option exists on LOW (materials are null; the Header shader toggle still writes `shaderMode` but `mat` ignores it, src/components/DiseaseNodes.jsx:126).
- Caveat: the LOW tier described by the tier table in `CFG` uses field `pulse: false` (src/utils/tiers.js:4), but no code reads `CFG.pulse` anywhere in src (grep for `CFG` shows only `CFG.dprCap`, `CFG.particles`, `CFG.glowAll` consumers: src/components/AdaptiveDpr.jsx:6, src/App.jsx:127, src/components/BackgroundParticles.jsx:7, src/components/GlowSprites.jsx:31) — the LOW no-shader behavior comes from `TIER === 'LOW'` checks, not `CFG.pulse`.

## Legacy note

`src/MedGalaxy.jsx` contains an older non-R3F implementation with its own composer (FXAA pass resolution updates at src/MedGalaxy.jsx:885, 1307), a `mobDevice ? MeshPhongMaterial : ShaderMaterial` swap with only a `time` uniform (src/MedGalaxy.jsx:906, 1202), and SpriteMaterial glow (src/MedGalaxy.jsx:929). It is not imported by src/main.jsx or src/App.jsx and is dead code in the active build.