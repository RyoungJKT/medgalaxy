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
