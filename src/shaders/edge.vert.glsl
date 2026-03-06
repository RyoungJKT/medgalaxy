attribute float aT;       // 0..1 along curve
attribute float aVis;     // visibility (0 = hidden, 1 = active)
attribute float aPhase;   // per-edge random phase for pulse offset

varying float vT;
varying float vVis;
varying float vPhase;
varying vec3  vColor;

void main(){
  vT     = aT;
  vVis   = aVis;
  vPhase = aPhase;

  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = color;
  #endif

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
