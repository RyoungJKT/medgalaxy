uniform float time;
uniform float usePlasma;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal, vObjPos;
varying float vPhase, vFogDepth, vCatId;

// ── Tuning constants ──
const vec3  KEY_DIR    = normalize(vec3(0.6, 0.8, 0.5));
const float KEY_INT    = 1.0;
const float FILL_INT   = 0.18;
const float AMB_INT    = 0.12;
const float SPEC_POW   = 32.0;
const float SPEC_INT   = 0.25;
const float FRESNEL_POW = 3.5;
const float FRESNEL_INT = 0.3;
const float PLASMA_MIX  = 0.55;
const float SSS_INT     = 0.12;
const float CRATER_DEPTH = 0.35;                             // crater shadow depth
const float CRATER_SCALE = 3.5;                              // crater density (was 5.5)

// ── Noise ──
float hash(vec3 p){ p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
float nse(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 2; i++){ v += a * nse(p); p *= 2.1; a *= 0.48; } return v; }

// ── Voronoi for craters ──
vec2 voronoi(vec3 p) {
  vec3 b = floor(p);
  vec3 f = fract(p);
  float d1 = 1.0, d2 = 1.0;
  for(int x = -1; x <= 1; x++)
  for(int y = -1; y <= 1; y++)
  for(int z = -1; z <= 1; z++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(hash(b + g), hash(b + g + 31.7), hash(b + g + 67.3));
    vec3 diff = g + o - f;
    float dist = dot(diff, diff);
    if(dist < d1) { d2 = d1; d1 = dist; }
    else if(dist < d2) { d2 = dist; }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

void main(){
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(-vViewPos);
  float NdotV = max(dot(vNormal, V), 0.0);

  // ── 1. Directional lighting ──
  float NdotL = max(dot(N, KEY_DIR), 0.0);
  float wrap = max(dot(N, KEY_DIR) * 0.5 + 0.5, 0.0);
  float key = pow(wrap, 1.3) * KEY_INT;
  float fill = max(dot(N, -KEY_DIR) * 0.5 + 0.5, 0.0) * FILL_INT;
  float diffuse = key + fill + AMB_INT;

  // ── 2. Crater texture (HIGH tier only) ──
  if (usePlasma > 0.5) {
    vec3 objN = normalize(vObjPos);
    vec3 phaseOff = vec3(vPhase * 10.0);
    vec3 cp1 = objN * CRATER_SCALE + phaseOff;
    vec2 vor1 = voronoi(cp1);
    float vorD = vor1.x;
    float craterBowl = smoothstep(0.0, 0.45, vorD);
    float craterRim = smoothstep(0.35, 0.45, vorD) * 0.15;
    diffuse *= mix(1.0 - CRATER_DEPTH, 1.0, craterBowl);
  }

  // ── 3. Specular ──
  vec3 H = normalize(KEY_DIR + V);
  float NdotH = max(dot(N, H), 0.0);
  float spec = pow(NdotH, SPEC_POW) * SPEC_INT * NdotL;
  vec3 specCol = mix(vColor, vec3(1.0), 0.3) * spec;

  // ── 4. Fresnel rim ──
  float fresnel = pow(1.0 - NdotV, FRESNEL_POW) * FRESNEL_INT;

  // ── 5. Subsurface scattering ──
  float sss = pow(max(dot(V, -KEY_DIR), 0.0), 2.0) * SSS_INT * (1.0 - NdotV);

  // ── 6. Surface texture ──
  vec3 baseCol = vColor * diffuse;
  vec3 col;
  // OPTION A: Static FBM rocky bump (no time cost). TO DISABLE: change `true` to `false`
  if (true) {
    vec3 bp = normalize(vObjPos) * 4.0 + vec3(vPhase * 10.0);
    float bump = fbm(bp) * 0.5 + fbm(bp * 2.5) * 0.25;
    col = baseCol * (0.85 + bump * 0.35);
  }
  // OPTION B: Animated plasma (GPU-heavy). TO RESTORE: change `false` to `usePlasma > 0.5`
  else if (false) {
    vec3 np = vWorldPos * 1.8 + vec3(time * 0.35 + vPhase);
    float plasma = fbm(np) + fbm(np * 1.5 + vec3(0.0, time * 0.25, 0.0));
    plasma = pow(plasma * 0.5, 0.7);
    col = mix(baseCol, baseCol * (0.7 + plasma * 0.6), PLASMA_MIX);
  } else {
    col = baseCol;
  }

  col += specCol;
  col += vColor * fresnel;
  col += vColor * sss;

  // ── 7. Atmospheric fog ──
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  float alpha = mix(0.82, 0.97, NdotV);
  alpha = mix(alpha, 0.1, fogFactor * 0.5);

  col = min(col, vColor * 1.15);

  gl_FragColor = vec4(col, alpha);
}
