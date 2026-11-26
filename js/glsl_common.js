// GLSL shared by every shader: frame uniforms, hashing, the terrain height function,
// shadows, cloud coverage, sky lookup and fog.
export const HEAD = `#version 300 es
precision highp float;precision highp int;precision highp sampler2DShadow;precision highp sampler3D;
`;
export const COMMON = `
uniform mat4 uVP;uniform vec3 uCam,uCamR,uCamU,uCamF;uniform vec4 uProj;uniform float uTime;uniform vec2 uRes;
uniform vec3 uSunDir,uSunCol,uAmbSky,uAmbGnd,uSunTrue,uMoonDir;
uniform vec4 uTer;uniform float uHz;
uniform sampler2D uHeight,uSnow,uWx,uNoise,uSkyLUT;uniform sampler3D uNoise3;
uniform vec4 uCloud,uWind,uWxG,uTorn,uHu,uCl2;
const float PI=3.14159265;
uint pcg(uint v){uint s=v*747796405u+2891336453u;uint w=((s>>((s>>28u)+4u))^s)*277803737u;return(w>>22u)^w;}
float hI(ivec2 p){return float(pcg(uint(p.x)+pcg(uint(p.y)+1013904223u)))*(1./4294967295.);}
vec3 hI3(ivec2 p){uint a=pcg(uint(p.x)+pcg(uint(p.y)+1013904223u)),b=pcg(a+7u),c=pcg(b+13u);return vec3(float(a),float(b),float(c))*(1./4294967295.);}
float vnoise(vec2 p){vec2 i=floor(p),f=p-i;f=f*f*(3.-2.*f);ivec2 q=ivec2(i);
 return mix(mix(hI(q),hI(q+ivec2(1,0)),f.x),mix(hI(q+ivec2(0,1)),hI(q+ivec2(1,1)),f.x),f.y);}
`;
// uTer = (height scale, sea level 0..1, surrounding tiles on, hexagonal tile)
export const TERR = `
const vec2 HXN[6]=vec2[6](vec2(.8660254,.5),vec2(0.,1.),vec2(-.8660254,.5),vec2(-.8660254,-.5),vec2(0.,-1.),vec2(.8660254,-.5));
vec2 foldP(vec2 p){
 if(uTer.w>.5){for(int n=0;n<2;n++)for(int k=0;k<6;k++){float d=dot(p,HXN[k])-.4330127;if(d>0.)p-=2.*d*HXN[k];}return clamp(p,-.5,.5);}
 return abs(mod(p+1.5,2.)-1.)-.5;}
float sdHex(vec2 p){float d=-1.;for(int k=0;k<6;k++)d=max(d,dot(p,HXN[k])-.4330127);return d;}
float footSdf(vec2 p){
 if(uTer.w>.5){float d=sdHex(p);if(uTer.z>.5)for(int k=0;k<6;k++)d=min(d,sdHex(p-HXN[k]*.8660254));return d;}
 vec2 q=abs(p)-(uTer.z>.5?1.5:.5);return max(q.x,q.y);}
vec2 hTex(vec2 p){vec2 t=(p+.5)*1023.;ivec2 i=clamp(ivec2(floor(t)),ivec2(0),ivec2(1022));vec2 f=clamp(t-vec2(i),0.,1.);
 vec2 a=texelFetch(uHeight,i,0).rg,b=texelFetch(uHeight,i+ivec2(1,0),0).rg,c=texelFetch(uHeight,i+ivec2(0,1),0).rg,d=texelFetch(uHeight,i+ivec2(1,1),0).rg;
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
// Land height anywhere: the fractal tile (mirrored when surrounding tiles are on), a coastal shelf, then optional horizon mountains
float terrainY(vec2 p){float hs=uTer.x,seaY=uTer.y*hs,sd=footSdf(p),yo=seaY-.012;
 if(uHz>.5&&sd>0.){float s=min(1.,sd/3.5),fade=1.-smoothstep(5.5,7.,sd);
  float n=.55*vnoise(p*.45+300.)+.3*vnoise(p*1.1+400.)+.15*vnoise(p*2.6+500.);
  float rg=1.-abs(2.*vnoise(p*5.3+70.)-1.);n+=.05*rg*rg+.02*vnoise(p*12.+9.)+.008*vnoise(p*31.+3.)-.04;
  float m=(n-.38)*2.4*s*s*(1.-uTer.y)*hs*(1.+sd*.5)*fade;yo=seaY-.006+max(m,-.01);}
 if(sd>.5)return yo;
 float y=hTex(foldP(p)).r*hs;if(sd<=0.)return y;
 // outside the tile the (mirrored) land slopes away to the sea bed; higher edges get a longer run so there is no wall
 float w=clamp(.07+1.4*max(y-seaY,0.)+.06*(vnoise(p*9.)-.5),.06,.5);
 return mix(y,yo,smoothstep(0.,w,sd));}
float snowAt(vec2 p){vec2 u=(p+1.3)/2.6;return(u.x>0.&&u.x<1.&&u.y>0.&&u.y<1.)?texture(uSnow,u).r:0.;}
vec2 wxAt(vec2 p){vec2 u=(p+1.3)/2.6;return(u.x>0.&&u.x<1.&&u.y>0.&&u.y<1.)?texture(uWx,u).rg:vec2(0.);}
// Shared material logic so the ground under the grass and the grass itself always agree
float grassMask(float t,float ny){return smoothstep(.035,.08,t)*(1.-smoothstep(.5,.62,t))*smoothstep(.62,.8,ny);}
vec3 grassPatch(vec2 p){float a=texture(uNoise,p*6.).g,b=texture(uNoise,p*41.).r;return vec3(smoothstep(.42,.7,a*.7+b*.3),.65+.7*b,a);}
vec3 grassTipCol(vec3 pt,float r){vec3 lush=vec3(.085,.17,.03)*(.75+.5*pt.z),dry=vec3(.25,.215,.08);return mix(lush,dry,clamp(pt.x*.75+r*.2-.05,0.,1.));}
// x: jittered relative height, y: rock weight, z: sand weight, w: grass weight
vec4 matW(vec2 p,float t,float ny){float a=texture(uNoise,p*19.).r,b=texture(uNoise,p*2.3).g,c=texture(uNoise,p*19.).g;
 float tn=t+(a-.5)*.04+(b-.5)*.08;float rock=smoothstep(.8,.62,ny+(c-.5)*.15),sand=1.-smoothstep(.02,.06,tn);
 return vec4(tn,rock,sand,grassMask(tn,ny)*(1.-rock)*(1.-sand));}
`;
export const LIGHT = `
uniform sampler2DShadow uSh0,uSh1;uniform mat4 uShM0,uShM1;uniform vec4 uShB;
// uCloud = (base height, thickness, coverage threshold, clouds on). uWind = (dir.x, dir.z, strength, drift)
float cloudCov(vec2 xz){
 vec2 q=xz+uWind.xy*uWind.w;
 float n=texture(uNoise,q*.11).r*.55+texture(uNoise,q*.31+.37).g*.3+texture(uNoise,q*.83+.11).r*.15;
 float c=uCloud.w*smoothstep(uCloud.z,uCloud.z+.16,n);
 c=max(c,smoothstep(0.,.55,wxAt(xz).r));
 c=max(c,uTorn.z*smoothstep(.45,.08,length(xz-uTorn.xy)));
 return c;}
float cloudShadow(vec3 p){if(p.y>uCloud.x+uCloud.y)return 1.;
 float t=(uCloud.x+uCloud.y*.35-p.y)/max(uSunDir.y,.12);
 return exp(-cloudCov(p.xz+uSunDir.xz*max(t,0.))*uCl2.x);}
float shPCF(sampler2DShadow s,vec3 c){float r=.75/2048.;
 return(texture(s,c+vec3(-r,-r,0.))+texture(s,c+vec3(r,-r,0.))+texture(s,c+vec3(-r,r,0.))+texture(s,c+vec3(r,r,0.)))*.25;}
float shadowSun(vec3 wp,vec3 n){
 vec4 s=uShM0*vec4(wp+n*uShB.x,1.);
 if(max(abs(s.x),abs(s.y))<.97)return shPCF(uSh0,vec3(s.xy*.5+.5,s.z*.5+.5-uShB.y));
 s=uShM1*vec4(wp+n*uShB.z,1.);
 if(max(abs(s.x),abs(s.y))<.97)return shPCF(uSh1,vec3(s.xy*.5+.5,s.z*.5+.5-uShB.w));
 return 1.;}
float shadowSun1(vec3 wp){
 vec4 s=uShM0*vec4(wp,1.);
 if(max(abs(s.x),abs(s.y))<.97)return texture(uSh0,vec3(s.xy*.5+.5,s.z*.5+.5-uShB.y));
 s=uShM1*vec4(wp,1.);
 if(max(abs(s.x),abs(s.y))<.97)return texture(uSh1,vec3(s.xy*.5+.5,s.z*.5+.5-uShB.w));
 return 1.;}
`;
export const SKYFOG = `
vec2 skyUV(vec3 d){float el=asin(clamp(d.y,-1.,1.));return vec2(atan(d.x,d.z)/6.2831853+.5,sqrt(clamp((el+.12)/1.6908,0.,1.)));}
vec3 skyCol(vec3 d){return texture(uSkyLUT,skyUV(d)).rgb;}
// Height fog and aerial perspective along a ray. Returns in-scattered light; T3 is the per-channel transmittance.
vec3 fogRay(vec3 ro,vec3 rd,float t,out vec3 T3){
 float hf=7.,y0=max(ro.y-uTer.x*uTer.y,0.),k=rd.y*hf;
 float od=uWxG.z*exp(-y0*hf)*(abs(k)>1e-4?(1.-exp(-k*t))/k:t);od=clamp(od,0.,30.);
 T3=exp(-od*vec3(.72,1.,1.4));
 vec3 hd=normalize(vec3(rd.x,max(rd.y,0.)*.25+.04,rd.z));
 vec3 fc=mix(skyCol(hd),uAmbSky*1.15,.3+.6*uWxG.y);
 fc+=uSunCol*.12*pow(max(dot(rd,uSunTrue),0.),8.)*(1.-uWxG.y);
 return fc*(1.-T3);}
float linDepth(float d){float n=uProj.z,f=uProj.w,A=(f+n)/(f-n),B=-2.*f*n/(f-n);return B/(2.*d-1.-A);}
`;
