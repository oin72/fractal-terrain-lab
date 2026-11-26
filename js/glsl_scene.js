// Opaque scene shaders: terrain clipmap, grass blades, trees, and raymarched animals / hunter / craft / weapons.
import { HEAD, COMMON, TERR, LIGHT, SKYFOG } from './glsl_common.js';

// ---------- Terrain: nested grids centred on the focus, morphing between levels so there are no cracks ----------
export const TERRAIN_VS = HEAD + COMMON + TERR + `
layout(location=0) in vec2 aP;uniform vec4 uLvl;out vec3 vW;
void main(){vec2 g=aP;float m=uLvl.w*smoothstep(.72,.94,max(abs(g.x),abs(g.y))/96.);
 vec2 odd=fract(g*.5)*2.;vec2 w=uLvl.yz+(g-odd*m)*uLvl.x;
 vW=vec3(w.x,terrainY(w),w.y);gl_Position=uVP*vec4(vW,1.);}`;
export const TERRAIN_SHADOW_FS = HEAD + `in vec3 vW;uniform vec4 uHole;out vec4 o;
void main(){if(vW.x>uHole.x&&vW.x<uHole.z&&vW.z>uHole.y&&vW.z<uHole.w)discard;o=vec4(0.);}`;
export const TERRAIN_FS = HEAD + COMMON + TERR + LIGHT + `
in vec3 vW;uniform vec4 uHole;uniform vec4 uGFar;uniform float uRetro;out vec4 o;
void main(){
 if(vW.x>uHole.x&&vW.x<uHole.z&&vW.z>uHole.y&&vW.z<uHole.w)discard;
 vec2 p=vW.xz;float dist=length(vW-uCam),e=max(.001,dist*.0012);
 float h0=terrainY(p),hx=terrainY(p+vec2(e,0.)),hz=terrainY(p+vec2(0.,e));
 vec3 n=normalize(vec3(h0-hx,e,h0-hz));
 float hs=uTer.x,sea=uTer.y,seaY=sea*hs,t=(h0/hs-sea)/max(1.-sea,.01);
 float sd=footSdf(p),ao=sd<0.?hTex(foldP(p)).g:1.;
 vec4 n2=texture(uNoise,p*19.),n3=texture(uNoise,p*140.),n4=texture(uNoise,p*1100.),n1=texture(uNoise,p*2.3);
 vec3 nd=normalize(n+vec3(n3.r-.5,0.,n3.g-.5)*.3*smoothstep(1.5,.05,dist)+vec3(n4.g-.5,0.,n4.b-.5)*.35*smoothstep(.15,0.,dist));
 vec4 mw=matW(p,t,n.y);float tn=mw.x;
 float wHigh=smoothstep(.5,.64,tn);
 vec4 n5=texture(uNoise,p*2600.);float nf=smoothstep(.07,.004,dist);
 nd=normalize(nd+vec3(n5.r-.5,0.,n5.g-.5)*.45*nf);
 vec3 sand=mix(vec3(.4,.32,.2),vec3(.55,.46,.31),n3.b);
 vec3 soil=mix(vec3(.06,.045,.028),vec3(.115,.085,.05),n3.r);
 vec3 rock=mix(vec3(.1,.095,.09),vec3(.27,.25,.22),n2.g*.55+n3.g*.45)*(.9+.2*n1.b)*(.94+.12*sin(h0*230.+n1.r*5.));
 rock=mix(rock,vec3(.11,.13,.06),smoothstep(.55,.8,n2.a)*.35*(1.-wHigh));
 vec3 pt=grassPatch(p);vec3 tip=grassTipCol(pt,.5);
 // near the camera real blades cover the ground, so it is dark thatch; beyond the blades it takes the mean blade colour
 vec2 gq=abs(p-uGFar.xy);float gfar=uGFar.z>0.?1.-uGFar.w*(1.-smoothstep(uGFar.z*.5,uGFar.z*2.5,max(gq.x,gq.y))):1.;
 vec3 gcol=mix(mix(soil*.6,tip*.22,.6),tip*(.62+.3*n3.a),gfar);
 vec3 high=mix(soil*1.6,rock,.45+.4*n2.b);
 vec3 alb=mix(soil,gcol,smoothstep(0.,.25,mw.w));
 alb=mix(alb,high,wHigh);alb=mix(alb,sand,mw.z);alb=mix(alb,rock,mw.y);
 alb*=1.+(n5.a-.5)*.7*nf+(n4.a-.5)*.3*smoothstep(.3,.02,dist);
 float snow=max(smoothstep(.8,.9,tn),snowAt(p)*1.3)*smoothstep(.45,.72,n.y+(n3.r-.5)*.2);snow=clamp(snow,0.,1.);
 float uw=smoothstep(seaY,seaY-.002,h0);
 alb=mix(alb,mix(sand*.75,vec3(.07,.09,.06),smoothstep(0.,.04,seaY-h0)),uw);snow*=1.-uw;
 vec2 wx=wxAt(p);float wet=clamp(uWxG.x+wx.r*(1.-wx.g)*1.2,0.,1.)*(1.-snow);
 wet=max(wet,smoothstep(seaY+.0022,seaY+.0003,h0));
 alb*=mix(1.,.5,wet);
 alb=mix(alb,vec3(.84,.88,.94),snow);
 // retro style: flat facets straight from the mesh triangles
 if(uRetro>.5){nd=normalize(cross(dFdx(vW),dFdy(vW)));if(nd.y<0.)nd=-nd;}
 float sh=shadowSun(vW,n)*cloudShadow(vW);
 float ndl=max(dot(nd,uSunDir),0.);
 vec3 amb=mix(uAmbGnd,uAmbSky,nd.y*.5+.5)*ao;
 float hw=max(uHu.w,1.),blob=1.-.5*min(uHu.w,1.)*smoothstep(.0035*hw,.0006*hw,length(p-uHu.xy))*step(abs(vW.y-uHu.z),.02);
 blob*=1.-.6*uTorn.z*smoothstep(.09,.01,length(p-uTorn.xy));
 vec3 col=alb*(uSunCol*ndl*sh+amb)*blob;
 vec3 V=normalize(uCam-vW),H=normalize(V+uSunDir);
 float sp=pow(max(dot(nd,H),0.),mix(18.,140.,wet))*(.015+.3*wet+.12*snow);
 col+=uSunCol*sp*sh*step(0.,ndl-.001);
 if(uw>0.){float c1=texture(uNoise,p*55.+uTime*.012).b,c2=texture(uNoise,p*71.-uTime*.015+.4).b;
  col+=alb*uSunCol*sh*pow(1.-abs(c1-c2),7.)*1.4*uw*exp(-(seaY-h0)*45.);}
 o=vec4(col,1.);}`;

// ---------- Grass: every blade is a curved, shaded strip placed and animated entirely in the vertex shader ----------
export const GRASS_VS = HEAD + COMMON + TERR + LIGHT + `
layout(location=0) in vec2 aV;
uniform vec4 uG,uGC,uGQ;
out vec3 vN,vW,vTip,vRoot;out vec4 vD;out vec3 vE;
void main(){
 int N=int(uG.x);ivec2 ij=ivec2(gl_InstanceID%N,gl_InstanceID/N);
 vec2 ac=floor(uGC.xy/uG.y+.5)+vec2(ij)-float(N/2);
 ivec2 ic=ivec2(ac)+ivec2(int(uGQ.w)*7919);
 vec3 r=hI3(ic),r2=hI3(ic+ivec2(917,131)),r3=hI3(ic+ivec2(57,3301));
 vec2 base=(ac+r.xy)*uG.y;
 gl_Position=vec4(2.,2.,2.,1.);vN=vec3(0.,1.,0.);vW=vTip=vRoot=vE=vec3(0.);vD=vec4(0.);
 vec2 dq=abs(base-uGC.xy);float dc=max(dq.x,dq.y);
 float fd=1.-smoothstep(uG.z*(uGQ.z>.5?.6:.8),uG.z*.98,dc);
 if(uG.w>0.){vec2 dp=abs(base-uGC.zw);float di=max(dp.x,dp.y);if(di<uG.w*.8)return;fd*=smoothstep(uG.w*.8,uG.w*.98,di);}
 if(fd<.03)return;
 if(footSdf(base)>.5)return;
 float hs=uTer.x,sea=uTer.y,y0=terrainY(base),t=(y0/hs-sea)/max(1.-sea,.01);
 if(t<.025||t>.66)return;
 // cheap frustum reject before the expensive part
 vec4 cb=uVP*vec4(base.x,y0,base.y,1.);if(cb.w<-.004||abs(cb.x)>cb.w*1.25+.01||cb.y<-cb.w*1.4-.01||cb.y>cb.w*1.6+.01)return;
 float e=.002,hx=terrainY(base+vec2(e,0.)),hz=terrainY(base+vec2(0.,e));
 vec3 gn=normalize(vec3(y0-hx,e,y0-hz));
 vec4 mw=matW(base,t,gn.y);vec3 pt=grassPatch(base);
 float snow=snowAt(base);
 if(mw.w<.14||r.z>uGQ.x*smoothstep(.1,.55,mw.w)*(.5+.6*pt.z))return;
 float flower=(r3.x>.988&&uG.y<.0004)?1.+floor(r2.y*3.):0.;
 float bh=(.00055+.001*r2.x*r2.x+.0003*r2.x)*uGQ.y*pt.y*fd*(1.-.65*snow)*(flower>0.?1.35:1.)*smoothstep(0.,.6,mw.w);
 float rw=.000028*(.7+.8*r2.y),wd=max(rw,min(uG.y*.4,rw*9.))*(.45+.55*fd);
 float th=r2.z*6.2831853;vec2 dir=vec2(cos(th),sin(th));
 vec2 wdir=uWind.xy;
 float gust=smoothstep(.3,.72,texture(uNoise,base*1.7-wdir*uTime*.03).r)*.75+.25*texture(uNoise,base*9.-wdir*uTime*.11).g;
 float wamt=uWind.z*(.2+.95*gust);
 float fl=sin(uTime*(5.+3.*r.x)+r.y*40.+dot(base,wdir)*700.)*uWind.z*.1;
 vec2 off=dir*(.12+.5*r3.y*r3.y)*(flower>0.?.3:1.)+wdir*wamt*.8+vec2(-wdir.y,wdir.x)*fl;
 vec2 d2=uTorn.xy-base;float dl=length(d2)+1e-4,tf=uTorn.z*smoothstep(.3,.02,dl);off+=(d2/dl*.5+vec2(-d2.y,d2.x)/dl*.9)*tf*1.2;
 vec2 dh=base-uHu.xy;float dsq=length(dh)+1e-5,pf=min(uHu.w,1.)*smoothstep(.0035*max(uHu.w,1.),0.,dsq);off+=dh/dsq*pf*1.4;
 off*=1.+snow*1.5;
 float ol=length(off);if(ol>.94){off*=.94/ol;ol=.94;}
 float ty=sqrt(1.-ol*ol);
 vec3 P0=vec3(base.x,y0-.00004,base.y),P2=P0+vec3(off.x,ty,off.y)*bh,P1=P0+vec3(off.x*.1,ty*.7,off.y*.1)*bh;
 float s=aV.y;vec3 pos=mix(mix(P0,P1,s),mix(P1,P2,s),s),tg=normalize(mix(P1-P0,P2-P1,s));
 vec3 side=normalize(vec3(-dir.y,0.,dir.x)+vec3(1e-4,0.,0.));
 vec3 vd=normalize(uCam-pos),cs=cross(tg,vd);float cl=length(cs);
 if(cl>.05){cs/=cl;side=normalize(mix(side,cs*(dot(cs,side)<0.?-1.:1.),.45));}
 vec3 nrm=normalize(cross(side,tg));
 float w=wd*(1.-s*s*.9);if(flower>0.)w*=s>.8?3.2:.55;
 float px=length(uCam-pos)*uProj.x*2./uRes.y;w=max(w,px*.6);
 pos+=side*aV.x*w*.5;
 vN=normalize(nrm+side*aV.x*.6);vW=pos;
 vD=vec4(s,aV.x,r3.z,flower);
 vTip=grassTipCol(pt,r3.z);vRoot=vTip*vec3(.2,.3,.25);
 float sh=shadowSun1(P0+vec3(0.,bh*.7,0.)+gn*uShB.x*2.)*cloudShadow(P0);
 vec2 wx=wxAt(base);
 vE=vec3(sh,snow,clamp(uWxG.x+wx.r*(1.-wx.g),0.,1.));
 gl_Position=uVP*vec4(pos,1.);}`;
export const GRASS_FS = HEAD + COMMON + `
in vec3 vN,vW,vTip,vRoot;in vec4 vD;in vec3 vE;out vec4 o;
void main(){
 vec3 N=normalize(vN),V=normalize(uCam-vW),L=uSunDir;if(dot(N,V)<0.)N=-N;
 float s=vD.x,sh=vE.x,wet=vE.z;
 vec3 alb=mix(vRoot,vTip,smoothstep(0.,.7,s));
 alb*=1.-.25*smoothstep(.22,0.,abs(vD.y))*(1.-s);
 alb*=(.8+.4*vD.z)*mix(1.,.72,wet);
 if(vD.w>.5&&s>.8){alb=vD.w<1.5?vec3(.85,.85,.8):vD.w<2.5?vec3(.9,.7,.08):vec3(.45,.2,.6);}
 float ndl=dot(N,L),ao=mix(.2,1.,smoothstep(0.,.75,s)),sao=mix(.35,1.,smoothstep(0.,.6,s));
 float vl=pow(max(dot(-V,L),0.),3.);
 vec3 trans=alb*vec3(1.3,1.35,.45);
 vec3 amb=mix(uAmbGnd,uAmbSky,N.y*.3+.7);
 vec3 col=alb*uSunCol*sh*sao*(max(ndl,0.)*.8+.2)+trans*uSunCol*sh*sao*max(-ndl,0.)*(.5+1.3*vl)+alb*amb*ao;
 vec3 H=normalize(L+V);
 col+=uSunCol*sh*sao*pow(max(dot(N,H),0.),50.)*(.1+.55*wet)*s;
 col=mix(col,vec3(.84,.88,.94)*(uSunCol*sh*(max(ndl,0.)*.6+.3)+amb),vE.y*smoothstep(.2,.9,s)*.85);
 o=vec4(col,1.);}`;

// ---------- Trees ----------
export const TREE_VS = HEAD + COMMON + `
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec2 aUV;layout(location=3) in vec2 aM;
layout(location=4) in vec4 aI;layout(location=5) in vec4 aJ;
out vec3 vW,vN;out vec2 vUV;out vec4 vM;
void main(){float c=cos(aJ.x),s=sin(aJ.x),H=.045*aI.w;
 vec3 p=vec3(aP.x*c-aP.z*s,aP.y,aP.x*s+aP.z*c)*H;float h2=aP.y*aP.y;
 vec2 sw=uWind.xy*uWind.z*(.4+.6*(.5+.5*sin(uTime*1.3+aI.x*40.+aI.z*30.)))*H*.05*h2;
 sw+=vec2(sin(uTime*5.+aP.x*20.+aI.x*90.),cos(uTime*4.+aP.z*20.+aI.z*70.))*uWind.z*H*.012*h2*aM.x;
 vW=aI.xyz+p+vec3(sw.x,0.,sw.y);vN=vec3(aN.x*c-aN.z*s,aN.y,aN.x*s+aN.z*c);vUV=aUV;vM=vec4(aM,aJ.y,aP.y);
 gl_Position=uVP*vec4(vW,1.);}`;
export const TREE_SHADOW_FS = HEAD + `in vec2 vUV;in vec4 vM;uniform sampler2D uLeaf;out vec4 o;
void main(){if(vM.x>.5&&texture(uLeaf,vUV).a<.2)discard;o=vec4(0.);}`;
export const TREE_FS = HEAD + COMMON + TERR + LIGHT + `
in vec3 vW,vN;in vec2 vUV;in vec4 vM;uniform sampler2D uLeaf;uniform vec3 uLeafCol;out vec4 o;
void main(){vec3 N=normalize(vN),V=normalize(uCam-vW),L=uSunDir;
 float sh=shadowSun(vW,N)*cloudShadow(vW),snow=snowAt(vW.xz);
 vec2 wx=wxAt(vW.xz);float wet=clamp(uWxG.x+wx.r*(1.-wx.g),0.,1.);
 if(vM.x>.5){
  // far away the leaf texture is sampled from small mips where alpha averages out, so the cut-off drops to keep the crown full
  vec4 t=texture(uLeaf,vUV);float ml=log2(max(max(length(dFdx(vUV)),length(dFdy(vUV)))*256.,1.)),cut=mix(.45,.1,clamp(ml/3.5,0.,1.));
  float a=(t.a-cut)/max(fwidth(t.a),1e-4)+.5;if(a<.05)discard;
  vec3 alb=uLeafCol*(t.rgb/max(t.a,.05))*(.7+.6*vM.z)*mix(1.,.75,wet);
  float inner=mix(.3,1.,smoothstep(.15,.95,vM.y)),ndl=dot(N,L);
  vec3 amb=mix(uAmbGnd,uAmbSky,N.y*.4+.6)*inner;
  float vl=pow(max(dot(-V,L),0.),3.);
  vec3 col=alb*(uSunCol*sh*inner*(max(ndl,0.)*.75+.12)+amb)+alb*vec3(1.25,1.3,.4)*uSunCol*sh*inner*max(-ndl,0.)*(.3+.9*vl);
  col+=uSunCol*sh*inner*pow(max(dot(N,normalize(L+V)),0.),30.)*(.04+.25*wet);
  col=mix(col,vec3(.84,.88,.94)*(uSunCol*sh*(max(ndl,0.)*.6+.3)+amb),snow*smoothstep(-.1,.6,N.y)*.8);
  o=vec4(col,clamp(a,0.,1.));
 }else{
  float n=texture(uNoise,vUV*vec2(1.5,.35)).r,n2=texture(uNoise,vUV*3.).g;
  vec3 alb=mix(vec3(.045,.032,.022),vec3(.16,.125,.09),n*.7+n2*.3)*mix(1.,.6,wet);
  alb=mix(alb,vec3(.07,.1,.04),smoothstep(.6,.9,n2)*.4);
  float ndl=max(dot(N,L),0.);vec3 amb=mix(uAmbGnd,uAmbSky,N.y*.5+.5)*mix(.5,1.,smoothstep(0.,.3,vM.w))*.8;
  o=vec4(alb*(uSunCol*ndl*sh+amb),1.);}}`;

// ---------- Raymarched creatures and machines: one signed-distance shader builds every animal, the hunter, the craft and the weapons ----------
// instance: aI = position + unit size, aJ = heading, kind, animation phase, state, aK = roll, pitch, parachute
// kinds: 0-3 rabbit deer fox wolf, 4-7 hawk eagle robin dragon, 8 hunter, 10-16 craft, 20-24 weapons
const BND = `
vec4 bnd(float k,float chute){
 if(k>29.5)return vec4(0.,.9,0.,2.6);
 if(k>19.5)return vec4(.7,.2,0.,2.9);
 if(k>9.5)return vec4(0.,1.2,0.,5.9);
 if(k>7.5)return chute>0.?vec4(0.,4.2,0.,6.6):vec4(0.,1.9,0.,3.3);
 if(k>3.5)return vec4(0.,0.,0.,k>6.5?4.1:3.);
 return vec4(0.,1.25,0.,2.7);}`;
export const IMP_VS = HEAD + COMMON + LIGHT.replace(/float cloudCov[\s\S]*?return c;}/, 'float cloudCov(vec2 xz){return 0.;}') + BND + `
layout(location=0) in vec2 aQ;layout(location=1) in vec4 aI;layout(location=2) in vec4 aJ;layout(location=3) in vec4 aK;
out vec3 vW;flat out vec4 fI,fJ,fK;flat out vec3 fX,fY,fZ;flat out float fSh;
void main(){float hh=aJ.x;vec3 ex=vec3(cos(hh),0.,sin(hh)),ey=vec3(0.,1.,0.),ez=vec3(-sin(hh),0.,cos(hh));
 float cp=cos(aK.y),sp=sin(aK.y);vec3 ex2=ex*cp+ey*sp,ey2=ey*cp-ex*sp;
 float cr=cos(aK.x),sr=sin(aK.x);vec3 ey3=ey2*cr+ez*sr,ez3=ez*cr-ey2*sr;
 fX=ex2;fY=ey3;fZ=ez3;
 vec4 b=bnd(aJ.y,aK.z);vec3 ctr=aI.xyz+(fX*b.x+fY*b.y+fZ*b.z)*aI.w;
 vec3 w=ctr+(uCamR*aQ.x+uCamU*aQ.y)*b.w*aI.w*1.12;vW=w;fI=aI;fJ=aJ;fK=aK;
 fSh=aJ.y>19.5?1.:shadowSun1(aI.xyz+vec3(0.,aI.w*1.5,0.));
 gl_Position=uVP*vec4(w,1.);}`;
const IMP_A = HEAD + COMMON + BND + `
uniform vec3 uA[32],uB[32],uC[32];
in vec3 vW;flat in vec4 fI,fJ,fK;flat in vec3 fX,fY,fZ;flat in float fSh;out vec4 o;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec2 Um(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 Sm(vec2 a,vec2 b,float k){float h=clamp(.5+.5*(b.x-a.x)/k,0.,1.);return vec2(mix(b.x,a.x,h)-k*h*(1.-h),a.x<b.x?a.y:b.y);}
float sph(vec3 p,vec3 c,float r){return length(p-c)-r;}
float ell(vec3 p,vec3 c,vec3 r){return(length((p-c)/r)-1.)*min(r.x,min(r.y,r.z));}
float cap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.))-r;}
float bxx(vec3 p,vec3 c,vec3 b){vec3 q=abs(p-c)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);}
vec4 pa(float k){return k<.5?vec4(.55,.3,.28,.24):k<1.5?vec4(.8,.35,.95,.2):k<2.5?vec4(.65,.26,.38,.2):vec4(.8,.34,.6,.24);}
`;
const F_AN = `
vec2 map(vec3 p){float k=fJ.y;vec4 A=pa(k);
 vec4 B=k<.5?vec4(.75,.18,.1,.1):k<1.5?vec4(.2,.14,.25,.5):k<2.5?vec4(.3,.42,.3,.2):vec4(.3,.3,.28,.3);
 if(fJ.w>1.5)p=vec3(p.x,p.z,-p.y+.4);
 float bl=A.x,bh=A.y,ll=A.z,hs=A.w,by=ll+bh*.8,ph=fJ.z;
 vec2 d=vec2(ell(p,vec3(bl*.35,by+bh*.08,0.),vec3(bl*.62,bh*1.05,bh*.85)),0.);
 d=Sm(d,vec2(ell(p,vec3(-bl*.4,by,0.),vec3(bl*.6,bh*.95,bh*.8)),0.),.18);
 for(int i=0;i<4;i++){float f=float(i),fr=i<2?-1.:1.,sx=fr*bl*(fr<0.?.55:.5),z=(mod(f,2.)<.5?-1.:1.)*bh*.45,ar=ph+f*1.7+(mod(f,2.)<.5?0.:3.14),sw=sin(ar)*.3*ll,lf=max(0.,cos(ar))*.06;
  vec3 hip=vec3(sx,by-bh*.2,z),kn=vec3(sx+sw*.4-fr*.06*ll,ll*.5,z),ft=vec3(sx+sw,.02+lf,z);
  d=Sm(d,vec2(cap(p,hip,kn,.09+bh*.12),0.),.08);d=Um(d,vec2(cap(p,kn,ft,.045+bh*.07),2.));d=Um(d,vec2(ell(p,ft+vec3(.04,.02,0.),vec3(.09,.04,.06)),2.));}
 vec3 h0=vec3(bl*.8+B.w,by+bh*.45+B.w*.9,0.),hc=h0+vec3(hs*.45,hs*.15,0.);
 d=Sm(d,vec2(cap(p,vec3(bl*.7,by+bh*.4,0.),h0,hs*.62),0.),.12);
 d=Sm(d,vec2(ell(p,hc,vec3(hs*.95,hs*.8,hs*.72)),0.),.08);
 d=Sm(d,vec2(ell(p,hc+vec3(hs*.85+B.z*.5,-hs*.22,0.),vec3(hs*.55+B.z*.5,hs*.34,hs*.38)),1.),.06);
 d=Um(d,vec2(sph(p,hc+vec3(hs*1.35+B.z,-hs*.15,0.),.045),7.));
 d=Um(d,vec2(sph(p,hc+vec3(hs*.45,hs*.2,hs*.62),.04),7.));d=Um(d,vec2(sph(p,hc+vec3(hs*.45,hs*.2,-hs*.62),.04),7.));
 d=Um(d,vec2(ell(p,hc+vec3(-hs*.3,hs*.75+B.x*.5,hs*.45),vec3(hs*.2,B.x*.55+.05,hs*.09)),0.));
 d=Um(d,vec2(ell(p,hc+vec3(-hs*.3,hs*.75+B.x*.5,-hs*.45),vec3(hs*.2,B.x*.55+.05,hs*.09)),0.));
 d=Sm(d,vec2(ell(p,vec3(-bl*.95,by+bh*.25,0.),vec3(B.y*1.1,B.y*.7,B.y*.7)),k<.5?1.:(k>1.5&&k<2.5&&p.x<-bl-B.y*.5?1.:0.)),.1);
 if(k>.5&&k<1.5){for(int s=0;s<2;s++){float z=s==0?-1.:1.;vec3 b0=hc+vec3(-hs*.2,hs*.7,z*hs*.35),b1=b0+vec3(-.05,.5,z*.15),b2=b1+vec3(.12,.35,z*.12);
  d=Um(d,vec2(cap(p,b0,b1,.03),6.));d=Um(d,vec2(cap(p,b1,b2,.025),6.));d=Um(d,vec2(cap(p,b1,b1+vec3(-.2,.25,z*.05),.022),6.));}}
 d.x+=.012*(n3(p*14.)-.5);return d;}
`;
const F_HU = `
vec2 map(vec3 p){float ph=fJ.z,sw=fJ.w;vec3 p0=p;p.y-=.04*abs(sin(ph))*(1.-sw);
 vec2 d=vec2(ell(p,vec3(0.,1.7,0.),vec3(.27,.38,.4)),0.);
 d=Sm(d,vec2(ell(p,vec3(0.,2.5,0.),vec3(.3,.75,.48)),0.),.25);
 d=Um(d,vec2(ell(p,vec3(.03,2.55,0.),vec3(.33,.5,.5)),1.));d=Um(d,vec2(bxx(p,vec3(-.42,2.5,0.),vec3(.18,.5,.33)),6.));
 d=Um(d,vec2(cap(p,vec3(0.,3.05,0.),vec3(.02,3.3,0.),.12),5.));d=Sm(d,vec2(ell(p,vec3(.03,3.55,0.),vec3(.27,.3,.25)),5.),.05);
 d=Um(d,vec2(ell(p,vec3(0.,3.74,0.),vec3(.3,.13,.28)),1.));d=Um(d,vec2(ell(p,vec3(.2,3.66,0.),vec3(.24,.035,.26)),1.));
 d=Um(d,vec2(sph(p,vec3(.28,3.5,0.),.055),5.));d=Um(d,vec2(sph(p,vec3(.22,3.6,.12),.035),7.));d=Um(d,vec2(sph(p,vec3(.22,3.6,-.12),.035),7.));
 for(int i=0;i<2;i++){float s=i==0?-1.:1.,z=s*.2,ar=ph+(i==0?0.:3.14159),a=sin(ar)*.55,lift=max(0.,cos(ar))*.25*(1.-sw);
  vec3 hip=vec3(0.,1.55,z),kn=vec3(a*.5+.1,.85+lift*.4,z),ft=vec3(a,.08+lift,z);
  d=Sm(d,vec2(cap(p,hip,kn,.17),0.),.1);d=Um(d,vec2(cap(p,kn,ft,.12),0.));d=Um(d,vec2(ell(p,ft+vec3(.14,.06,0.),vec3(.3,.12,.15)),2.));
  vec3 sh=vec3(0.,2.95,s*.5),el=vec3(.35,2.5,s*.55),hd=vec3(.95,2.55,s*.12);
  if(sw>.5){float st=sin(ar);hd=vec3(.5+st*.5,3.+max(0.,st)*.4,s*.6);el=vec3(.3+st*.2,2.9,s*.6);}
  d=Um(d,vec2(cap(p,sh,el,.13),0.));d=Um(d,vec2(cap(p,el,hd,.1),0.));d=Um(d,vec2(sph(p,hd,.09),5.));}
 if(sw<.5){d=Um(d,vec2(cap(p,vec3(.15,2.5,.1),vec3(2.1,2.68,.1),.065),2.));d=Um(d,vec2(bxx(p,vec3(.25,2.45,.1),vec3(.35,.14,.07)),6.));}
 if(sw>.5)d.x=max(d.x,1.55-p.y);
 d.x+=.008*(n3(p*10.)-.5);
 if(fK.z>0.){float c=fK.z,R=2.9*c;vec3 q=p0-vec3(0.,6.2,0.);
  float shl=max(abs(length(q/vec3(1.,.75,1.))-R)*.75-.03,-q.y);
  d=Um(d,vec2(shl,mod(floor((atan(q.z,q.x)+3.14159)/.5236),2.)<.5?1.:8.));
  for(int i=0;i<4;i++){float a=float(i)*1.5708+.785;d=Um(d,vec2(cap(p0,vec3(0.,3.,0.),vec3(cos(a)*R,6.2,sin(a)*R),.02),6.));}}
 return d;}
`;
const F_BRD = `
vec2 map(vec3 p){float k=fJ.y-4.,fl=sin(fJ.z)*(fJ.w>1.5?0.:1.),az=abs(p.z),s=p.z<0.?-1.:1.;if(fJ.w>1.5)p.y=-p.y;vec2 d=vec2(1e3,0.);
 if(k<1.5){float sc=k<.5?1.:1.3;p/=sc;az=abs(p.z);
  d=vec2(ell(p,vec3(0.),vec3(.75,.28,.26)),0.);d=Sm(d,vec2(sph(p,vec3(.85,.1,0.),.2),k<.5?0.:1.),.08);
  d=Um(d,vec2(ell(p,vec3(1.12,.03,0.),vec3(.17,.07,.06)),4.));d=Um(d,vec2(sph(p,vec3(.95,.18,.1),.035),7.));d=Um(d,vec2(sph(p,vec3(.95,.18,-.1),.035),7.));
  d=Um(d,vec2(ell(p,vec3(-1.,0.,0.),vec3(.5,.03,.28)),1.));
  float t=clamp((az-.2)/(k<.5?1.7:2.1),0.,1.),wy=.08+fl*t*t;
  d=Um(d,vec2(max(az-(k<.5?1.9:2.3),max(abs(p.x-(.05-.12*t))-(.42-.18*t),abs(p.y-wy)-.04*(1.-t*.6))),t>.75?2.:0.));
  d=Um(d,vec2(cap(p,vec3(.1,-.2,s*.1),vec3(.2,-.45,s*.1),.04),4.));d.x*=sc;}
 else if(k<2.5){d=vec2(ell(p,vec3(0.),vec3(.42,.36,.32)),0.);d=Sm(d,vec2(ell(p,vec3(.2,-.1,0.),vec3(.3,.28,.3)),1.),.1);d=Sm(d,vec2(sph(p,vec3(.42,.3,0.),.24),0.),.1);
  d=Um(d,vec2(ell(p,vec3(.66,.28,0.),vec3(.12,.05,.05)),4.));d=Um(d,vec2(sph(p,vec3(.52,.38,.14),.035),7.));d=Um(d,vec2(sph(p,vec3(.52,.38,-.14),.035),7.));
  d=Um(d,vec2(ell(p,vec3(-.55,.05,0.),vec3(.4,.05,.12)),2.));
  float t=clamp((az-.15)/.9,0.,1.),wy=.1+fl*.7*t*t;d=Um(d,vec2(max(az-1.,max(abs(p.x+.05*t)-(.3-.12*t),abs(p.y-wy)-.03)),2.));
  d=Um(d,vec2(cap(p,vec3(0.,-.25,s*.1),vec3(.05,-.55,s*.1),.03),2.));}
 else{d=vec2(ell(p,vec3(0.),vec3(1.,.45,.42)),0.);d=Sm(d,vec2(cap(p,vec3(.8,.1,0.),vec3(1.6,.55,0.),.22),0.),.15);d=Sm(d,vec2(ell(p,vec3(1.9,.62,0.),vec3(.42,.2,.18)),0.),.08);
  d=Um(d,vec2(cap(p,vec3(1.75,.8,.1),vec3(1.5,1.3,.18),.04),2.));d=Um(d,vec2(cap(p,vec3(1.75,.8,-.1),vec3(1.5,1.3,-.18),.04),2.));
  d=Um(d,vec2(sph(p,vec3(1.95,.7,.15),.05),4.));d=Um(d,vec2(sph(p,vec3(1.95,.7,-.15),.05),4.));
  d=Sm(d,vec2(cap(p,vec3(-.9,0.,0.),vec3(-2.1,-.1,0.),.28),0.),.2);d=Um(d,vec2(cap(p,vec3(-2.1,-.1,0.),vec3(-3.3,.1,0.),.13),0.));d=Um(d,vec2(ell(p,vec3(-3.4,.12,0.),vec3(.25,.04,.22)),1.));
  for(int i=0;i<5;i++){float f=float(i);d=Um(d,vec2(cap(p,vec3(.6-.45*f,.4-.02*f,0.),vec3(.55-.45*f,.7-.06*f,0.),.05),2.));}
  float t=clamp((az-.3)/3.,0.,1.),wy=.3+fl*1.5*t*t;
  d=Um(d,vec2(max(az-3.3,max(abs(p.x-(.2-1.1*t+.45*sin(t*9.)*t))-(.7-.35*t),abs(p.y-wy)-.035)),1.));
  d=Um(d,vec2(cap(p,vec3(.3,.35,s*.3),vec3(.1,.3+fl*1.5,s*3.1),.08),2.));d=Um(d,vec2(cap(p,vec3(.4,-.3,s*.3),vec3(.5,-.7,s*.35),.12),2.));}
 return d;}
`;
// craft space: x across, y up, z forward
const F_CR = `
vec2 map(vec3 q){vec3 p=vec3(q.z,q.y,q.x);float K=fJ.y-10.,uT=uTime;vec2 d;float s=p.x<0.?-1.:1.;
 if(K<.5){d=vec2(cap(p,vec3(0.,0.,-1.6),vec3(0.,0.,1.4),.38),0.);d=Sm(d,vec2(bxx(p,vec3(0.,.05,.1),vec3(2.5,.07,.55)),0.),.1);
  d=Um(d,vec2(bxx(p,vec3(0.,.12,-1.4),vec3(1.,.05,.3)),0.));d=Um(d,vec2(bxx(p,vec3(0.,.65,-1.4),vec3(.05,.65,.35)),1.));
  d=Um(d,vec2(bxx(p,vec3(s*2.4,.05,.1),vec3(.13,.08,.55)),1.));d=Um(d,vec2(sph(p,vec3(0.,0.,1.45),.3),2.));
  d=Um(d,vec2(ell(p,vec3(0.,.28,.7),vec3(.26,.2,.5)),3.));}
 else if(K<1.5){d=vec2(ell(p,vec3(0.),vec3(2.3,.5,2.3)),0.);d=Um(d,vec2(ell(p,vec3(0.,.35,0.),vec3(1.,.8,1.)),3.));d=Sm(d,vec2(ell(p,vec3(0.,-.3,0.),vec3(1.2,.35,1.2)),2.),.15);
  d=Um(d,vec2(sph(p,vec3(s*1.4,0.,-2.1),.28+.06*sin(uT*25.)),4.));d=Um(d,vec2(bxx(p,vec3(0.,.5,-2.),vec3(.08,.5,.3)),1.));}
 else if(K<2.5){float sz=p.z<0.?-1.:1.;d=vec2(ell(p,vec3(0.,3.,0.),vec3(1.8,2.1,1.8)),mod(floor((atan(p.x,p.z)+3.14159)/.5236),2.)<.5?0.:1.);
  d=Um(d,vec2(bxx(p,vec3(0.,-.4,0.),vec3(.5,.35,.5)),2.));d=Um(d,vec2(cap(p,vec3(s*.45,-.1,sz*.45),vec3(s*1.3,1.3,sz*1.3),.04),2.));d=Um(d,vec2(sph(p,vec3(0.,.9,0.),.25+.05*sin(uT*9.)),4.));}
 else if(K<3.5){d=vec2(cap(p,vec3(0.,0.,-.7),vec3(0.,0.,.5),.3),0.);d=Sm(d,vec2(sph(p,vec3(0.,.04,.85),.23),5.),.1);d=Sm(d,vec2(ell(p,vec3(0.,.12,.78),vec3(.24,.2,.22)),6.),.05);
  d=Um(d,vec2(cap(p,vec3(s*.3,0.,.3),vec3(s*.15,0.,1.7),.12),0.));d=Um(d,vec2(cap(p,vec3(s*.12,-.02,-.7),vec3(s*.12,.05,-2.),.13),0.));d=Um(d,vec2(cap(p,vec3(s*.12,.05,-1.8),vec3(s*.12,.05,-2.15),.15),1.));
  d=Um(d,vec2(ell(p,vec3(0.,.15+.08*sin(uT*8.+p.z*3.),-1.2),vec3(1.,.05,1.3)),1.));}
 else if(K<4.5){d=vec2(max(ell(p,vec3(0.),vec3(1.6,.9,2.6)),p.y-.45),0.);d=Um(d,vec2(bxx(p,vec3(0.,.7,-1.9),vec3(1.1,.4,.6)),0.));d=Um(d,vec2(cap(p,vec3(0.,.4,.3),vec3(0.,3.9,.3),.09),2.));
  d=Um(d,vec2(bxx(p,vec3(0.,2.3,.3+.1*sin(uT*2.+p.y)),vec3(1.5,1.2,.05)),1.));d=Um(d,vec2(bxx(p,vec3(.4,3.8,.3),vec3(.4,.22,.03)),2.));
  d=Um(d,vec2(sph(p,vec3(s*1.3,.6,-1.9),.18),4.));d=Um(d,vec2(sph(p,vec3(0.,-.9,0.),.5+.1*sin(uT*5.)),9.));}
 else if(K<5.5){float fl=sin(uT*5.)*(.6+.4*sin(uT*.6)),t=clamp((abs(p.x)-.35)/2.55,0.,1.);
  d=vec2(ell(p,vec3(0.),vec3(.4,.35,.9)),0.);d=Sm(d,vec2(sph(p,vec3(0.,.12,.95),.27),8.),.1);d=Um(d,vec2(bxx(p,vec3(0.,0.,-1.2),vec3(.35,.04,.5)),8.));
  d=Um(d,vec2(ell(p,vec3(0.,.08,1.25),vec3(.07,.07,.16)),4.));
  d=Um(d,vec2(max(abs(p.x)-2.9,max(abs(p.z-.1+t*.3)-.55*(1.-.5*t),abs(p.y-(.1+fl*1.3*t))-.06)),t>.75?2.:0.));}
 else{float fl=sin(uT*2.6),t=clamp((abs(p.x)-.4)/3.7,0.,1.);
  d=vec2(ell(p,vec3(0.),vec3(.6,.55,1.5)),0.);d=Sm(d,vec2(cap(p,vec3(0.,.1,1.2),vec3(0.,.55,2.6),.3),0.),.2);d=Sm(d,vec2(ell(p,vec3(0.,.65,2.9),vec3(.28,.22,.5)),0.),.1);
  d=Um(d,vec2(cap(p,vec3(s*.15,.8,2.7),vec3(s*.3,1.3,2.2),.05),2.));d=Um(d,vec2(sph(p,vec3(s*.2,.75,2.95),.06),4.));
  d=Sm(d,vec2(cap(p,vec3(0.,-.05,-1.2),vec3(0.,0.,-3.2),.32),0.),.25);d=Um(d,vec2(cap(p,vec3(0.,0.,-3.2),vec3(0.,.1,-4.6),.15),0.));
  d=Um(d,vec2(bxx(p,vec3(0.,.5,-1.),vec3(.05,.25,1.8)),2.));
  d=Um(d,vec2(max(abs(p.x)-4.3,max(abs(p.z-(.3-1.6*t+.5*sin(t*9.)*t))-(1.2-.7*t),abs(p.y-(.35+fl*1.6*t*t))-.04)),1.));
  d=Um(d,vec2(cap(p,vec3(s*.4,.4,.4),vec3(s*4.1,.4+fl*1.6,0.),.09),2.));}
 return d;}
`;
// weapon space: barrel along +z
const F_WP = `
vec2 map(vec3 p){vec3 q=vec3(p.z,p.y,p.x);float k=fJ.y-20.;vec2 d;
 if(k<.5){d=vec2(bxx(q,vec3(0.,.25,.8),vec3(.2,.22,.9)),2.);d=Um(d,vec2(bxx(q,vec3(0.,-.5,-.1),vec3(.17,.55,.2)),0.));}
 else if(k<1.5){d=vec2(cap(q,vec3(0.,.3,0.),vec3(0.,.3,3.4),.1),2.);d=Um(d,vec2(bxx(q,vec3(0.,.15,.2),vec3(.2,.25,1.)),0.));d=Um(d,vec2(bxx(q,vec3(0.,-.1,-1.2),vec3(.2,.4,.9)),0.));d=Um(d,vec2(cap(q,vec3(0.,.6,.8),vec3(0.,.6,1.8),.13),2.));}
 else if(k<2.5){d=vec2(cap(q,vec3(-.12,.3,0.),vec3(-.12,.3,3.),.1),2.);d=Um(d,vec2(cap(q,vec3(.12,.3,0.),vec3(.12,.3,3.),.1),2.));d=Um(d,vec2(bxx(q,vec3(0.,.1,.2),vec3(.25,.25,.9)),0.));d=Um(d,vec2(bxx(q,vec3(0.,-.1,-1.2),vec3(.22,.4,.9)),0.));}
 else if(k<3.5){d=vec2(cap(q,vec3(-1.8,0.,.2),vec3(-.9,0.,1.),.08),0.);d=Um(d,vec2(cap(q,vec3(-.9,0.,1.),vec3(.9,0.,1.),.08),0.));d=Um(d,vec2(cap(q,vec3(.9,0.,1.),vec3(1.8,0.,.2),.08),0.));
  d=Um(d,vec2(cap(q,vec3(-1.8,0.,.2),vec3(1.8,0.,.2),.02),1.));d=Um(d,vec2(cap(q,vec3(0.,0.,-.4),vec3(0.,0.,2.6),.04),1.));}
 else{d=vec2(cap(q,vec3(0.,.3,0.),vec3(0.,.3,2.6),.12),2.);d=Um(d,vec2(bxx(q,vec3(0.,.1,.3),vec3(.28,.35,1.)),0.));d=Um(d,vec2(bxx(q,vec3(0.,-.7,.5),vec3(.15,.5,.25)),2.));d=Um(d,vec2(bxx(q,vec3(0.,0.,-1.3),vec3(.2,.3,.6)),0.));}
 return d;}
`;
// Lander craft (feet at y=0). kind 30: retro faceted pod on three legs. kind 31: modern quad-thruster lander.
// fK.z = throttle, fK.w = landing gear down
const F_LD = `
vec2 map(vec3 p){vec2 d;
 if(fJ.y<30.5){vec3 c=vec3(0.,1.05,0.);float b=p.y-c.y-.42,m=0.;
  for(int i=0;i<6;i++){float a=float(i)*1.0472;vec3 n=normalize(vec3(cos(a),.6,sin(a)));float e=dot(p-c,n)-.72;if(e>b){b=e;m=mod(float(i),2.);}
   n=normalize(vec3(cos(a),-1.1,sin(a)));e=dot(p-c,n)-.5;if(e>b){b=e;m=2.;}}
  d=vec2(b,m);
  d=Um(d,vec2(bxx(p,vec3(.5,1.3,0.),vec3(.22,.1,.3)),6.));
  for(int i=0;i<3;i++){float a=float(i)*2.0944+1.0472;vec3 f=vec3(cos(a)*1.15,.04,sin(a)*1.15);
   d=Um(d,vec2(cap(p,vec3(cos(a)*.45,.75,sin(a)*.45),f,.05),2.));d=Um(d,vec2(bxx(p,f,vec3(.16,.04,.16)),1.));}
  d=Um(d,vec2(max(length(p.xz)-.26,abs(p.y-.52)-.12),2.));
  return d;}
 vec3 q=vec3(abs(p.x),p.y,abs(p.z));float g=fK.w;
 d=vec2(ell(p,vec3(.05,1.05,0.),vec3(1.2,.4,.68)),0.);
 d=Sm(d,vec2(ell(p,vec3(-.95,1.12,0.),vec3(.75,.2,.26)),0.),.25);
 d=Sm(d,vec2(ell(p,vec3(.6,1.27,0.),vec3(.5,.25,.36)),3.),.04);
 d=Um(d,vec2(bxx(vec3(p.x,p.y,q.z),vec3(-1.45,1.45,.3),vec3(.22,.3,.025)),1.));
 d=Um(d,vec2(cap(vec3(p.x,p.y,q.z),vec3(-1.3,1.15,.05),vec3(-1.5,1.2,.3),.05),2.));
 vec3 nc=vec3(.78,1.02,1.08);
 d=Um(d,vec2(cap(q,vec3(.4,1.05,.4),nc,.085),2.));
 d=Um(d,vec2(max(length(q.xz-nc.xz)-.3,abs(q.y-nc.y)-.2),1.));
 d=Um(d,vec2(max(abs(length(q.xz-nc.xz)-.3)-.035,abs(q.y-nc.y-.2)-.03),2.));
 d=Um(d,vec2(max(length(q.xz-nc.xz)-.24,abs(q.y-nc.y+.2)-.035),9.));
 d=Um(d,vec2(sph(q,nc+vec3(.28,.12,.2),.05),4.));
 vec3 ft=mix(vec3(.45,.72,.5),vec3(.5,.06,.62),g);
 d=Um(d,vec2(cap(q,vec3(.3,.8,.3),ft,.05),2.));d=Um(d,vec2(ell(q,ft-vec3(0.,.02,0.),vec3(.17,.045,.17)),6.));
 d=Um(d,vec2(cap(p,vec3(-.4,1.4,0.),vec3(-.55,1.95,0.),.018),2.));d=Um(d,vec2(sph(p,vec3(-.55,1.97,0.),.04),4.));
 return d;}
`;
const IMP_B = `
vec3 mc(float m,vec3 p){int k=int(fJ.y+.5);vec3 a=uA[k],b=uB[k],c=uC[k];
 if(m<.5)return fJ.y<7.5?a*(.82+.36*n3(p*vec3(5.,13.,13.))):a;
 return m<1.5?b:m<2.5?c:m<3.5?vec3(.45,.85,.95):m<4.5?vec3(1.,.8,.4):m<5.5?vec3(.9,.7,.56):m<6.5?vec3(.2,.13,.08):m<7.5?vec3(.025):m<8.5?vec3(.95,.94,.9):vec3(.7,.5,1.);}
void main(){float u=fI.w,k=fJ.y;
 vec3 rdw=normalize(vW-uCam),rw=uCam-fI.xyz;
 vec3 ro=vec3(dot(rw,fX),dot(rw,fY),dot(rw,fZ))/u,rd=vec3(dot(rdw,fX),dot(rdw,fY),dot(rdw,fZ));
 vec4 b=bnd(k,fK.z);vec3 oc=ro-b.xyz;float bb=dot(oc,rd),dc=bb*bb-(dot(oc,oc)-b.w*b.w);if(dc<0.)discard;
 float t=max(-bb-sqrt(dc),0.),te=-bb+sqrt(dc);vec2 hr=vec2(1.,0.);vec3 p=ro;
 for(int i=0;i<72;i++){p=ro+rd*t;hr=map(p);if(hr.x<.004||t>te)break;t+=hr.x*.85;}
 if(hr.x>.02||t>te)discard;
 vec2 e=vec2(.012,0.);vec3 n=normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));
 vec3 nw=normalize(n.x*fX+n.y*fY+n.z*fZ),wp2=fI.xyz+(p.x*fX+p.y*fY+p.z*fZ)*u;
 vec4 cl=uVP*vec4(wp2,1.);gl_FragDepth=(cl.z/cl.w)*.5+.5;
 float m=hr.y;vec3 col=mc(m,p);
 if(k<3.5&&m<.5){vec4 A=pa(k);float bel=smoothstep(A.z+A.y*.9,A.z+A.y*.1,p.y);col=mix(col,uB[int(k+.5)],bel*.75);}
 col=pow(col,vec3(2.2));
 float dif=max(dot(nw,uSunDir),0.),ao=k<9.5?mix(.5,1.,smoothstep(0.,.5,p.y)):1.;
 vec3 amb=mix(uAmbGnd,uAmbSky,nw.y*.5+.5);
 float rim=pow(1.-max(dot(nw,-rdw),0.),3.);
 vec3 c=col*(uSunCol*dif*fSh+amb*ao)+amb*rim*.25;
 if(m>2.5&&m<3.5)c+=uSunCol*fSh*pow(max(dot(nw,normalize(uSunDir-rdw)),0.),60.)*.8+uAmbSky*rim*.8;
 if(k>9.5&&k<19.5&&((m>3.5&&m<4.5)||m>8.5))c=col*14.;
 if(k>29.5){
  if(k<30.5)c=col*(uSunCol*floor(dif*fSh*4.+.5)/4.+amb);
  else{c+=uSunCol*fSh*pow(max(dot(nw,normalize(uSunDir-rdw)),0.),48.)*.35+uAmbSky*rim*.35;
   if(m>8.5)c=vec3(.3,.6,1.)*(.6+34.*fK.z);
   if(m>3.5&&m<4.5)c=vec3(1.,.25,.1)*(2.+10.*step(.5,fract(uTime*1.2)));}}
 o=vec4(c,1.);}`;
// One small program per family (land animals, birds, hunter, craft, weapons): a single combined shader is too slow for drivers to compile
export const IMP_FS = [F_AN, F_BRD, F_HU, F_CR, F_WP, F_LD].map(f => IMP_A + f + IMP_B);
