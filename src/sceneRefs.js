// Shared mutable refs for cross-component access (not reactive).
// These are plain module-level variables — no re-renders on assignment.
export const sceneRefs = {
  instancedMesh: null,
  edgeMesh: null,
  camera: null,
  controls: null,      // OrbitControls instance, published by CameraRig
  cameraJump: null,    // (x,y,z) => void — kills camera tweens and seats the camera
  canvasElement: null,
  introScales: null, // Float32Array from DiseaseNodes intro animation
  // Overture grade channels, driven by the cinematic sequence and copied into
  // the node shader uniforms every frame by DiseaseNodes.
  //   morphOverride: null | 0..1 papers→deaths radius blend owned by the overture
  //   ignite/desat/ember: 0..1 shader amounts (see plasma.frag.glsl section 8)
  //   glowSuppress: 0..1 fade on the additive glow sprites, which the shader
  //     desaturation path cannot reach (they would float as saturated halos
  //     over a graphite galaxy during beat 2).
  //   igniteContrast: exponent applied to each node's own ignite weight before
  //     the black-body ramp (1 = the raw weights). The hero's weight is exactly
  //     1.0, so raising the exponent leaves it untouched and pulls every other
  //     node's burn down — that is what keeps beat 2 a single flare instead of
  //     two comparable ones (review gate F4). Only meaningful while
  //     `ignite > 0`, i.e. inside the film.
  fx: { morphOverride: null, ignite: 0, desat: 0, ember: 0, glowSuppress: 0, igniteContrast: 1 },
  // Velocity-matched handover: the overture's final glide writes its terminal
  // angular velocity here and CameraRig feeds it to the orbit controls, so the
  // film's motion continues into the instrument with no dead frame. `cancelled`
  // flips the moment the user grabs the controls.
  handover: { speed: null, cancelled: false },
  // Time Machine engine, owned + assigned by TimeMachine.jsx (Task 12). null
  // until that component mounts; DiseaseNodes guards with `tm && tm.active`
  // so a not-yet-mounted or inactive Time Machine is a no-op, falling back to
  // the normal papers/mortality morph radius.
  tm: null,
  // Beat 0's fly-in (ADDENDUM 1 section 3), owned + assigned by
  // AssemblyFlight.jsx. Null until that component mounts and inert once
  // `active` goes false, which is the whole rest of the session: DiseaseNodes
  // guards with `assembly && assembly.active` and otherwise composes matrices
  // exactly as it did before this wave. While active it carries this frame's
  // per-node flight position, scale multiplier, comet quaternion + stretch and
  // brightness, plus `t`/`seekT` so IntroSequence's phases share the flight's
  // clock and the verify harness can freeze beat 0 the way it freezes the film.
  assembly: null,
  // Kills the 5.2 s beat-0 camera drift tween, so a harness seek can seat the
  // camera analytically without the tween walking away from it.
  killAssemblyDrift: null,
  // nodeRadius(i): node i's radius as it stands on screen this frame, owned +
  // assigned by DiseaseNodes (the only component that holds both the smoothed
  // papers/mortality morph position and the per-node lag table, and that knows
  // when the Time Machine has taken radius over). null until that component
  // mounts; callers fall back to nR(papers). Read by the supernova reveal
  // (camera framing, tremble amplitude) and the burst ring (start radius), all
  // of which used to re-derive nR(papers) and so were wrong by up to 13x
  // whenever the size toggle sat on Mortality.
  nodeRadius: null,
  // Who is moving the camera this frame, published by CameraRig every frame:
  //   'user'    a hand on the controls, plus the damping tail after it lets go
  //   'tween'   a gsap tween on camera.position, the film, the tour, the exit
  //             or the handover's decaying autoRotate
  //   'ambient' breathing, autoRotate, cursor parallax: the camera is "at rest"
  //             for every fidelity decision (DPR, depth of field)
  // Replaces the old per-frame displacement heuristic, which the addendum's
  // camera breathing tripped on every frame.
  cameraOwner: 'ambient',
  // Read by the harness: the DPR AdaptiveDpr last applied, the rest value it
  // targets on this display, and how many times it has switched this session.
  dprState: { current: 1, rest: 1, switches: 0 },
  // Read by the harness: the DepthOfField bokehScale PostFX applied this frame.
  postfx: { bokeh: 0 },
  // Fix round (2026-09-10, Task 1 review): true while TimeMachine's own
  // auto-tour arming timer (TOUR_ARM_DELAY, 1.5 s after the film hands over
  // or after a deselect frees the field) is pending, published by
  // TimeMachine.jsx. The camera reads 'ambient' for that whole pause since
  // nothing has claimed it yet, but the tour is about to, so AdaptiveDpr
  // holds the rest DPR back for exactly that known gap rather than a long
  // fixed settle window applied to every return to rest.
  tourArmPending: false,
};

// Dev hooks: let the verify harness and console drive the grade directly and
// inspect the shared refs (camera, controls, handover state).
if (typeof window !== 'undefined') {
  window.__fx = sceneRefs.fx;
  window.__scene = sceneRefs;
}
