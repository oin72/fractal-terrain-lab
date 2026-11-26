// Sky, volumetric clouds, water + atmosphere composite, weather particles, tornado, bloom and tone mapping.
import { HEAD, COMMON, TERR, LIGHT, SKYFOG } from './glsl_common.js';

export const FS_VS = HEAD + `out vec2 vUV;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const RAY = `vec2 ndc=vUV*2.-1.;vec3 rdu=uCamF+uCamR*ndc.x*uProj.x*uProj.y+uCamU*ndc.y*uProj.x;float rl=length(rdu);vec3 rd=rdu/rl;`;

// ---------- Sky: single-scattering Rayleigh + Mie + ozone atmosphere baked into a small lookup each frame ----------
export const ATMO = `
const float Rg=6360e3,Ra=6420e3,SUN_I=20.;const vec3 bR=vec3(5.8e-6,13.5e-6,33.1e-6);const float bM=21e-6;const vec3 bO=vec3(.65e-6,1.881e-6,.085e-6);
vec2 rsi(vec3 o,vec3 d,float r){float b=dot(o,d),c=dot(o,o)-r*r,h=b*b-c;if(h<0.)return vec2(1e9,-1e9);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 dens(float h){return vec3(exp(-h/8000.),exp(-h/1200.),max(0.,1.-abs(h-25000.)/15000.));}
vec3 sunOD(vec3 p,vec3 s){float t=rsi(p,s,Ra).y,dt=t/6.;vec3 od=vec3(0.);for(int i=0;i<6;i++){vec3 q=p+s*(float(i)+.5)*dt;od+=dens(length(q)-Rg)*dt;}return od;}
vec3 atmo(vec3 rd,vec3 sun,float haze){vec3 ro=vec3(0.,Rg+250.,0.);float tmax=rsi(ro,rd,Ra).y;vec2 tg=rsi(ro,rd,Rg);if(tg.x>0.&&tg.x<1e8)tmax=min(tmax,tg.x);
 vec3 od=vec3(0.),sR=vec3(0.),sM=vec3(0.);float tp=0.;
 for(int i=0;i<20;i++){float f=(float(i)+1.)/20.,tc=tmax*f*f,dt=tc-tp;vec3 p=ro+rd*(tp+dt*.5);tp=tc;
  vec3 d=dens(length(p)-Rg)*dt;od+=d;
  vec2 gs=rsi(p,sun,Rg);if(gs.x>0.&&gs.x<1e8)continue;
  vec3 ol=sunOD(p,sun)+od,tr=exp(-(bR*ol.x+bM*haze*1.1*ol.y+bO*ol.z));
  sR+=tr*d.x;sM+=tr*d.y;}
 float mu=dot(rd,sun),pR=3./(16.*PI)*(1.+mu*mu),g=.76,pM=3./(8.*PI)*((1.-g*g)*(1.+mu*mu))/((2.+g*g)*pow(1.+g*g-2.*g*mu,1.5));
 return SUN_I*(sR*bR*(pR+.03)+sM*bM*haze*(pM+.03));}`;
export const SKYLUT_FS = HEAD + `uniform vec3 uSunTrue;uniform float uHaze;const float PI=3.14159265;in vec2 vUV;out vec4 o;` + ATMO + `
void main(){float az=(vUV.x-.5)*6.2831853,el=vUV.y*vUV.y*1.6908-.12;vec3 rd=vec3(sin(az)*cos(el),sin(el),cos(az)*cos(el));
 o=vec4(atmo(rd,uSunTrue,uHaze),1.);}`;

// ---------- Volumetric clouds and rain veils (half resolution) ----------
export const CLOUD_FS = HEAD + `#define texture(s,uv) textureLod(s,uv,0.)
` + COMMON + TERR + LIGHT + SKYFOG + `
uniform sampler2D uDepth;uniform vec4 uFlashP;in vec2 vUV;out vec4 o;
float cdens(vec3 p){float h=(p.y-uCloud.x)/uCloud.y;if(h<0.||h>1.)return 0.;
 float cov=cloudCov(p.xz);if(cov<.02)return 0.;
 // flat base, billowing top that rises higher where coverage is stronger; 3D noise carves the shape
 float c=cov*smoothstep(0.,.08,h)*smoothstep(.35+.65*cov,.1+.3*cov,h);if(c<.02)return 0.;
 vec3 q=p*vec3(1.5,2.1,1.5)+vec3(uWind.x,.15,uWind.y)*uWind.w*1.5;
 float d=clamp((texture(uNoise3,q).r*1.15-(1.-c))/max(c,.05),0.,1.);if(d<=0.)return 0.;
 d=clamp(d-(1.-texture(uNoise3,q*3.3+.3).g)*.3*(1.-d),0.,1.);
 return d*uCl2.y;}
void cm(vec3 ro,vec3 rd,float t0,float t1,float jit,inout vec3 col,inout float T){
 if(t1<=t0||uCl2.y<=0.)return;float dt=max(.01,t0*.04),t=t0+dt*jit;
 float mu=dot(rd,uSunDir),hg=.6975/pow(1.3025-1.1*mu,1.5)*.25,hg2=.91/pow(1.09+.6*mu,1.5)*.25,ph=mix(hg2,hg,.6);
 for(int i=0;i<60;i++){if(t>t1||T<.02)break;dt=max(.01,t*.04);vec3 p=ro+rd*t;float d=cdens(p);
  if(d>.003){float h=(p.y-uCloud.x)/uCloud.y,od=0.,ss=uCloud.y*.12;vec3 lp=p;
   for(int j=0;j<3;j++){lp+=uSunDir*ss;od+=cdens(lp)*ss;ss*=2.;}
   float beer=exp(-od*uCl2.w*.55),pw=1.-exp(-d*10.);
   float stm=clamp(uCl2.y-1.,0.,1.);
   vec3 lit=(uSunCol*beer*(.5+ph*1.6)*mix(.55,1.,pw)*.72+uAmbSky*(mix(.5,.2,stm)+.8*h))*mix(1.,.6,stm);
   vec3 fp=p-uFlashP.xyz;lit+=uFlashP.w*vec3(.7,.8,1.)*60.*exp(-dot(fp,fp)*14.);
   vec3 T3;vec3 fg=fogRay(ro,rd,t,T3);lit=lit*T3+fg;
   float a=1.-exp(-d*dt*uCl2.w);col+=T*a*lit;T*=1.-a;}
  t+=dt;}}
void vm(vec3 ro,vec3 rd,float t0,float t1,float jit,inout vec3 col,inout float T){
 if(t1<=t0||uCl2.z<=0.)return;float dt=(t1-t0)/14.,t=t0+dt*(.35+.3*jit);
 for(int i=0;i<14;i++){vec3 p=ro+rd*t;vec2 w=wxAt(p.xz);
  if(w.r>.01){float st=.5+.5*texture(uNoise,vec2(p.x*7.+p.z*5.,p.y*1.3+uTime*(.3-.22*w.g))).r;
   float d=w.r*st*uCl2.z*smoothstep(uCloud.x+.03,uCloud.x-.12,p.y);
   float a=1.-exp(-d*dt);vec3 lit=uAmbSky*mix(vec3(.8,.86,.95),vec3(1.25),w.g)+uSunCol*.03;
   col+=T*a*lit;T*=1.-a;}
  t+=dt;}}
void main(){` + RAY + `
 float dz=texture(uDepth,vUV).r,tS=dz>=1.?1e3:linDepth(dz)*rl;
 if(abs(rd.y)<1e-4)rd.y=1e-4;
 vec3 ro=uCam;float base=uCloud.x,top=base+uCloud.y,ta=(base-ro.y)/rd.y,tb=(top-ro.y)/rd.y;
 float t0=max(min(ta,tb),0.),t1=min(max(ta,tb),min(tS,18.));
 float v0=0.,v1=0.;
 if(ro.y<base){v0=0.;v1=rd.y>0.?min(ta,tS):min(tS,5.);}else if(rd.y<0.){v0=ta;v1=min(tS,ta+5.);}
 v1=min(v1,v0+5.);
 float jit=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 vec3 col=vec3(0.);float T=1.;
 if(t0<=v0){cm(ro,rd,t0,t1,jit,col,T);vm(ro,rd,v0,v1,jit,col,T);}else{vm(ro,rd,v0,v1,jit,col,T);cm(ro,rd,t0,t1,jit,col,T);}
 o=vec4(col,T);}`;

// ---------- Composite: sky, sun, moon, stars, water, fog, clouds ----------
export const COMP_FS = HEAD + COMMON + TERR + LIGHT + SKYFOG + `
uniform sampler2D uScene,uDepth,uClouds;uniform vec4 uNight;uniform vec3 uSunDisc;in vec2 vUV;out vec4 o;
vec3 waterN(vec2 p,float dist,float rough){vec2 w=uWind.xy;float tm=uTime;
 vec2 g=(texture(uNoise,p*9.+w*tm*.02).rg-.5)+(texture(uNoise,p*27.-w.yx*tm*.035+.3).gb-.5)*.8+(texture(uNoise,p*83.+tm*.05).br-.5)*.5+(texture(uNoise,p*310.-tm*.09).rg-.5)*.25*smoothstep(.15,0.,dist);
 return normalize(vec3(g.x,1.,g.y)*vec3(rough,1.,rough));}
vec3 stars(vec3 d){vec3 q=d*150.,i=floor(q),f=q-i-.5;float h=fract(sin(dot(i,vec3(127.1,311.7,74.7)))*43758.5453);
 return vec3(.9,.95,1.)*step(.991,h)*smoothstep(.45,.05,length(f))*(.2+fract(h*91.7)*2.5);}
void main(){` + RAY + `
 float dz=texture(uDepth,vUV).r,tS=dz>=1.?1e4:linDepth(dz)*rl;vec3 col;
 if(dz>=1.){col=skyCol(rd);
  float up=smoothstep(-.02,.08,rd.y);
  col+=stars(rd)*uNight.x*up*.12;
  col+=uSunDisc*smoothstep(.99996,.99998,dot(rd,uSunTrue));
  float md=dot(rd,uMoonDir);col+=vec3(.95,.93,.85)*(1.2+uNight.x*5.)*smoothstep(.99990,.99994,md)*(.75+.25*vnoise(rd.xy*260.))*up*step(.02,uMoonDir.y);
  col+=vec3(.0012,.0018,.0035)*uNight.x;
 }else col=texture(uScene,vUV).rgb;
 float seaY=uTer.x*uTer.y;
 if(rd.y<-1e-4&&uCam.y>seaY){float tW=(uCam.y-seaY)/-rd.y;
  if(tW<tS&&tW<80.){vec3 hit=uCam+rd*tW;vec2 wx=wxAt(hit.xz);
   vec3 n=waterN(hit.xz,tW,(.1+uWind.z*.22+wx.r*.25)/(1.+tW*.6));
   float th=tS-tW;
   vec2 ruv=vUV+n.xz*(.05/(1.+tW*3.))*clamp(th*60.,0.,1.);
   float d2=texture(uDepth,ruv).r,t2=d2>=1.?1e4:linDepth(d2)*rl;if(t2<tW){ruv=vUV;t2=tS;}
   vec3 bed=texture(uScene,ruv).rgb;float pth=min(t2-tW,40.);
   vec3 ab=exp(-pth*vec3(150.,42.,28.));
   float sh=shadowSun(hit,vec3(0.,1.,0.))*cloudShadow(hit);
   vec3 wcol=vec3(.008,.045,.055)*(uSunCol*max(uSunDir.y,0.)*sh+uAmbSky*1.6);
   vec3 refr=bed*ab+wcol*(1.-ab.g);
   vec3 V=-rd;float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
   vec3 r=reflect(rd,n);r.y=abs(r.y)+.004;r=normalize(r);
   vec3 refl=skyCol(r)+vec3(.0012,.0018,.0035)*uNight.x;
   float tc=(uCloud.x+uCloud.y*.3-seaY)/max(r.y,.04),cc=cloudCov(hit.xz+r.xz*tc);
   refl=mix(refl,uSunCol*.35*1.15+uAmbSky*1.5,cc*.75*exp(-tc*.12));
   // short screen-space march so hills and trees reflect in calm water
   vec3 sp=hit+vec3(0.,.0004,0.);float st=.004+tW*.01,hitf=0.;vec3 sc=vec3(0.);
   for(int i=0;i<22;i++){vec3 pv=sp;sp+=r*st;st*=1.3;vec4 c=uVP*vec4(sp,1.);if(c.w<=0.)break;vec2 uv=c.xy/c.w*.5+.5;
    if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)break;float dd=textureLod(uDepth,uv,0.).r;if(dd>=1.)continue;float zl=linDepth(dd);
    if(zl<c.w&&i==0)break;
    if(zl<c.w&&zl>c.w-max(st*8.,c.w*.15)){vec2 ed=smoothstep(vec2(0.),vec2(.08),uv)*smoothstep(vec2(1.),vec2(.92),uv);hitf=ed.x*ed.y;
     // refine the hit between the last two steps so reflections are not stair-stepped
     vec3 ra=pv,rb=sp;for(int j=0;j<4;j++){vec3 rm=(ra+rb)*.5;vec4 cm=uVP*vec4(rm,1.);float zm=linDepth(textureLod(uDepth,cm.xy/cm.w*.5+.5,0.).r);if(zm<cm.w)rb=rm;else ra=rm;}
     vec4 cf=uVP*vec4(rb,1.);sc=textureLod(uScene,cf.xy/cf.w*.5+.5,0.).rgb;break;}}
   refl=mix(refl,sc,hitf);
   vec3 Hh=normalize(uSunDir+V);float nh=max(dot(n,Hh),0.);
   col=mix(refr,refl,fres)+uSunCol*sh*(pow(nh,900.)*26.+pow(nh,160.)*.22)*(.25+.75*fres);
   float vdep=(tS-tW)*max(-rd.y,.05);
   float foam=smoothstep(.0006,.00005,vdep)*smoothstep(.45,.8,texture(uNoise,hit.xz*240.+uTime*.03).r+texture(uNoise,hit.xz*90.-uTime*.02).g*.5);
   col=mix(col,vec3(.6)*(uSunCol*sh*.7+uAmbSky*1.3),foam*.7*smoothstep(8.,1.,tW));
   tS=tW;}}
 vec3 T3;vec3 fg=fogRay(uCam,rd,min(tS,dz>=1.&&tS>100.?14.:40.),T3);col=col*T3+fg;
 // the cloud buffer is half resolution and dithered: a small blur on the way up removes the grain
 vec2 ct=2./uRes;vec4 cl=texture(uClouds,vUV)*.2+(texture(uClouds,vUV+ct*vec2(1.5,.5))+texture(uClouds,vUV+ct*vec2(-.5,1.5))+texture(uClouds,vUV+ct*vec2(-1.5,-.5))+texture(uClouds,vUV+ct*vec2(.5,-1.5)))*.14
  +(texture(uClouds,vUV+ct*vec2(2.5,-1.5))+texture(uClouds,vUV+ct*vec2(1.5,2.5))+texture(uClouds,vUV+ct*vec2(-2.5,1.5))+texture(uClouds,vUV+ct*vec2(-1.5,-2.5)))*.06;
 col=col*cl.a+cl.rgb;
 o=vec4(col,1.);}`;

// ---------- Tornado: a true volume marched inside a bounding cylinder, so it holds up from any angle including above.
// Parts: a hollow rotating condensation funnel that leans and writhes, a spiral wall cloud and overshooting dome
// at the cloud base, and a ground-hugging debris cloud. uTB = base xyz + strength, uTS = funnel height, dome top, radius.
export const TORN_FS = HEAD + COMMON + SKYFOG + `
in vec2 vUV;uniform sampler2D uDepth,uClouds;uniform vec4 uTB;uniform vec3 uTS,uDust;out vec4 o;
float n3(vec3 x){return textureLod(uNoise3,x*.125,0.).r;}
float fbm(vec3 p){return n3(p)*.6+n3(p*2.07+vec3(1.7,9.2,3.1))*.3+n3(p*4.3+vec3(5.1,2.2,7.7))*.15;}
vec2 dens(vec3 p){float H=uTS.x,T=uTime,t=clamp(p.y/H,0.,1.);
 vec2 ctr=vec2(sin(T*.45+t*3.4)+.4*sin(t*8.-T*.8),cos(T*.37+t*2.7))*H*.04*sin(t*3.1416)+uWind.xy*H*.2*t*(1.-t);
 vec2 q=p.xz-ctr;float r=length(q);
 float rad=H*(.018+.14*pow(t,2.3)+.006*sin(t*11.+T*1.3));
 float w=2.+.2*H/(r+H*.012),a=T*w+t*5.,c=cos(a),s=sin(a);vec2 xz=vec2(c*q.x-s*q.y,s*q.x+c*q.y);
 float nz=fbm(vec3(xz/(H*.07),p.y/H*4.-T*.9));
 float shell=smoothstep(rad,rad*.7,r)*(1.-.6*smoothstep(rad*.55,0.,r));
 float fun=clamp(shell*1.7-nz*1.15,0.,1.)*smoothstep(-.002,.008,p.y)*smoothstep(H*1.03,H*.9,p.y);
 float Rw=uTS.z*.94,top=H*.93+(uTS.y-H*.93+H*.03)*(1.-min(1.,r*r/(Rw*Rw)));
 float sl=smoothstep(H*.84,H*.95,p.y)*smoothstep(top,top-H*.06,p.y)*smoothstep(Rw,Rw*.5,r);
 float sp=.5+.5*sin(atan(q.y,q.x)*4.+log(r/H+.02)*9.-T*1.1);
 float a2=T*.35,c2=cos(a2),s2=sin(a2);vec2 x2=vec2(c2*q.x-s2*q.y,s2*q.x+c2*q.y);
 float col=sl*clamp(1.5*sp-.2-fbm(vec3(x2/(H*.06),p.y/H*5.))*1.3,0.,1.)*(1.-.8*smoothstep(H*.1,0.,r));
 float Rd=H*.2,dust=exp(-max(p.y,0.)/(H*.055))*smoothstep(Rd,Rd*.12,length(p.xz))*smoothstep(-.003,.002,p.y);
 dust*=.2+1.5*n3(vec3(xz*(9./H),p.y*(14./H)-T*.6));
 return vec2(fun+col*.75,dust*1.2)*uTB.w;}
void main(){` + RAY + `
 float dz=texture(uDepth,vUV).r,tS=dz>=1.?1e4:linDepth(dz)*rl,seaY=uTer.x*uTer.y;
 if(rd.y<-1e-4&&uCam.y>seaY)tS=min(tS,(uCam.y-seaY)/-rd.y);
 vec3 ro=uCam-uTB.xyz;float RB=uTS.z,H=uTS.x,yt=uTS.y+H*.08;
 float a=dot(rd.xz,rd.xz),b=dot(ro.xz,rd.xz),c=dot(ro.xz,ro.xz)-RB*RB,t0=0.,t1=1e4;
 if(a>1e-6){float h=b*b-a*c;if(h<0.)discard;h=sqrt(h);t0=(-b-h)/a;t1=(-b+h)/a;}else if(c>0.)discard;
 if(abs(rd.y)>1e-5){float ya=(-.004-ro.y)/rd.y,yb=(yt-ro.y)/rd.y;t0=max(t0,min(ya,yb));t1=min(t1,max(ya,yb));}else if(ro.y<-.004||ro.y>yt)discard;
 t0=max(t0,0.);t1=min(t1,tS);if(t1<=t0)discard;
 float dt=(t1-t0)/44.,jit=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453),T=1.;vec3 col=vec3(0.);
 float cs=dot(rd,uSunDir),g=.45,ph=(1.-g*g)/pow(1.+g*g-2.*g*cs,1.5)*.1;
 float above=step(uCloud.x+uCloud.y,uCam.y),clA=texture(uClouds,vUV).a;
 for(int i=0;i<44;i++){vec3 p=ro+rd*(t0+(float(i)+jit)*dt);vec2 d=dens(p);float dd=d.x+d.y;
  if(dd>.01){vec2 dl=dens(p+uSunDir*H*.07);float lit=exp(-(dl.x+dl.y)*3.);
   vec3 lc=mix(vec3(.03),vec3(.42,.44,.5),lit*(1.-.6*clamp(d.x,0.,1.)));lc=mix(lc,uDust*(.3+.7*lit),d.y/dd);
   vec3 L=lc*(uSunCol*(.3+ph*2.)*lit+uAmbSky*.9);
   float al=1.-exp(-dd*dt*150.);if(above>.5&&p.y+uTB.y<uCloud.x+uCloud.y*.9)al*=clA;
   col+=T*al*L;T*=1.-al;if(T<.03)break;}}
 vec3 T3;vec3 fg=fogRay(uCam,rd,t0,T3);float A=1.-T;
 o=vec4(col*T3+fg*A,A);}`;

// ---------- Rain, sleet and snow: instanced streaks and flakes placed by hashing, inside the active weather cells ----------
export const PRECIP_VS = HEAD + COMMON + TERR + `
layout(location=0) in vec2 aQ;uniform vec4 uPB,uPP;out vec4 vC;out vec3 vQ;
void main(){uint id=uint(gl_InstanceID);vec4 r=vec4(float(pcg(id)),float(pcg(id+77777u)),float(pcg(id+999331u)),float(pcg(id+31337u)))/4294967295.;
 float B=uPB.w;vec2 xz=uPB.xz+(fract(r.xy-uPB.xz/(2.*B))-.5)*2.*B;
 gl_Position=vec4(2.,2.,2.,1.);vC=vec4(0.);vQ=vec3(aQ,0.);
 vec2 w=wxAt(xz);if(r.w>w.r*uPP.w)return;
 bool snow=w.g>.75||(w.g>.25&&fract(r.w*13.7)>.5);
 float g=max(terrainY(xz),uTer.x*uTer.y),top=max(uCloud.x*.85+.06,g+.03);
 float yc=clamp(uPB.y,g,top),lo=max(g,yc-B),hi=min(top,yc+B);if(hi-lo<1e-4)return;
 float sp=snow?uPP.y*.13:uPP.y,y=hi-fract(r.z+uTime*sp/(hi-lo))*(hi-lo);
 vec3 vel=snow?vec3(uWind.x*.4+.35*sin(uTime*2.+r.x*40.),-1.,uWind.y*.4+.35*cos(uTime*1.7+r.y*40.)):vec3(uWind.x*.2,-1.,uWind.y*.2);
 vec3 p=vec3(xz.x+vel.x*(hi-y),y,xz.y+vel.z*(hi-y)),q=p-normalize(vel)*(snow?0.:uPP.x*(.7+.6*r.x));
 vec4 ca=uVP*vec4(p,1.),cb=uVP*vec4(q,1.);if(ca.w<uProj.z*1.5||cb.w<uProj.z*1.5)return;
 vec2 pa=ca.xy/ca.w*.5*uRes,pb=cb.xy/cb.w*.5*uRes,d=pb-pa;float dl=length(d);vec2 dir=dl>1e-4?d/dl:vec2(0.,1.),nr=vec2(-dir.y,dir.x);
 float ppu=uRes.y/(2.*uProj.x*ca.w),hw=snow?clamp(.00009*(.6+r.x)*ppu,1.1,7.):clamp(.00002*ppu,.6,2.5);
 vec2 px=mix(pa,pb,aQ.y*.5+.5)+nr*aQ.x*hw+(snow?dir*aQ.y*hw:vec2(0.));
 float fade=smoothstep(uProj.z*1.5,uProj.z*6.,ca.w);
 vC=snow?vec4(vec3(.95,.97,1.)*(uAmbSky*2.6+uSunCol*.45),.85*fade):vec4(vec3(.7,.78,.9)*(uAmbSky*2.+uSunCol*.25),.2*fade);
 vQ.z=snow?1.:0.;
 gl_Position=vec4(px/(.5*uRes)*ca.w,ca.z,ca.w);}`;
export const PRECIP_FS = HEAD + `in vec4 vC;in vec3 vQ;out vec4 o;
void main(){float a=vQ.z>.5?smoothstep(1.,.25,length(vQ.xy)):(1.-abs(vQ.x))*smoothstep(1.,.6,abs(vQ.y));a*=vC.a;o=vec4(vC.rgb*a,a);}`;

// ---------- CPU-driven sprites (dust, splashes, ripples, prints, muzzle flash) and ribbons (lightning, tracers) ----------
export const SPRITE_VS = HEAD + COMMON + `
layout(location=0) in vec2 aQ;layout(location=1) in vec4 aI;layout(location=2) in vec4 aC;layout(location=3) in float aK;
out vec4 vC;out vec3 vQ;
void main(){vec3 w=aK>.5&&aK<2.5?aI.xyz+vec3(aQ.x,0.,aQ.y)*aI.w+vec3(0.,aI.w*.05+.00003,0.):aI.xyz+(uCamR*aQ.x+uCamU*aQ.y)*aI.w;
 vQ=vec3(aQ,aK);vC=aK>2.5?aC:vec4(pow(aC.rgb,vec3(2.2))*(uAmbSky*2.2+uSunCol*.6),aC.a);gl_Position=uVP*vec4(w,1.);}`;
export const SPRITE_FS = HEAD + `in vec4 vC;in vec3 vQ;out vec4 o;
void main(){float r=length(vQ.xy),a=vQ.z>.5&&vQ.z<1.5?smoothstep(.12,.0,abs(r-.85)):smoothstep(1.,vQ.z>2.5?0.:.5,r);a*=vC.a;if(a<.004)discard;o=vec4(vC.rgb*a,vQ.z>2.5?0.:a);}`;
export const RIBBON_VS = HEAD + COMMON + `
layout(location=0) in vec3 aA;layout(location=1) in vec3 aB;layout(location=2) in vec3 aQ;layout(location=3) in vec4 aC;out vec4 vC;out float vS;
void main(){vec4 ca=uVP*vec4(aA,1.),cb=uVP*vec4(aB,1.);ca.w=max(ca.w,1e-4);cb.w=max(cb.w,1e-4);
 vec2 pa=ca.xy/ca.w*.5*uRes,pb=cb.xy/cb.w*.5*uRes,d=pb-pa;float dl=length(d);vec2 dir=dl>1e-4?d/dl:vec2(0.,1.),nr=vec2(-dir.y,dir.x);
 vec4 c=aQ.y>.5?cb:ca;vec2 px=(aQ.y>.5?pb:pa)+nr*aQ.x*aQ.z;vC=aC;vS=aQ.x;gl_Position=vec4(px/(.5*uRes)*c.w,c.z,c.w);}`;
export const RIBBON_FS = HEAD + `in vec4 vC;in float vS;out vec4 o;void main(){float a=(1.-abs(vS))*vC.a;o=vec4(vC.rgb*a,0.);}`;

// ---------- Bloom and final grade ----------
export const DOWN_FS = HEAD + `uniform sampler2D uTexA;uniform vec2 uTexel;in vec2 vUV;out vec4 o;
void main(){vec3 a=texture(uTexA,vUV+uTexel*vec2(-1.,-1.)).rgb,b=texture(uTexA,vUV+uTexel*vec2(1.,-1.)).rgb,c=texture(uTexA,vUV+uTexel*vec2(-1.,1.)).rgb,d=texture(uTexA,vUV+uTexel*vec2(1.,1.)).rgb,e=texture(uTexA,vUV).rgb;
 o=vec4(min((a+b+c+d)*.2+e*.2,vec3(60.)),1.);}`;
export const UP_FS = HEAD + `uniform sampler2D uTexA;uniform vec2 uTexel;in vec2 vUV;out vec4 o;
void main(){vec3 s=texture(uTexA,vUV).rgb*4.;
 s+=(texture(uTexA,vUV+uTexel*vec2(1.,0.)).rgb+texture(uTexA,vUV+uTexel*vec2(-1.,0.)).rgb+texture(uTexA,vUV+uTexel*vec2(0.,1.)).rgb+texture(uTexA,vUV+uTexel*vec2(0.,-1.)).rgb)*2.;
 s+=texture(uTexA,vUV+uTexel).rgb+texture(uTexA,vUV-uTexel).rgb+texture(uTexA,vUV+uTexel*vec2(1.,-1.)).rgb+texture(uTexA,vUV+uTexel*vec2(-1.,1.)).rgb;
 o=vec4(s/16.,1.);}`;
export const FINAL_FS = HEAD + `uniform sampler2D uTexA,uTexB;uniform vec4 uGrade;uniform float uRetro;in vec2 vUV;out vec4 o;
vec3 aces(vec3 x){const mat3 mi=mat3(.59719,.076,.0284,.35458,.90834,.13383,.04823,.01566,.83777);
 const mat3 mo=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);
 x=mi*x;vec3 a=x*(x+.0245786)-.000090537,b=x*(.983729*x+.432951)+.238081;return clamp(mo*(a/b),0.,1.);}
void main(){vec3 c=texture(uTexA,vUV).rgb,b=texture(uTexB,vUV).rgb;c=mix(c,b,uGrade.y);
 c*=uGrade.x;c+=vec3(.8,.85,1.)*uGrade.z;
 c=aces(c);c=pow(c,vec3(1./2.2));
 // retro style: a limited palette (six levels per channel)
 if(uRetro>.5){c=clamp(mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,1.45),0.,1.);c=floor(c*5.+.5)/5.;o=vec4(c,1.);return;}
 float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.08);
 vec2 q=vUV-.5;c*=1.-dot(q,q)*.35;
 float n=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))+uGrade.w));c+=(n-.5)/255.;
 o=vec4(c,1.);}`;
