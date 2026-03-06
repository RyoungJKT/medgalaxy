uniform float time;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;

varying vec3 vNormal, vWorldPos, vColor, vViewPos;
varying float vPhase, vFogDepth, vCatId;

float hash(vec3 p){p=fract(p*vec3(443.897,441.423,437.195));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
float nse(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*nse(p);p*=2.0;a*=0.5;}return v;}

void main(){
  // View direction (camera-relative)
  vec3 viewDir = normalize(-vViewPos);
  float facing = max(dot(vNormal, viewDir), 0.0);

  // Plasma noise pattern
  vec3 np = vWorldPos * 0.5 + vec3(time * 0.4 + vPhase);
  float n = fbm(np) + fbm(np * 1.5 + vec3(0.0, time * 0.28, 0.0));
  float pl = pow(n * 0.5, 0.7);

  // Fresnel rim glow
  float fr = pow(1.0 - facing, 3.0);

  // Subsurface scattering approximation
  float sss = pow(1.0 - facing, 2.0) * 0.3;

  // Core diffuse brightness
  float diffuse = mix(0.35, 1.0, pow(facing, 0.5));

  // Combine: base color with plasma modulation
  vec3 col = vColor * (pl * 0.8 + 0.2) * diffuse;
  col += vColor * fr * 0.7;        // fresnel rim
  col += vColor * sss;             // subsurface

  // Inner glow (subtle center brightness for glass feel)
  float centerGlow = pow(facing, 4.0) * 0.15;
  col += vColor * centerGlow;

  // Atmospheric fog (fade to dark with distance)
  float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  col = mix(col, fogColor, fogFactor);

  // Slightly reduce alpha at edges for glass transparency
  float alpha = mix(0.75, 0.95, facing);
  alpha = mix(alpha, 0.1, fogFactor * 0.5); // fade alpha in fog too

  gl_FragColor = vec4(col, alpha);
}
