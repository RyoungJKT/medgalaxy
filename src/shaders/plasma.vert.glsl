attribute float aPhase;
varying vec3 vNormal,vWorldPos,vColor;
varying float vPhase,vFogDepth;
void main(){
  vPhase=aPhase;
  #ifdef USE_INSTANCING_COLOR
    vColor=instanceColor;
  #else
    vColor=vec3(1.0);
  #endif
  vec4 wp=vec4(position,1.0);
  #ifdef USE_INSTANCING
    wp=instanceMatrix*wp;
  #endif
  vWorldPos=(modelMatrix*wp).xyz;
  vec4 mv=modelViewMatrix*wp;
  vec3 tn=normal;
  #ifdef USE_INSTANCING
    tn=mat3(instanceMatrix)*tn;
  #endif
  vNormal=normalize(normalMatrix*tn);
  vFogDepth=-mv.z;
  gl_Position=projectionMatrix*mv;
}
