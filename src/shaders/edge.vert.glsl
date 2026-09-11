attribute float aT;       // 0..1 along curve
attribute float aVis;     // visibility (0 = hidden, 1 = active)
attribute float aPhase;   // per-edge random phase for pulse offset

uniform float uR0;        // galaxy radius scale, for the film's outward wave

varying float vT;
varying float vVis;
varying float vPhase;
varying float vRad;
varying vec3  vColor;

void main(){
  vT     = aT;
  vVis   = aVis;
  vPhase = aPhase;
  // ADDENDUM 1 section 4 item 5: the per-vertex phase the film's shimmer
  // travels on. Distance from the galactic centre, in units of the layout's
  // own radius, so the wave leaves the centre and runs outward along the
  // filaments the nodes arrived on rather than sliding across the screen.
  vRad   = length(position) / uR0;

  #ifdef USE_INSTANCING_COLOR
    vColor = instanceColor;
  #else
    vColor = color;
  #endif

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}
