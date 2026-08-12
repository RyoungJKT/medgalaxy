uniform float time;
uniform float usePlasma;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float igniteAmount;   // overture beat 2 stage two: 0 = cold, 1 = full burn
uniform float desatAmount;    // overture beat 2 stage one: 0 = category color, 1 = graphite
uniform float emberAmount;    // beat 3 onward: standing scar on the overlooked decile
uniform float igniteContrast; // exponent on each node's own ignite weight (1 = raw weights)

varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal, vObjPos;
varying float vPhase, vFogDepth, vCatId, vIgnite, vEmber, vFlight;

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
const float CRATER_SCALE = 5.5;                              // crater density

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

  // ── 1. Crater texture + bump normal (HIGH tier only) ──
  vec3 bumpN = N;
  float craterBowl = 1.0;
  if (usePlasma > 0.5) {
    vec3 objN = normalize(vObjPos);
    vec3 phaseOff = vec3(vPhase * 10.0);
    vec3 cp1 = objN * CRATER_SCALE + phaseOff;
    vec2 vor1 = voronoi(cp1);
    craterBowl = smoothstep(0.0, 0.45, vor1.x);

    // Bump-map normal from finite differences
    float eps = 0.02;
    float hC = vor1.x;
    float hX = voronoi(cp1 + vec3(eps, 0.0, 0.0)).x;
    float hY = voronoi(cp1 + vec3(0.0, eps, 0.0)).x;
    float hZ = voronoi(cp1 + vec3(0.0, 0.0, eps)).x;
    vec3 grad = vec3(hX - hC, hY - hC, hZ - hC) / eps;
    bumpN = normalize(N - grad * 0.35);
  }

  // ── 2. Directional lighting ──
  float NdotL = max(dot(bumpN, KEY_DIR), 0.0);
  float wrap = max(dot(bumpN, KEY_DIR) * 0.5 + 0.5, 0.0);
  float key = pow(wrap, 1.3) * KEY_INT;
  float fill = max(dot(bumpN, -KEY_DIR) * 0.5 + 0.5, 0.0) * FILL_INT;
  float diffuse = (key + fill + AMB_INT) * mix(1.0 - CRATER_DEPTH, 1.0, craterBowl);

  // ── 3. Specular ──
  vec3 H = normalize(KEY_DIR + V);
  float NdotH = max(dot(bumpN, H), 0.0);
  float spec = pow(NdotH, SPEC_POW) * SPEC_INT * NdotL;
  vec3 specCol = mix(vColor, vec3(1.0), 0.3) * spec;

  // ── 4. Fresnel rim ──
  float fresnel = pow(1.0 - NdotV, FRESNEL_POW) * FRESNEL_INT;

  // ── 5. Subsurface scattering ──
  float sss = pow(max(dot(V, -KEY_DIR), 0.0), 2.0) * SSS_INT * (1.0 - NdotV);

  // ── 6. Surface texture ──
  vec3 baseCol = vColor * diffuse;
  vec3 col = baseCol;

  // Static FBM rocky bump (no time cost). TO DISABLE: change `true` to `false`
  if (true) {
    vec3 bp = normalize(vObjPos) * 4.0 + vec3(vPhase * 10.0);
    float bump = fbm(bp) * 0.5 + fbm(bp * 2.5) * 0.25;
    col = col * (0.85 + bump * 0.35);
  }

  // Animated plasma (HIGH tier). TO DISABLE: change `usePlasma > 0.5` to `false`
  if (usePlasma > 0.5) {
    vec3 np = vWorldPos * 1.8 + vec3(time * 0.35 + vPhase);
    float plasma = fbm(np) + fbm(np * 1.5 + vec3(0.0, time * 0.25, 0.0));
    plasma = pow(plasma * 0.5, 0.7);
    col = mix(col, col * (0.7 + plasma * 0.6), PLASMA_MIX);
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

  // ── 8. Overture grade: suppression → ignite → ember ──
  // Everything below the clamp on purpose: only the ignite ramp is allowed to
  // exceed the bloom threshold (1.0), so glow always means divergence.

  // Palette suppression (overture beat 2 stage one): drain to graphite
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(0.72, 0.78, 0.92), desatAmount * 0.85);

  // Black-body ignite: dark rim to white-hot core, HDR (exceeds bloom threshold)
  // igniteContrast pulls the field away from the hero without touching it: the
  // hero's weight is exactly 1.0 (pow(1, k) == 1), every other node's is below
  // it, so raising the exponent damps the competitors only (review gate F4,
  // beat-2 ignition ambiguity). Outside the film igniteAmount is 0 and this
  // whole block is skipped, so the curve is a film-only statement.
  float ig = pow(vIgnite, igniteContrast) * igniteAmount;
  if (ig > 0.001) {
    float core = pow(NdotV, 2.2);                       // radial: rim 0, core 1
    // Temperature is radial position TIMES divergence weight, so a node only
    // climbs the ramp as far as its own divergence earns: sepsis (1.0) is the
    // only node that reaches the white-hot core, mid-field nodes top out at
    // ember, and the honest anchors never leave smolder.
    float temp = core * ig;
    vec3 ramp = mix(vec3(0.17, 0.03, 0.02),             // smolder #2b0806
                mix(vec3(0.79, 0.08, 0.03),             // ignition #c92a0d
                    vec3(1.0, 0.95, 0.88), temp * temp * temp), // white-hot core #fff3e0
                temp);
    col = mix(col, ramp * (1.0 + 5.0 * temp * ig), ig);

    // Hero exclusivity through the hero hold (review gate round 2, P3 #11).
    // The contrast curve damps the field but does not stop it crossing the
    // bloom threshold: COPD at weight 0.895 still peaked over it and bloomed
    // its own halo through the 1.5 s that names sepsis: a second glowing node
    // under a sentence about one, in a film whose rule is that glow means
    // divergence. igniteContrast is already the "the hero is the only subject"
    // channel (1 before the burn, ramped to 3 by the hero caption and held),
    // so the ceiling rides it rather than adding a second uniform. Every node
    // whose weight is not exactly 1.0 has its ignite emissive scaled (not
    // clipped, so nothing shifts hue) to sit just under the composer's
    // luminanceThreshold of 1.0 for exactly that window. The hero's own weight
    // is 1.0, so step() leaves it alone; the ember rim and everything after
    // are added below this block and are untouched.
    float notHero = 1.0 - step(0.999, vIgnite);
    float heroOnly = clamp((igniteContrast - 1.0) * 0.5, 0.0, 1.0);
    float outLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float underBloom = outLum > 0.95 ? 0.95 / outLum : 1.0;
    col *= mix(1.0, underBloom, notHero * heroOnly);
  }

  // Persistent ember rim on the overlooked decile (post-release standing scar)
  float rim = pow(1.0 - NdotV, 3.0);
  col += vec3(1.0, 0.23, 0.08) * rim * vEmber * emberAmount
         * (0.30 + 0.05 * sin(time * 3.14159 + vPhase));

  // ── Beat 0 fly-in brightness (ADDENDUM 1 section 3) ──
  // 0.35 at launch to 1.00 at landing, plus the 180 ms 1.30x landing pip. It
  // is the last thing applied and it is exactly 1.0 for every node outside
  // beat 0, so nothing else in the piece can see this channel. The pip is
  // allowed above 1.0 on purpose: it is the one frame a node's arrival is
  // announced, and at 1.30x on a monochrome field it stays well under the
  // composer's bloom threshold, which remains reserved for the ignite ramp.
  col *= vFlight;

  gl_FragColor = vec4(col, alpha);
}
