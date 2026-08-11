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
  fx: { morphOverride: null, ignite: 0, desat: 0, ember: 0, glowSuppress: 0 },
  // Velocity-matched handover: the overture's final glide writes its terminal
  // angular velocity here and CameraRig feeds it to the orbit controls, so the
  // film's motion continues into the instrument with no dead frame. `cancelled`
  // flips the moment the user grabs the controls.
  handover: { speed: null, cancelled: false },
};

// Dev hooks: let the verify harness and console drive the grade directly and
// inspect the shared refs (camera, controls, handover state).
if (typeof window !== 'undefined') {
  window.__fx = sceneRefs.fx;
  window.__scene = sceneRefs;
}
