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
};

// Dev hooks: let the verify harness and console drive the grade directly and
// inspect the shared refs (camera, controls, handover state).
if (typeof window !== 'undefined') {
  window.__fx = sceneRefs.fx;
  window.__scene = sceneRefs;
}
