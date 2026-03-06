attribute float aPhase;
attribute float aCatId;
varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal;
varying float vPhase, vFogDepth, vCatId;

void main(){
  vPhase = aPhase;
  vCatId = aCatId;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  vec4 wp = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorldPos = (modelMatrix * wp).xyz;
  vec4 mv = modelViewMatrix * wp;
  vViewPos = mv.xyz;
  vec3 tn = normal;
  #ifdef USE_INSTANCING
    tn = mat3(instanceMatrix) * tn;
  #endif
  vWorldNormal = normalize(mat3(modelMatrix) * tn);
  vNormal = normalize(normalMatrix * tn);
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
