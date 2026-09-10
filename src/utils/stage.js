// The stage color script (DIRECTION section 1, "Color script, beat by beat"):
// base stage #06080d, space deepens to #04060a through beat 0, and the ground
// sinks to #030409 during beat 2's suppression, returning with the release.
// One channel, `sceneRefs.fx.ground`, carries it to the renderer's clear color
// (StageGround.jsx) and to the node shaders' fog color (DiseaseNodes.jsx), so
// far nodes fog into the stage instead of into black. Pure so the script is
// a test, not a promise.
export const STAGE = {
  base: 0x06080d,
  assembly: 0x04060a,
  suppressed: 0x030409,
};

function lerpHex(a, b, t) {
  const ch = (c, s) => (c >> s) & 255;
  const mix = (s) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

/**
 * The ground color for this frame.
 * @param {boolean} assemblyActive beat 0 is live (sceneRefs.assembly.active)
 * @param {number} desat the film's desaturation channel, 0..1
 */
export function groundFor(assemblyActive, desat) {
  if (assemblyActive) return STAGE.assembly;
  const t = desat <= 0 ? 0 : desat >= 1 ? 1 : desat;
  return lerpHex(STAGE.base, STAGE.suppressed, t);
}
