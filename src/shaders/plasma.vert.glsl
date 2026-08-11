attribute float aPhase;
attribute float aCatId;
attribute float aIgnite;   // 0..1 attention/death divergence weight
attribute float aEmber;    // 1.0 for the overlooked decile, else 0
varying vec3 vNormal, vWorldPos, vColor, vViewPos, vWorldNormal, vObjPos;
varying float vPhase, vFogDepth, vCatId, vIgnite, vEmber;

void main(){
  vPhase = aPhase;
  vCatId = aCatId;
  vIgnite = aIgnite;
  vEmber = aEmber;
  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = vec3(1.0);
  #endif
  vObjPos = position;  // raw unit-sphere vertex
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
