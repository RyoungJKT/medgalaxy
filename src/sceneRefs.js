// Shared mutable refs for cross-component access (not reactive).
// These are plain module-level variables — no re-renders on assignment.
export const sceneRefs = {
  instancedMesh: null,
  edgeMesh: null,
  camera: null,
  canvasElement: null,
  introScales: null, // Float32Array from DiseaseNodes intro animation
  // Overture grade channels, driven by the cinematic sequence and copied into
  // the node shader uniforms every frame by DiseaseNodes.
  //   morphOverride: null | 0..1 papers→deaths radius blend owned by the overture
  //   ignite/desat/ember: 0..1 shader amounts (see plasma.frag.glsl section 8)
  fx: { morphOverride: null, ignite: 0, desat: 0, ember: 0 },
};

// Dev hook: lets the verify harness and console drive the grade directly.
if (typeof window !== 'undefined') window.__fx = sceneRefs.fx;
