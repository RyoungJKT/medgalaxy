uniform float time;
// ADDENDUM 1 section 4 item 5, the film's edge shimmer. `uFilmAlpha` is the
// global opacity breathe (0.06 to 0.13 at 0.2 Hz) every tier gets, already
// scaled by how much of the film is live and exactly 0 outside beats 0 and 1.
// `uWave` is 1 on HIGH and MEDIUM, where the per-vertex phase runs on top of
// it, and 0 on LOW, which gets the breathe alone.
uniform float uFilmAlpha;
uniform float uWave;
uniform float uWaveSpeed;
uniform float uWaveLength;

varying float vT;
varying float vVis;
varying float vPhase;
varying float vRad;
varying vec3  vColor;

void main(){
  // Taper alpha: fade at endpoints for soft falloff
  float taper = sin(vT * 3.14159);
  float soft = mix(0.3, 1.0, taper);

  // The film's faint standing net, with the luminance wave travelling outward
  // from the galactic centre. Additive to nothing: it is a floor under the
  // hover neighborhood's own alpha, never a lift on it, so the existing
  // 0.1-to-0.35 rise is untouched wherever it is live.
  float wave = 0.5 + 0.5 * sin(time * uWaveSpeed - vRad / uWaveLength + vPhase * 6.2831);
  float film = uFilmAlpha * soft * mix(1.0, mix(0.45, 1.0, wave), uWave);

  // Hidden when inactive, visible when active
  float baseAlpha = vVis < 0.01 ? 0.0 : mix(0.1, 0.35, vVis) * soft;
  if (baseAlpha + film < 0.002) discard;

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

  float alpha = max(baseAlpha, film) + totalPulse * 0.6;
  alpha = clamp(alpha, 0.0, 0.9);

  gl_FragColor = vec4(col, alpha);
}
