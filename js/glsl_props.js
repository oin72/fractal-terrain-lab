// Shaders for the building and vehicle meshes (props.js). Instance: aI = position + scale,
// aJ = heading, pitch, roll, spare, aK = tint + seed.
import { HEAD, COMMON, TERR, LIGHT } from './glsl_common.js';

export const PROP_VS = HEAD + COMMON + `
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec4 aC;
layout(location=3) in vec4 aI;layout(location=4) in vec4 aJ;layout(location=5) in vec4 aK;
out vec3 vW,vN,vC,vL;out float vM;flat out vec4 fK;
void main(){float h=aJ.x,cp=cos(aJ.y),sp=sin(aJ.y),cr=cos(aJ.z),sr=sin(aJ.z);
 vec3 ex=vec3(cos(h),0.,sin(h)),ey=vec3(0.,1.,0.),ez=vec3(-sin(h),0.,cos(h));
 vec3 X=ex*cp+ey*sp,Y0=ey*cp-ex*sp,Y=Y0*cr+ez*sr,Z=ez*cr-Y0*sr;
 vW=aI.xyz+(X*aP.x+Y*aP.y+Z*aP.z)*aI.w;vN=X*aN.x+Y*aN.y+Z*aN.z;vC=aC.rgb;vM=aC.a;vL=aP;fK=aK;gl_Position=uVP*vec4(vW,1.);}`;
export const PROP_SHADOW_FS = HEAD + `out vec4 o;void main(){o=vec4(0.);}`;
export const PROP_FS = HEAD + COMMON + TERR + LIGHT + `
in vec3 vW,vN,vC,vL;in float vM;flat in vec4 fK;uniform vec2 uNite;out vec4 o;
void main(){vec3 V=normalize(uCam-vW),n=normalize(vN);if(dot(n,V)<0.)n=-n;
 vec3 alb=pow(vM<.5?vC*fK.rgb:vC,vec3(2.2));
 alb*=.8+.4*texture(uNoise,vL.xz*.11+vL.y*.17).r;
 if(vM<1.5)alb=mix(alb,vec3(.84,.88,.94),snowAt(vW.xz)*smoothstep(.45,.8,n.y));
 float sh=shadowSun(vW,n)*cloudShadow(vW),ndl=max(dot(n,uSunDir),0.);
 vec3 amb=mix(uAmbGnd,uAmbSky,n.y*.5+.5),H=normalize(V+uSunDir);
 vec3 c=alb*(uSunCol*ndl*sh+amb)+uSunCol*sh*pow(max(dot(n,H),0.),40.)*.04;
 if(vM>1.5&&vM<2.5){float lit=step(.5,fract(vC.r*7.3+fK.a*13.7))*uNite.x;
  c=vec3(.012,.018,.024)*(uAmbSky*14.)+uAmbSky*.7*pow(1.-max(dot(n,V),0.),3.)+uSunCol*sh*pow(max(dot(n,H),0.),220.)*2.5;
  c+=vec3(1.,.7,.34)*lit*uNite.y*1.3;}
 else if(vM>3.5&&vM<4.5)c=vec3(1.,.93,.78)*uNite.y*(.25+2.2*uNite.x);
 else if(vM>5.5)c=vec3(1.,.07,.04)*uNite.y*(.2+1.6*uNite.x);
 o=vec4(c,1.);}`;
