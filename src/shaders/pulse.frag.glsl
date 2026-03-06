uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos;
varying float vPhase, vFogDepth, vCatId;

void main(){
  // View direction
  vec3 viewDir = normalize(-vViewPos);
  float facing = max(dot(vNormal, viewDir), 0.0);

  // Radial pulse: rings emanate outward from the pole
  float lat = asin(clamp(vNormal.y, -1.0, 1.0));
  float ring = lat * 3.0 - time * 2.5 - vPhase;
  float pulse = 0.5 + 0.5 * sin(ring);
  pulse = pow(pulse, 3.0);

  // Secondary breathing effect
  float breath = 0.5 + 0.5 * sin(time * 1.2 + vPhase);

  // Fresnel rim glow
  float fr = pow(1.0 - facing, 3.0);

  // Subsurface scattering
  float sss = pow(1.0 - facing, 2.0) * 0.25;

  // Core diffuse
  float diffuse = mix(0.35, 1.0, pow(facing, 0.5));

  // Combine
  vec3 col = vColor * diffuse * 0.85;
  vec3 pulseCol = vColor * pulse * 0.6 * breath;

  col += pulseCol + vColor * fr * 0.7 + vColor * sss;

  // Center glow
  float centerGlow = pow(facing, 4.0) * 0.2 * breath;
  col += vColor * centerGlow;

  // Atmospheric fog
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  float alpha = mix(0.75, 0.95, facing);
  alpha = mix(alpha, 0.1, fogFactor * 0.5);

  gl_FragColor = vec4(col, alpha);
}
