# WebGPU vs WebGL2 for the R3F Sphere Demo — Research Report (August 2026)

## Recommendation: STAY on WebGL2 (with a clean upgrade path), do NOT adopt WebGPU for this demo

For a 153-instance sphere scene with one custom GLSL shader, line segments, sprites, and a DoF pass, WebGPU buys you nothing measurable: this workload is trivially within WebGL2 budget on mid-tier mobile. Adopting WebGPU today costs you: a full GLSL-to-TSL rewrite of the noise+fresnel material, abandoning `@react-three/postprocessing` (pmndrs postprocessing is WebGL-only; its README has no WebGPU support and three's docs state EffectComposer and its passes "are not supported" under WebGPURenderer), and exposure to first-year Safari 26 WebGPU driver bugs on exactly the mobile devices you target. Three's own manual still calls WebGPURenderer maturing, warning "you will encounter missing features or a better performance with WebGLRenderer" depending on the scene ([threejs.org/manual WebGPURenderer](https://threejs.org/manual/en/webgpurenderer.html)).

**Do this instead:** upgrade the stack (React 19 + R3F v9 + three 0.185 + drei 10 + @react-three/postprocessing 3) while keeping `WebGLRenderer`. That modernizes everything and leaves a small later step to WebGPU (swap the `gl` prop, rewrite one material in TSL, swap DoF to three's node-based `PostProcessing`), because TSL compiles to both WGSL and WGSL/GLSL and WebGPURenderer ships an automatic WebGL2 backend fallback.

**If you do adopt WebGPU anyway:** the "never show a broken canvas" requirement is satisfiable, because `WebGPURenderer` itself falls back to a WebGL2 backend when `navigator.gpu` is absent (same TSL code compiles to GLSL). You then must rewrite the GLSL material in TSL and replace pmndrs DoF with three's TSL `PostProcessing` + `dof()`/`bloom()` nodes. Bloom exists natively as `three/addons/tsl/display/BloomNode.js` (`bloom()`), with an official emissive-MRT selective-bloom example ([BloomNode docs](https://threejs.org/docs/pages/BloomNode.html), [webgpu_postprocessing_bloom_emissive example](https://threejs.org/examples/webgpu_postprocessing_bloom_emissive.html)). There is no UnrealBloomPass under WebGPURenderer; `bloom()` is its replacement. DoF likewise has a TSL node used in the `webgpu_postprocessing_dof` example.

---

## 1. Three.js WebGPURenderer + TSL status (three r185, npm 0.185.1)

- Latest npm release: **three 0.185.1** (r185; r184 shipped April 2026 per [three.js releases](https://github.com/mrdoob/three.js/releases)). WebGPURenderer has been treated as production-viable since ~r171 with zero-config `three/webgpu` imports ([What's New in Three.js 2026](https://www.utsubo.com/blog/threejs-2026-what-changed)).
- **TSL is the sanctioned shader layer.** New node-system features and fixes go only to WebGPURenderer; the nodes system is not coming to WebGLRenderer ([issue #30185](https://github.com/mrdoob/three.js/issues/30185), [state-of-nodes issue #28957](https://github.com/mrdoob/three.js/issues/28957)). TSL compiles to WGSL (WebGPU) or GLSL (WebGL2 backend fallback), so one shader codebase covers both.
- **InstancedMesh works** under WebGPURenderer, including with custom node materials (`positionNode`, `colorNode`, `normalNode`, plus `instanceIndex`/`instancedArray` TSL primitives). This is part of the stable surface.
- **Known gaps vs WebGLRenderer:** classic `ShaderMaterial`/`onBeforeCompile` GLSL injection does not work (full TSL rewrite required); `EffectComposer` and all its passes unsupported (new `PostProcessing`/`RenderPipeline` stack instead); assorted perf regressions still reported for some scene shapes ([forum thread](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629), [issue #31055](https://github.com/mrdoob/three.js/issues/31055)); r184 notably fixed heavy per-frame object allocation ([Utsubo r184 notes](https://www.utsubo.com/blog/threejs-2026-what-changed)). WebGLRenderer is in maintenance mode: no large new features planned.

## 2. React Three Fiber v9

- Latest: **@react-three/fiber 9.7.0**; v9 pairs with **React 19** (peer: `react >=19 <19.3`); v8 stays on React 18 ([npm](https://www.npmjs.com/package/@react-three/fiber)).
- **WebGPU pattern:** Canvas `gl` prop now accepts an async factory receiving default renderer props; construct `WebGPURenderer`, `await renderer.init()`, return it ([v9 migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide), [Loopspeed R3F+WebGPU guide](https://blog.loopspeed.co.uk/react-three-fiber-webgpu-typescript)). R3F v10 (in development) plans first-class WebGPU via a `renderer` prop.
- **v8 → v9 breaking changes** ([migration guide](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)):
  - React 19 required (new JSX runtime, ref-as-prop; StrictMode now correctly inherited from parent renderer).
  - Automatic sRGB conversion of texture props removed; set `texture.colorSpace = THREE.SRGBColorSpace` yourself (your `flat`/`linear` Canvas flags still exist; defaults unchanged).
  - Type surface rewritten: `Props` → `CanvasProps`; `MeshProps` etc. removed in favor of `ThreeElements['mesh']`; `Node/Object3DNode/MaterialNode` helpers consolidated into `ThreeElement`; global JSX namespace augmentation replaced by the `ThreeElements` interface (this is where most migration compile errors come from).
  - Events: handlers now typed against native `PointerEvent`-derived `ThreeEvent`s; no runtime event-model rewrite, but typings and `extend`-based custom elements need updating.
  - Known live bug to guard: re-render during an in-flight async `gl` factory can invoke it twice and corrupt the renderer ([pmndrs/react-three-fiber #3782](https://github.com/pmndrs/react-three-fiber/issues/3782)); memoize/guard the factory.

## 3. Drei / postprocessing ecosystem

- **@react-three/drei 10.7.8**: requires React ^19 + fiber ^9 ([npm](https://www.npmjs.com/package/@react-three/drei), [drei #2430](https://github.com/pmndrs/drei/issues/2430)). Most helpers work under WebGPURenderer, but shader-based helpers (some materials/effects) have edge cases; test individually.
- **@react-three/postprocessing 3.0.5** (peers: fiber >=9.7.0, postprocessing ^6.36.0, react ^19.2.0, three >=0.182.0), wrapping **postprocessing 6.39.4**.
- **CRITICAL:** pmndrs postprocessing (and therefore @react-three/postprocessing) is **WebGL-only**. Its README documents WebGL-specific behavior with no WebGPU support ([pmndrs/postprocessing](https://github.com/pmndrs/postprocessing)), and three's manual states EffectComposer-style passes are unsupported under WebGPURenderer ([manual](https://threejs.org/manual/en/webgpurenderer.html), [issue #28754](https://github.com/mrdoob/three.js/issues/28754)). Under WebGPU you must use three's own TSL `PostProcessing`/`RenderPipeline` with `bloom()` (`BloomNode`), `dof()`, etc. UnrealBloomPass does not exist there; `bloom()` + emissive MRT is the replacement and is fully available ([BloomNode](https://threejs.org/docs/pages/BloomNode.html)).

## 4. Safari 26 / iOS WebGPU + global support (mid-2026)

- WebGPU shipped **by default in Safari 26.0 (September 2025)** on macOS Tahoe 26, iOS 26, iPadOS 26, visionOS 26 ([WebKit WWDC25 post](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/)); caniuse marks iOS Safari 26.1+ fully supported ([caniuse.com/webgpu](https://caniuse.com/webgpu)). Firefox shipped in 2025 as well; all major engines now ship WebGPU ([gpuweb implementation status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)).
- Rough global availability: **~70-75% of users** as of mid-2026 (~70% cited late-2025/early-2026, still climbing) ([byteiota](https://byteiota.com/webgpu-2026-70-browser-support-15x-performance-gains/)). The remaining 25-30% (older iOS/Android, older desktops) is exactly why automatic fallback is mandatory. Caveat: iOS 26 adoption lags device-by-device; many mid-tier phones you target will still resolve to the WebGL path through 2026.

## 5. Vite / plugin-react

- **Vite 8.2.1 is current latest**; Vite 7.3.6 is the "previous" maintained line ([npm dist-tags]; [Vite 7 announcement](https://vite.dev/blog/announcing-vite7)). Vite 7 (June 2025) requires Node 20.19+/22.12+.
- **@vitejs/plugin-react 6.0.5** requires **Vite ^8** (Oxc-based, Babel optional). For Vite 7 pin **@vitejs/plugin-react 5.x** (latest 5.2.0). Both fully support React 19 ([plugin-react changelog](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md)).

---

## Version matrix to pin (exact, verified against npm registry 2026-08-11)

| Package | Pin | Notes |
|---|---|---|
| `react` / `react-dom` | `19.2.8` | R3F 9 peer is `>=19 <19.3` |
| `three` | `0.185.1` | r185 |
| `@react-three/fiber` | `9.7.0` | exact min for @react-three/postprocessing 3 |
| `@react-three/drei` | `10.7.8` | React 19 + fiber 9 line |
| `@react-three/postprocessing` | `3.0.5` | WebGL path only |
| `postprocessing` | `6.39.4` | transitive peer |
| `vite` | `8.2.1` (or `7.3.6`) | |
| `@vitejs/plugin-react` | `6.0.5` (Vite 8) / `5.2.0` (Vite 7) | |

## Top 5 migration risks (ranked) and mitigations

1. **DoF/post pipeline breaks under WebGPU.** pmndrs postprocessing does not run on WebGPURenderer; a naive switch renders nothing or crashes. Mitigation: on the WebGL path keep `@react-three/postprocessing`; on any WebGPU path use three's `PostProcessing` with the TSL `dof()`/`bloom()` nodes; branch on the active backend at runtime.
2. **GLSL ShaderMaterial (3D noise + fresnel) is incompatible with WebGPU.** Must be rewritten in TSL (`mx_noise_vec3`/custom noise, `fresnel` via `dot(normalView, positionViewDirection)`). Mitigation: TSL runs on both backends, so rewrite once, verify pixel parity on WebGL2 first, then flip the renderer. Keep the GLSL material as the fallback until parity is proven.
3. **React 18 → 19 + R3F v8 → v9 type/runtime churn.** `ThreeElements` typing rewrite, removed `MeshProps`-style exports, removed automatic sRGB texture conversion (colors silently washed out), StrictMode double-rendering surfacing latent bugs. Mitigation: upgrade React/R3F/drei in one commit, run `tsc`, explicitly set `colorSpace` on all color textures, snapshot-compare frames before/after.
4. **Async `gl` factory double-invocation (R3F #3782).** A re-render while `renderer.init()` is pending can create two renderers and corrupt the canvas, i.e. exactly the broken-canvas failure you cannot afford. Mitigation: hoist the factory outside the component (stable identity), cache the promise, and gate the Canvas mount on a completed capability check.
5. **Early-driver WebGPU bugs on target mobile hardware (Safari 26.0.x, older Android GPUs).** Feature is "supported" but rendering artifacts, blocklists, or context loss can still appear where WebGL2 is rock solid. Mitigation: default mid-tier mobile to the WebGL2 backend for launch; enable WebGPU per-UA/per-adapter after device-lab testing; listen for device-lost events and reload into forced-WebGL mode.

## Minimal R3F v9 WebGPU-with-fallback Canvas sketch

```tsx
// renderer.ts
import * as THREE from 'three/webgpu' // WebGPURenderer + node materials

// Hoisted, memoized: guards R3F #3782 (double-invoke during init)
let rendererPromise: Promise<THREE.WebGPURenderer> | null = null

export function makeRenderer(props: any) {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      const renderer = new THREE.WebGPURenderer({
        ...props,
        antialias: true,
        // WebGPURenderer picks the WebGPU backend when navigator.gpu +
        // requestAdapter succeed, otherwise it AUTOMATICALLY uses its
        // WebGL2 backend. forceWebGL pins the fallback explicitly.
        forceWebGL: typeof navigator !== 'undefined' && !('gpu' in navigator),
      })
      await renderer.init() // REQUIRED before first frame
      return renderer
    })()
  }
  return rendererPromise
}
```

```tsx
// App.tsx
import { Canvas, extend } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { makeRenderer } from './renderer'

extend(THREE as any) // register three/webgpu elements for JSX

export default function App() {
  return (
    <Canvas
      gl={makeRenderer}            // async factory: v9 awaits the promise
      camera={{ position: [0, 0, 8], fov: 45 }}
      onCreated={({ gl }) => {
        // gl.backend tells you which path you are on; use it to mount
        // TSL PostProcessing (WebGPU) vs @react-three/postprocessing (WebGL)
        console.log('backend:', (gl as any).backend?.isWebGPUBackend ? 'webgpu' : 'webgl2')
      }}
    >
      {/* InstancedMesh of 153 spheres with a TSL node material,
          LineSegments, sprites; post stack chosen per backend */}
    </Canvas>
  )
}
```

Note: with WebGPURenderer, materials must be node materials (e.g. `MeshStandardNodeMaterial` with `colorNode`/`positionNode` TSL graphs); the same TSL compiles to GLSL when the WebGL2 backend fallback engages, so the fallback never shows a broken canvas as long as no raw `ShaderMaterial` remains in the scene.

## Sources

- https://threejs.org/manual/en/webgpurenderer.html
- https://github.com/mrdoob/three.js/releases
- https://github.com/mrdoob/three.js/issues/30185
- https://github.com/mrdoob/three.js/issues/28957
- https://github.com/mrdoob/three.js/issues/28754
- https://threejs.org/docs/pages/BloomNode.html
- https://threejs.org/examples/webgpu_postprocessing_bloom_emissive.html
- https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- https://github.com/pmndrs/react-three-fiber/issues/3782
- https://blog.loopspeed.co.uk/react-three-fiber-webgpu-typescript
- https://www.npmjs.com/package/@react-three/fiber
- https://www.npmjs.com/package/@react-three/drei
- https://github.com/pmndrs/drei/issues/2430
- https://github.com/pmndrs/postprocessing
- https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
- https://caniuse.com/webgpu
- https://github.com/gpuweb/gpuweb/wiki/Implementation-Status
- https://byteiota.com/webgpu-2026-70-browser-support-15x-performance-gains/
- https://vite.dev/blog/announcing-vite7
- https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md
- https://www.utsubo.com/blog/threejs-2026-what-changed
- https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629
- npm registry (live `npm view`, 2026-08-11) for exact versions of three, @react-three/fiber, @react-three/drei, @react-three/postprocessing, postprocessing, vite, @vitejs/plugin-react, react