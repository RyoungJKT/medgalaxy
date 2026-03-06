// Shared mutable refs for cross-component access (not reactive).
// These are plain module-level variables — no re-renders on assignment.
export const sceneRefs = {
  instancedMesh: null,
  edgeMesh: null,
  camera: null,
  canvasElement: null,
};
