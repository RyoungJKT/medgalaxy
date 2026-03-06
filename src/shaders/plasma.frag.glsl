uniform float time;
varying vec3 vNormal,vWorldPos,vColor;
varying float vPhase,vFogDepth;
float hash(vec3 p){p=fract(p*vec3(443.897,441.423,437.195));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
float nse(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<3;i++){v+=a*nse(p);p*=2.0;a*=0.5;}return v;}
void main(){
  vec3 np=vWorldPos*0.5+vec3(time*0.4+vPhase);
  float n=fbm(np)+fbm(np*1.5+vec3(0.0,time*0.28,0.0));
  float pl=pow(n*0.5,0.7);
  float facing=abs(dot(vNormal,vec3(0.0,0.0,1.0)));
  float fr=pow(1.0-facing,2.5);
  float core=mix(0.3,1.0,pow(facing,0.6));
  vec3 col=vColor*(pl*1.0+0.1)*core*1.3+vColor*fr*0.8;
  gl_FragColor=vec4(col,0.95);
}
