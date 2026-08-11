# Scene Core Map — medgalaxy-next

Repo root: `/Users/darwin/Documents/Claude/medgalaxy-next`. Entry: `src/main.jsx:3,8` renders `App`; `src/App.jsx:7-30` imports all scene components. `src/MedGalaxy.jsx` is a legacy monolith imported by nothing (grep of `src/main.jsx` + `src/App.jsx` for "MedGalaxy" returned no hits) — all `curPos`/`catPos` hits inside it are dead code.

---

## 1. Per-frame node scale computation + nR()/nRM()

Per-frame matrix rebuild (position from `curPos`, scale = radius × intro scale), src/components/DiseaseNodes.jsx:172-237. The final loop:

```js
// src/components/DiseaseNodes.jsx:227-237
    const scales = introScalesRef.current;
    for (let i = 0; i < count; i++) {
      _v3.set(curPos[i][0], curPos[i][1], curPos[i][2]);
      const r = sizeMode === 'papers' ? nR(diseases[i].papers) : nRM(diseases[i].mortality);
      const is = scales ? scales[i] : 1;
      _s3.set(r * is, r * is, r * is);
      _m4.compose(_v3, _q4, _s3);
      mesh.setMatrixAt(i, _m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
```

Scratch objects at src/components/DiseaseNodes.jsx:15-18 (`_m4`, `_v3`, `_q4`, `_s3` — `_q4` is an identity quaternion, never rotated).

`nR`/`nRM` live in src/utils/helpers.js:3-4; constants `MN, MX, MAX_PAPERS, MAX_MORT` in src/utils/constants.js:12:

```js
// src/utils/helpers.js:3-4
export function nR(p){return MN+Math.pow(Math.min(p,MAX_PAPERS)/MAX_PAPERS,0.6)*(MX-MN);}
export function nRM(m){if(m<=0)return MN*0.2;return MN+Math.pow(Math.min(m,MAX_MORT)/MAX_MORT,0.6)*(MX-MN);}
```

```js
// src/utils/constants.js:12
export const MN = 0.3, MX = 55, MAX_PAPERS = 450000, MAX_MORT = 1400000;
```

Intro-scale evolution inside the same useFrame, gated on `introDoneRef` (src/components/DiseaseNodes.jsx:184-225):

```js
// src/components/DiseaseNodes.jsx:184-225
    // Intro scale logic
    if (!introDoneRef.current) {
      const scales = introScalesRef.current;
      if (!scales) return;

      const { introPhase, introProgress } = store;
      const { heroIdx, constellation, normDist } = introData;

      for (let i = 0; i < count; i++) {
        let target = 0;
        if (introPhase >= 5) {
          target = 1;
        } else if (introPhase >= 3) {
          // Galaxy: staggered by distance from hero
          target = introProgress > normDist[i] * 0.4 + 0.5 ? 1 : 0;
        } else if (introPhase >= 2) {
          // Constellation: hero + same-category neighbors
          target = constellation.has(i) ? 1 : 0;
        } else if (introPhase >= 1) {
          // Hero only
          target = i === heroIdx ? 1 : 0;
        }
        // Never regress — once a node has started appearing, keep it
        if (target < scales[i]) target = scales[i] > 0.01 ? 1 : 0;
        // Lerp toward target
        scales[i] += (target - scales[i]) * 0.08;
        if (scales[i] < 0.001) scales[i] = 0;
        if (scales[i] > 0.999) scales[i] = 1;
      }

      if (introPhase >= 5) {
        // Check if all scales reached 1
        let allDone = true;
        for (let i = 0; i < count; i++) {
          if (scales[i] < 0.999) { allDone = false; break; }
        }
        if (allDone) {
          scales.fill(1);
          introDoneRef.current = true;
        }
      }
    }
```

`introScalesRef` allocated/reset in the mount effect (src/components/DiseaseNodes.jsx:134-140), published to `sceneRefs.introScales` (DiseaseNodes.jsx:140), read by NodeLabels (src/components/NodeLabels.jsx:44,77 — hides labels while `introScales[i] < 0.1`). `introData` (heroIdx = most papers, constellation = hero + up to 11 nearest same-category, normDist 0–1) computed in useMemo at src/components/DiseaseNodes.jsx:35-76.

**Caveat:** HighlightSystem also writes matrices (scale-only shrink/restore, see item 2/4), but DiseaseNodes' useFrame overwrites every matrix every frame from `curPos` + `nR`/`nRM`, so HighlightSystem's shrink of filtered nodes is re-applied each React commit but immediately clobbered per frame? No — HighlightSystem writes inside a `requestAnimationFrame` after render (src/components/HighlightSystem.jsx:38) and DiseaseNodes rewrites all matrices each frame; the shrink survives only because HighlightSystem re-runs on state change while DiseaseNodes' per-frame loop uses `scales[i]` and `nR/nRM` only — i.e. filtered-node shrink from HighlightSystem is overwritten every frame by DiseaseNodes:228-235. (Verbatim guard blocks in item 4; a plan author must reconcile this ordering.)

## 2. instanceColor seeding/updating

- **Seeded** in DiseaseNodes mount effect: `mesh.setColorAt(i, new THREE.Color(CC[diseases[i].category]))` at src/components/DiseaseNodes.jsx:149, flushed at :152 (`mesh.instanceColor.needsUpdate = true`). `CC` palette: src/utils/constants.js:1-5. Mesh published as `sceneRefs.instancedMesh` at DiseaseNodes.jsx:154.
- **Updated** by HighlightSystem on every highlight-relevant state change: `iMesh.setColorAt(i, _color)` at src/components/HighlightSystem.jsx:142, flush :177. Full recolor logic src/components/HighlightSystem.jsx:77-175 (supernova/roulette/category-filter/connections/hover-neighbor/search dimming multipliers).
- **Updated** by `useAttentionColors(meshRef)` hook (called at DiseaseNodes.jsx:32) on `neglectMode` change: src/components/AttentionMap.jsx:15-43 (`mesh.setColorAt(i, color)` :34, flush :37). A standalone `AttentionMap` default component does the same via `sceneRefs.instancedMesh` (src/components/AttentionMap.jsx:46-76) — both exist; App mounts `<AttentionMap />` (src/App.jsx:20 import) and DiseaseNodes calls the hook, so neglect recolor runs twice.
- No per-frame instanceColor writes; DiseaseNodes' useFrame touches only matrices + `time`.

## 3. Intro sequence phase machine

Driver: src/components/IntroSequence.jsx. Thresholds (seconds since `introStarted` first frame):

```js
// src/components/IntroSequence.jsx:5-15
// Timeline thresholds (seconds)
const T_HERO = 0.4;
const T_CONSTELLATION = 1.0;
const T_GALAXY = 1.8;
const T_EFFECTS = 2.5;
const T_DONE = 3.5;

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}
```

Phase mapping (src/components/IntroSequence.jsx:72-86):

```js
// src/components/IntroSequence.jsx:72-86
    // Phase transitions
    let phase = 0;
    if (t >= T_DONE) phase = 5;
    else if (t >= T_EFFECTS) phase = 4;
    else if (t >= T_GALAXY) phase = 3;
    else if (t >= T_CONSTELLATION) phase = 2;
    else if (t >= T_HERO) phase = 1;

    if (store.introPhase !== phase) {
      store.setIntroPhase(phase);
    }

    if (phase >= 5) {
      doneRef.current = true;
    }
```

Phase semantics (store comment, src/store.js:81): `0=dark, 1=hero, 2=constellation, 3=galaxy, 4=effects, 5=done`. Durations: phase 0 = 0→0.4s, 1 = 0.4→1.0s, 2 = 1.0→1.8s, 3 = 1.8→2.5s, 4 = 2.5→3.5s, 5 at t ≥ 3.5s. `introProgress` = `smoothstep(0, 3.5, t)` set every frame (IntroSequence.jsx:66-70). Clock starts only after `store.introStarted` (landing overlay dismissed), IntroSequence.jsx:56-64.

What each phase gates:
- Phase ≥1/≥2/≥3: node scale targets (DiseaseNodes.jsx:192-205, above).
- Phase ≥4: EdgeNetwork fade-in (src/components/EdgeNetwork.jsx:182-186, `targetOpacity = introPhase >= 4 ? 1.0 : 0`), GlowSprites fade-in (src/components/GlowSprites.jsx:45-47, `introPhase >= 4 ? 0.35 : 0`).
- Phase ≥5 ("intro finished"): IdleDrift starts (IdleDrift.jsx:14), GravityLens un-guards (GravityLens.jsx:116), CameraRig autoRotate eligible + parallax (CameraRig.jsx:156,170), DiseaseNodes switches `target = 1` for all and then sets `introDoneRef.current = true` once every scale ≥ 0.999 (DiseaseNodes.jsx:214-224).

Skip paths: `skipIntro: () => set({ introStarted: true, introPhase: 5, introProgress: 1 })` (src/store.js:149); triggered by prefers-reduced-motion (IntroSequence.jsx:22-27) or any mousedown/touchstart/keydown/wheel while `introStarted && introPhase < 5` (IntroSequence.jsx:29-48). CameraRig fast-forwards the pullback on skip (CameraRig.jsx:43-55). DiseaseNodes mount effect treats `introPhase >= 5` as already-done and fills scales with 1 (DiseaseNodes.jsx:136-139).

"Intro finished" state = store `introPhase === 5` (persistent; nothing ever lowers it) plus DiseaseNodes-local `introDoneRef.current === true`.

## 4. Every guard on roulettePhase / activeMode

Scene core files:

| Site | Guard expression |
|---|---|
| src/components/DiseaseNodes.jsx:241 | `if (useStore.getState().roulettePhase !== 'idle') return;` (onPointerOver) |
| src/components/DiseaseNodes.jsx:253 | `if (useStore.getState().roulettePhase !== 'idle') return;` (onClick) |
| src/components/IdleDrift.jsx:12 | `if (activeMode) { blendRef.current = 0; return; }` |
| src/components/IdleDrift.jsx:13 | `if (roulettePhase !== 'idle') { blendRef.current = 0; return; }` |
| src/components/IdleDrift.jsx:14 | `if (introPhase < 5) return;` |
| src/components/GravityLens.jsx:116 | `const guarded = activeMode \|\| roulettePhase !== 'idle' \|\| introPhase < 5 \|\| spotlightActive \|\| supernovaPhase !== 'idle';` (then :117 `const hIdx = (!guarded && hoveredNode) ? hoveredNode.index : -1;`) |
| src/components/CameraRig.jsx:160 | `} else if (roulettePhase === 'reveal') { controlsRef.current.autoRotate = true; }` |
| src/components/HighlightSystem.jsx:74 | `const rouletteActive = roulettePhase !== 'idle';` (branches at :107, :117 `i === rouletteWinner && roulettePhase === 'reveal'`, :146, :156, edge hide :202) |
| src/components/HighlightSystem.jsx:52 | `const connMode = activeMode === 'connections';` (branches :125, :130, :204, :208) |

Other files (context for the plan author):

| Site | Guard |
|---|---|
| src/App.jsx:48 | `if (s.roulettePhase !== 'idle') return;` (background click) |
| src/App.jsx:49 | `if (s.activeMode === 'connections') { ... }` |
| src/App.jsx:67 | `if (roulettePhase !== 'idle') { deselect(); stopRoulette(); return; }` (double-click) |
| src/App.jsx:73 | `if (activeMode) setActiveMode(null);` |
| src/App.jsx:93 | `if (s.roulettePhase !== 'idle') { ... stopRoulette(); return; }` (Escape) |
| src/App.jsx:99,108 | `if (s.activeMode === 'connections') {...}` / `if (s.activeMode) { s.setActiveMode(null); return; }` (Escape) |
| src/components/ExplodeView.jsx:11-12 | `if (useStore.getState().roulettePhase !== 'idle') return;` then reads `activeMode` |
| src/components/VelocityMap.jsx:11-12 | same pattern |
| src/components/ConnectionsView.jsx:17 | `if (roulettePhase !== 'idle') return;` |
| src/components/Spotlight.jsx:60 | `if (useStore.getState().roulettePhase !== 'idle') return;` |
| src/components/NodeLabels.jsx:40 | `const rPhase = storeState.roulettePhase;` |
| src/components/RouletteDust.jsx:66-69 | `if (roulettePhase === 'spinup') {...} else if (roulettePhase === 'reveal') {...}` |
| src/components/GalaxyRoulette.jsx:91-103 | phase machine dispatch (`'assembling'/'spinup'/'reveal'`, `if (roulettePhase === 'idle') return;` at :97) |
| src/components/ui/StoryChips.jsx:48 | `const isRouletteActive = roulettePhase !== 'idle';` |
| src/components/ui/RouletteCaption.jsx:9 | `if (roulettePhase !== 'reveal' \|\| !rouletteCaption) return null;` |
| src/components/ui/ExplodeOverlay.jsx:22 / VelocityOverlay.jsx:31 / ConnectionsOverlay.jsx:66 | `activeMode === 'explode'` / `'velocity'` / `activeMode !== 'connections' ...` |

Enum values: `roulettePhase: 'idle' | 'assembling' | 'spinup' | 'reveal'` (src/store.js:61); `activeMode: null | 'explode' | 'connections' | 'velocity' | 'attention'` (src/store.js:38).

## 5. Position flow (catPos / curPos / netPos)

**Allocation** — module scope of the store, before create():

```js
// src/store.js:10-14
const processed = processData(diseasesData, connectionsData);
const { diseases, layoutEdges, displayEdges, neighbors, connCounts, idMap } = processed;

const { catPos, netPos, rawMax } = computeLayouts(diseases, layoutEdges);
const curPos = catPos.map(p => [...p]); // mutable copy
```

All three are arrays of `[x,y,z]` JS arrays (`src/utils/layout.js:80` returns `catPos:cn.map(n=>[n.x,n.y,n.z]), netPos:...`). Stored in zustand at src/store.js:27-29 but mutated in place — components never `set()` positions (except the unused `setCurPos` action, src/store.js:143).

**Writers of `curPos`** (all in-place mutation):
- IdleDrift — lerps toward `catPos + oscillation` for every node not in `gravOwnedNodes`, useFrame priority **-2** (src/components/IdleDrift.jsx:29-38, priority at :38).
- GravityLens — owns pulled neighbors via `gravOwnedNodes` set, writes in/hold/out eased positions, useFrame priority **-1** (src/components/GravityLens.jsx:176-205, priority at :212; ownership set exported at :16, added :152, removed :210).
- ExplodeView / VelocityMap / ConnectionsView — gsap tweens directly on `curPos[i]` arrays when a mode activates (ExplodeView.jsx:33, VelocityMap.jsx:32, ConnectionsView.jsx:59); reverse relies on IdleDrift lerping back when `activeMode` returns to null (comment at ExplodeView.jsx:41, VelocityMap.jsx:40, ConnectionsView.jsx:74).
- GalaxyRoulette — `gsap.killTweensOf(curPos[idx])` :126, ring assembly tweens :166, winner tween :243, direct ring placement via `computeRingPos(..., curPos[i])` :306,333.
- SupernovaReveal — writes target-node shake offsets `curPos[idx][0..2] = basePos + o` (src/components/SupernovaReveal.jsx:134-136, restore :142-144).

**Readers of `curPos`**: DiseaseNodes per-frame matrices (DiseaseNodes.jsx:177,229); EdgeNetwork endpoints (EdgeNetwork.jsx:180,192-193); GlowSprites sprite positions (GlowSprites.jsx:43,57); GravityLens anchor/starts (GravityLens.jsx:49,53,132,138,161); NodeLabels projection (NodeLabels.jsx:37,54); SelectionRipple origin (SelectionRipple.jsx:94-97); SelectionDOF (SelectionDOF.jsx:28,55); ui/Tooltip.jsx:60-64; ui/CompareCards.jsx:29-32; GalaxyRoulette (above).

**Readers of `catPos`** (rest pose): DiseaseNodes intro data + initial matrices (DiseaseNodes.jsx:43,132,143); IdleDrift drift base (IdleDrift.jsx:31-33); GravityLens release target (GravityLens.jsx:164-165); SupernovaReveal base pos (SupernovaReveal.jsx:49,52); SupernovaDust (SupernovaDust.jsx:53,69); ConnectionsView (ConnectionsView.jsx:14); store `selectDisease` fly position (src/store.js:89-91 — note: uses `catPos`, not `curPos`).

**`netPos`** exists in the store (src/store.js:28) but no component in `src/components/` reads it (grep hit only legacy `src/MedGalaxy.jsx` and `src/utils/layout.js`); `layoutMode: 'category'` (src/store.js:31) is currently inert.

**Frame order**: IdleDrift (-2) → GravityLens (-1) → default-priority useFrames (DiseaseNodes, EdgeNetwork, GlowSprites, CameraRig, etc.), so node/edge rendering always sees this frame's drift+lens output.

## 6. CameraRig autoRotate + flyTarget

autoRotate decision, every frame:

```js
// src/components/CameraRig.jsx:152-181
  useFrame((state) => {
    const { introPhase, roulettePhase, supernovaPhase } = useStore.getState();

    if (controlsRef.current) {
      if (introPhase < 5) {
        controlsRef.current.autoRotate = false;
      } else if (supernovaPhase !== 'idle' && supernovaPhase !== 'complete') {
        controlsRef.current.autoRotate = false;
      } else if (roulettePhase === 'reveal') {
        controlsRef.current.autoRotate = true;
      } else {
        if (!introStarted.current) introStarted.current = true;
        idleFrames.current++;
        controlsRef.current.autoRotate = idleFrames.current > 300;
      }
    }

    // Subtle cursor parallax (desktop only, after intro)
    if (TIER !== 'LOW' && introPhase >= 5) {
      const targetX = mouseRef.current.x * PARALLAX_STRENGTH;
      const targetY = -mouseRef.current.y * PARALLAX_STRENGTH;
      const prev = parallaxOffset.current;
      prev.x += (targetX - prev.x) * 0.05;
      prev.y += (targetY - prev.y) * 0.05;
      camera.position.x += (prev.x - (camera.userData.lastParX || 0));
      camera.position.y += (prev.y - (camera.userData.lastParY || 0));
      camera.userData.lastParX = prev.x;
      camera.userData.lastParY = prev.y;
    }
  });
```

`idleFrames` reset on user interaction via `onStart` (`const onStart = () => { idleFrames.current = 0; };` CameraRig.jsx:183) and on every flyTarget (CameraRig.jsx:78). OrbitControls props: `enableDamping dampingFactor={0.08} autoRotateSpeed={0.3} minDistance={50} maxDistance={camDist * 4} makeDefault` (CameraRig.jsx:186-195). `camDist = rawMax ? rawMax * (mob ? 2.4 : 1.4) : 900` (src/App.jsx:35).

flyTarget subscription (three modes: explicit `cameraPos`, `radius` approach, or fly-home):

```js
// src/components/CameraRig.jsx:61-139
  useEffect(() => {
    const unsub = useStore.subscribe(
      s => s.flyTarget,
      (flyTarget) => {
        if (!flyTarget || !controlsRef.current) return;
        // During supernova, only allow the prefocus camera move (phase will be 'prefocus')
        // Block the selectDisease flyTarget during burst/linkwave/settle
        const sp = useStore.getState().supernovaPhase;
        if (sp === 'charge' || sp === 'burst' || sp === 'linkwave') return;
        const controls = controlsRef.current;

        // Kill existing tweens
        tweenRef.current.forEach(t => t.kill());
        tweenRef.current = [];

        // Pause autoRotate during fly to prevent fighting GSAP
        controls.autoRotate = false;
        idleFrames.current = 0;

        const dur = flyTarget.duration || 1.2;
        const onUpdate = () => controls.update();

        tweenRef.current.push(
          gsap.to(controls.target, {
            x: flyTarget.position[0],
            y: flyTarget.position[1],
            z: flyTarget.position[2],
            duration: dur,
            ease: 'power3.inOut',
            onUpdate,
          })
        );

        if (flyTarget.cameraPos) {
          // Explicit camera position (e.g. supernova cinematic angle)
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: flyTarget.cameraPos[0],
              y: flyTarget.cameraPos[1],
              z: flyTarget.cameraPos[2],
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        } else if (flyTarget.radius) {
          // Fly toward node from current viewing angle
          const nodePos = new THREE.Vector3(flyTarget.position[0], flyTarget.position[1], flyTarget.position[2]);
          const dir = camera.position.clone().sub(nodePos).normalize();
          const targetPos = nodePos.clone().add(dir.multiplyScalar(flyTarget.radius));
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        } else {
          // Fly back: maintain current viewing direction toward origin
          const dir = camera.position.clone().normalize();
          const targetPos = dir.multiplyScalar(camDist);
          tweenRef.current.push(
            gsap.to(camera.position, {
              x: targetPos.x,
              y: targetPos.y,
              z: targetPos.z,
              duration: dur,
              ease: 'power3.inOut',
              onUpdate,
            })
          );
        }
      }
    );
    return unsub;
  }, [camera]);
```

Cinematic intro pullback (camera starts at `(8, 5, camDist*0.3)`, tweens to `(0,0,camDist)` over 2.5s after 1.0s delay; skip fast-forwards in 0.5s): src/components/CameraRig.jsx:27-58. flyTarget producers: `selectDisease` (`{ position, radius: nodeRadius * (isMob() ? 12.0 : 5.0) }`, src/store.js:88-99) and `deselect` (`{ position: [0,0,0], radius: null }`, src/store.js:101-106). Camera exposed at `sceneRefs.camera` (CameraRig.jsx:22-24).

## 7. Hover/click event flow in DiseaseNodes

Handlers on the `<instancedMesh>` (props at DiseaseNodes.jsx:264-266):

```js
// src/components/DiseaseNodes.jsx:239-257
  const onPointerOver = (e) => {
    e.stopPropagation();
    if (useStore.getState().roulettePhase !== 'idle') return;
    if (e.instanceId !== undefined) {
      useStore.getState().setHovered(e.instanceId);
      document.body.style.cursor = 'pointer';
    }
  };
  const onPointerOut = () => {
    useStore.getState().setHovered(null);
    document.body.style.cursor = 'default';
  };
  const onClick = (e) => {
    e.stopPropagation();
    if (useStore.getState().roulettePhase !== 'idle') return;
    if (e.instanceId !== undefined) {
      useStore.getState().selectDisease(e.instanceId);
    }
  };
```

Downstream: `setHovered` sets `hoveredNode: { index, disease }` (src/store.js:108-116) → HighlightSystem recolor + edge vis (HighlightSystem.jsx:20,46), GravityLens pull (GravityLens.jsx:110,117), Tooltip. `selectDisease` sets `selectedNode` + `flyTarget` (src/store.js:88-99) → CameraRig fly, SelectionRipple trigger (SelectionRipple.jsx:89-108), SelectionDOF. Background click / double-click / Escape deselection handled in App.jsx:40-115 (item 4). Note `mesh` itself is the raycast target (no proxy objects; r3f instanceId).

## 8. Materials / uniforms — creation and per-frame updates

**DiseaseNodes** — three materials, selected by tier + `shaderMode` (`mat = mobDevice ? fallbackMat : (shaderMode === 'pulse' ? pulseMat : plasmaMat)`, DiseaseNodes.jsx:126; `key={shaderMode}` on the mesh forces remount on toggle, :261):

```js
// src/components/DiseaseNodes.jsx:95-124
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
```

Per-frame update — only `time`:

```js
// src/components/DiseaseNodes.jsx:180-182
    if (mat.uniforms) {
      mat.uniforms.time.value = state.clock.getElapsedTime();
    }
```

Fog range set once from data extent (`near = rawMax*0.6`, `far = rawMax*3.0`) in an effect, DiseaseNodes.jsx:157-170. Geometry instanced attributes `aPhase` (random 0–2π) and `aCatId` (`CAT_INDEX` from CATS order, DiseaseNodes.jsx:20-22) built in the geo useMemo, DiseaseNodes.jsx:82-93; sphere segments 16 on LOW tier, else 32 (:83). Shaders consume `aPhase/aCatId/instanceColor` (src/shaders/plasma.vert.glsl:1-13); plasma.frag uniforms: `time, usePlasma, fogColor, fogNear, fogFar` (src/shaders/plasma.frag.glsl:1-5); `usePlasma` branch at plasma.frag.glsl:55, and a second plasma feature deliberately disabled with comment "TO ENABLE: change `false` to `usePlasma > 0.5`" at plasma.frag.glsl:102. `usePlasma` is set only at material creation (never per frame).

**EdgeNetwork** — one ShaderMaterial (`uniforms: { time }`, `transparent, depthWrite:false, DoubleSide, vertexColors`), EdgeNetwork.jsx:146-156. Per frame: `mat.opacity` lerped for intro fade + `mat.uniforms.time.value = state.clock.getElapsedTime()` (EdgeNetwork.jsx:182-188), then full ribbon position rebuild from `curPos` (EdgeNetwork.jsx:190-253). Edge vertex attrs `aT/aVis/aPhase` + color (edge.vert.glsl:1-8); `aVis` written by HighlightSystem via `sceneRefs.edgeMeta` (`{ geo, visArr, vertsPerEdge }`, published EdgeNetwork.jsx:159-168, consumed HighlightSystem.jsx:181-225).

**GlowSprites** — per-sprite `spriteMaterial` (canvas radial texture, category color, AdditiveBlending, depthTest/Write false, opacity 0), GlowSprites.jsx:84-92; per frame opacity lerp toward `introPhase >= 4 ? 0.35 : 0` plus supernova boost map `{ charge: 0.8, burst: 1.0, linkwave: 0.5, prefocus: 0.5 }` (GlowSprites.jsx:45-71). Top-40 by papers unless `CFG.glowAll` (GlowSprites.jsx:29-38; tier config src/utils/tiers.js:1-5).

**SelectionRipple** — inline-GLSL ShaderMaterial `{ uColor, uAlpha }` (SelectionRipple.jsx:75-86); `uColor` set on selection (:101), `uAlpha = (1 - p*p) * 0.7` per frame (:146); ring geometry positions rebuilt per frame (:134-143), billboarded to camera quaternion (:156). Supernova variant when `supernovaPhase === 'burst'` at trigger: maxR 220 / width 10 / duration 0.7 vs constants `RIPPLE_DURATION = 1.0, MAX_RADIUS = 140, RING_WIDTH = 6` (SelectionRipple.jsx:8-10,119-122).

**AdaptiveDpr** — no material; swaps renderer pixel ratio between `MOTION_DPR = 1` while camera moves (or `spotlightActive`) and `REST_DPR = CFG.dprCap` after 30 idle frames (src/components/AdaptiveDpr.jsx:6-49). Tier table: HIGH/MEDIUM dprCap 1.5, LOW 1 (src/utils/tiers.js:1-5); `TIER = detectTier()` — coarse pointer or width<768 → LOW, width<1200 → MEDIUM, else HIGH (tiers.js:6-12).