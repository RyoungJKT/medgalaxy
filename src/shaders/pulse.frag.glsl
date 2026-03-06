uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal;
varying float vPhase, vFogDepth, vCatId;

// ── Tuning constants (matched to plasma shader) ──
const vec3  KEY_DIR    = normalize(vec3(0.6, 0.8, 0.5));
const float KEY_INT    = 1.0;
const float FILL_INT   = 0.18;
const float AMB_INT    = 0.12;
const float SPEC_POW   = 32.0;
const float SPEC_INT   = 0.25;
const float FRESNEL_POW = 3.5;
const float FRESNEL_INT = 0.3;
const float PULSE_MIX   = 0.2;
const float SSS_INT     = 0.12;

void main(){
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vViewPos);
  float NdotV = max(dot(vNormal, V), 0.0);

  // ── 1. Directional lighting ──
  float wrap = max(dot(N, KEY_DIR) * 0.5 + 0.5, 0.0);
  float NdotL = max(dot(N, KEY_DIR), 0.0);
  float key = pow(wrap, 1.3) * KEY_INT;
  float fill = max(dot(N, -KEY_DIR) * 0.5 + 0.5, 0.0) * FILL_INT;
  float diffuse = key + fill + AMB_INT;

  // ── 2. Specular ──
  vec3 H = normalize(KEY_DIR + V);
  float NdotH = max(dot(vNormal, H), 0.0);
  float spec = pow(NdotH, SPEC_POW) * SPEC_INT * NdotL;
  vec3 specCol = mix(vColor, vec3(1.0), 0.3) * spec;

  // ── 3. Fresnel rim ──
  float fresnel = pow(1.0 - NdotV, FRESNEL_POW) * FRESNEL_INT;

  // ── 4. Subsurface scattering ──
  float sss = pow(max(dot(V, -KEY_DIR), 0.0), 2.0) * SSS_INT * (1.0 - NdotV);

  // ── 5. Pulse rings (secondary surface effect) ──
  float lat = asin(clamp(N.y, -1.0, 1.0));
  float ring = lat * 3.0 - time * 2.5 - vPhase;
  float pulse = 0.5 + 0.5 * sin(ring);
  pulse = pow(pulse, 3.0);
  float breath = 0.5 + 0.5 * sin(time * 1.2 + vPhase);

  // Pulse modulates diffuse subtly
  vec3 baseCol = vColor * diffuse;
  vec3 col = mix(baseCol, baseCol * (0.8 + pulse * 0.5 * breath), PULSE_MIX);

  // Add specular, rim, SSS
  col += specCol;
  col += vColor * fresnel;
  col += vColor * sss;

  // ── 6. Atmospheric fog ──
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  float alpha = mix(0.82, 0.97, NdotV);
  alpha = mix(alpha, 0.1, fogFactor * 0.5);

  col = min(col, vColor * 1.15);

  gl_FragColor = vec4(col, alpha);
}
