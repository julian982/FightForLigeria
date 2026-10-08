// Les modèles low poly : arbres, bâtiments, unités, flèches, objets portés.
// ---- Arbres ----
import * as THREE from 'three';
import { S, gh } from '@ffl/shared';
import { B, C, I, K, M, TEAMC, TM, VC, boxM, cylM, dyn, gableGeo, merge, mk, teamColor } from './engine';
import { terrRing } from './world';
export const TREEGEO=[
  merge([[C(.06,.09,.45,5).translate(0,.22,0),0x6b4526],[K(.46,.72,6).translate(0,.75,0),0x2f5e2c],[K(.36,.6,6).translate(0,1.08,0),0x3a6e33],[K(.22,.45,6).translate(0,1.38,0),0x467d3a]]),
  merge([[C(.07,.1,.55,5).translate(0,.27,0),0x6b4526],[I(.46).translate(0,.9,0),0x4a8238],[I(.3).translate(.2,1.15,.1),0x5c9644],[I(.26).translate(-.22,.75,-.12),0x3f7231]]),
  merge([[C(.05,.07,.6,5).translate(0,.3,0),0xd8d2c4],[I(.34).translate(0,.95,0),0x7aa846],[I(.25).translate(.12,1.2,-.05),0x8bb852]]),
];
export function treeObj(t){const m=mk(TREEGEO[t.v],VC,t.x*S,gh(t.x,t.y)-.03,t.y*S);m.receiveShadow=false;const s=t.r/15;m.scale.set(s,s*(1.3+t.sh*.35),s);m.rotation.y=t.sh*6;dyn.add(m);t.obj=m}

// ---- Bâtiments ----
export function flag(g,b,h,x,z,big?,y0=0){
  g.add(cylM(.022,.028,h,5,M(0x4a3522),x,y0,z));
  const piv=new THREE.Group();piv.position.set(x,y0+h-.05,z);
  const fw=big?.5:.36,fh=big?.3:.22;
  piv.add(mk(B(fw,fh,.02),M(TEAMC[b.team].hex),fw/2,-fh/2,0));
  g.add(piv);b.flags.push(piv);
}
export function hut(g,b,o){
  const {x=0,z=0,w=1.2,d=1,h=.8,wall='timber',roof='thatch'}=o;
  g.add(boxM(w+.06,.1,d+.06,M(0x7d776b),x,0,z));
  g.add(boxM(w,h,d,TM(wall,Math.max(1,Math.round(w*1.2)),1),x,.1,z));
  const along=w>=d,rg=along?gableGeo(d+.18,w+.2,.62).rotateY(Math.PI/2):gableGeo(w+.18,d+.2,.62);
  g.add(mk(rg,TM(roof,2,2),x,.1+h,z));
  g.add(boxM(.24,.42,.04,TM('planks',1,1,0x8a7a6a),x-.1,.1,z+d/2+.01));
  g.add(boxM(.14,.14,.03,M(0x2b241c),x+.28,.42,z+d/2+.01));
  g.add(boxM(.1,.3,.02,M(TEAMC[b.team].hex),x-w/2+.1,.32,z+d/2+.016));g.add(boxM(.12,.03,.025,M(0xe3b54e),x-w/2+.1,.62,z+d/2+.016));
}
export function stoneBlocks(g,n,x,z){for(let i=0;i<n;i++)g.add(boxM(.2,.16,.2,M(i%2?0xe9e0c8:0xd9ceb3),x+(i%3)*.22-.22,(i/3|0)*.16,z+(i/3|0)*.06))}
export function logs(g,n,x,z){const rows=[3,2,1];let i=0;for(let row=0;row<3;row++)for(let j=0;j<rows[row]&&i<n;j++,i++)g.add(mk(C(.08,.08,.7,6).rotateZ(Math.PI/2),M(0x8a5a2b),x,.08+row*.14,z+(j-(rows[row]-1)/2)*.17))}
export const BUILD:Record<string,(g:any,b:any)=>void>={
  keep(g,b){
    g.add(boxM(3,.16,3,M(0x6e685d)));
    g.add(boxM(2.1,.08,2.1,M(0x8f7a58),0,.12,0));
    const wall=TM('stone',3,1),cr=M(0xd9ceb3);
    g.add(boxM(2.4,1,.3,wall,0,.16,-1.1));g.add(boxM(.3,1,2.4,wall,-1.1,.16,0));g.add(boxM(.3,1,2.4,wall,1.1,.16,0));
    g.add(boxM(.85,1,.3,wall,-.78,.16,1.1));g.add(boxM(.85,1,.3,wall,.78,.16,1.1));
    g.add(boxM(.7,.35,.3,wall,0,.81,1.1));
    g.add(boxM(.5,.62,.06,TM('planks',1,1,0x7a6a5a),0,.16,1.12));
    for(let i=-4;i<=4;i+=2){const o=i*.13;g.add(boxM(.14,.16,.32,cr,o,1.16,-1.1));g.add(boxM(.32,.16,.14,cr,-1.1,1.16,o));g.add(boxM(.32,.16,.14,cr,1.1,1.16,o));if(Math.abs(o)>.4)g.add(boxM(.14,.16,.32,cr,o,1.16,1.1))}
    for(const [x,z] of [[-1.15,-1.15],[1.15,-1.15],[-1.15,1.15],[1.15,1.15]]){
      g.add(cylM(.36,.42,1.55,8,TM('stone',2,1),x,.16,z));
      g.add(cylM(.42,.42,.12,8,cr,x,1.7,z));
      g.add(mk(K(.5,.75,8),M(TEAMC[b.team].hex),x,1.82+.37,z));
    }
    g.add(boxM(1.15,2.3,1.15,TM('stone',1,2),0,.16,-.2));
    for(let i=-1;i<=1;i++){const o=i*.42;g.add(boxM(.18,.18,.2,cr,o,2.46,-.72));g.add(boxM(.18,.18,.2,cr,o,2.46,.32));g.add(boxM(.2,.18,.18,cr,-.52,2.46,o-.2));g.add(boxM(.2,.18,.18,cr,.52,2.46,o-.2))}
    g.add(boxM(.14,.3,.04,M(0x1f1a14),0,1.3,.38));g.add(boxM(.04,.3,.14,M(0x1f1a14),.58,1.4,-.2));
    flag(g,b,1.1,0,-.2,true,2.46);
  },
  bucheron(g,b){
    hut(g,b,{x:-.3,z:-.3,w:1.1,d:.95,wall:'timber',roof:'thatch'});
    logs(g,6,.45,.5);
    g.add(cylM(.15,.17,.2,7,M(0x7a5230),.55,0,-.5));
    g.add(mk(B(.03,.36,.03).rotateZ(.5),M(0x5a3a1e),.55,.35,-.5));
    g.add(mk(B(.12,.06,.02),M(0xb8bec4),.48,.47,-.5));
    flag(g,b,.95,-.85,.7);
  },
  carriere(g,b){
    g.add(boxM(1.8,.06,1.8,M(0x5a5750)));
    g.add(boxM(1.2,.1,1.2,M(0x46433d),-.15,.02,-.15));
    for(let i=0;i<6;i++){const k=.12+i%3*.05;g.add(mk(new THREE.DodecahedronGeometry(k,0),M(0x9a968c),-.55+(i%3)*.35,k*.5,-.6+(i/3|0)*.4))}
    stoneBlocks(g,6,.5,.45);
    const wd=M(0x6b4a28);
    g.add(cylM(.04,.05,1.4,5,wd,-.7,0,.65));g.add(mk(B(1.0,.06,.06).rotateY(.75),wd,-.36,1.36,.33));
    g.add(mk(C(.008,.008,.7,3),M(0xdddddd),-.02,1.0,.0));g.add(boxM(.18,.14,.18,M(0xe9e0c8),-.02,.5,0));
    flag(g,b,.9,.8,-.8);
  },
  ferme(g,b){
    g.add(boxM(2.2,.06,2.7,TM('soil',2,3),-.35,0,0));
    const parts=[];for(let r=0;r<6;r++)for(let i=0;i<8;i++)parts.push([K(.07,.34,4).translate(-1.3+r*.35+((i%2)*.04),.17,-1.15+i*.33),0xffffff]);
    const wm=new THREE.MeshStandardMaterial({vertexColors:true,color:0x7aa83c,flatShading:true,roughness:.9});
    const wheat=mk(merge(parts),wm,0,.06,0);wheat.receiveShadow=false;g.add(wheat);b.wheat=wheat;
    hut(g,b,{x:1.05,z:-.85,w:.75,d:1,h:.7,wall:'planks',roof:'thatch'});
    const f=M(0x7a5a34);for(const z of [-1.4,1.4])g.add(boxM(2.3,.06,.04,f,-.35,.22,z));g.add(boxM(.04,.06,2.8,f,-1.47,.22,0));
    for(const [x,z] of [[-1.47,-1.4],[-1.47,1.4],[.78,-1.4],[.78,1.4],[-1.47,0]])g.add(boxM(.06,.32,.06,f,x,0,z));
    g.add(mk(I(.12),M(0xe0bd4a),1.05,.12,.3));g.add(mk(I(.12),M(0xd6b444),1.25,.12,.42));
    flag(g,b,.95,1.35,.9);
  },
  arcs(g,b){
    hut(g,b,{x:-.2,z:-.25,w:1.3,d:1,wall:'timber',roof:'tile'});
    g.add(mk(C(.26,.26,.08,10).rotateX(Math.PI/2),M(0xd9c07a),.55,.4,.62));
    g.add(mk(C(.12,.12,.09,10).rotateX(Math.PI/2),M(0xc0392b),.55,.4,.665));
    g.add(boxM(.04,.4,.04,M(0x5a3a1e),.45,0,.58));g.add(boxM(.04,.4,.04,M(0x5a3a1e),.65,0,.58));
    g.add(mk(new THREE.TorusGeometry(.2,.015,3,8,Math.PI*.8).rotateZ(Math.PI*.1),M(0x6b4520),-.2,.55,.27));
    g.add(boxM(.6,.08,.3,TM('planks',1,1),.55,.32,-.45));g.add(boxM(.05,.32,.05,M(0x5a3a1e),.3,0,-.45));g.add(boxM(.05,.32,.05,M(0x5a3a1e),.8,0,-.45));
    flag(g,b,.95,-.85,.75);
  },
  lances(g,b){
    hut(g,b,{x:-.25,z:-.2,w:1.2,d:1.05,wall:'stone',roof:'slate'});
    const wd=M(0x6b4a28),st=M(0xc3c9cf);
    g.add(boxM(.05,.5,.05,wd,.35,0,.6));g.add(boxM(.05,.5,.05,wd,.85,0,.6));g.add(boxM(.56,.05,.05,wd,.6,.42,.6));
    for(let i=0;i<4;i++){const x=.42+i*.13;g.add(mk(C(.012,.012,.9,4).rotateX(-.25),M(0x8a6a40),x,.45,.5));g.add(mk(K(.03,.1,4).rotateX(-.25),st,x,.9,.62))}
    g.add(cylM(.18,.2,.25,7,M(0x55402a),.7,0,-.5));g.add(boxM(.3,.08,.18,M(0x3d3d40),.7,.25,-.5));
    flag(g,b,.95,-.85,.75);
  },
  mine(g,b){
    g.add(boxM(1.8,.06,1.8,M(0x4a3f3a)));
    const mound=new THREE.DodecahedronGeometry(.62,0);mound.scale(1.25,.65,1);g.add(mk(mound,M(0x5a4a44),-.15,.22,-.25));
    g.add(mk(I(.12),M(0xc8642c),.25,.5,-.35));g.add(mk(I(.09),M(0xb5582a),-.5,.42,-.1));
    const wd=M(0x6b4a28);
    g.add(boxM(.46,.42,.12,M(0x15110f),-.15,.06,.33));
    g.add(boxM(.07,.5,.1,wd,-.42,.06,.4));g.add(boxM(.07,.5,.1,wd,.12,.06,.4));g.add(boxM(.66,.08,.12,wd,-.15,.54,.4));
    g.add(mk(B(.05,1.15,.05).rotateZ(.22),wd,.5,.55,-.55));g.add(mk(B(.05,1.15,.05).rotateZ(-.22),wd,.95,.55,-.55));
    g.add(mk(new THREE.TorusGeometry(.17,.025,4,10),M(0x4a3522),.72,1.12,-.55));
    g.add(boxM(.38,.18,.26,wd,.55,.08,.5));
    for(const x of [.42,.68])g.add(mk(C(.06,.06,.03,8).rotateX(Math.PI/2),M(0x2e2a26),x,.08,.64));
    for(let i=0;i<4;i++)g.add(mk(I(.07),M(i%2?0x5a4a44:0xc8642c),.47+(i%2)*.15,.3+(i>>1)*.04,.45+(i>>1)*.07));
    flag(g,b,.95,-.8,-.8);
  },
  reserve(g,b){
    g.add(boxM(1.8,.06,1.8,TM('planks',3,3,0xb59a76)));
    const wd=M(0x6b4a28);
    for(const [x,z] of [[-.85,-.85],[.85,-.85],[-.85,.85],[.85,.85]])g.add(boxM(.08,.4,.08,wd,x,0,z));
    for(const sd of [-1,1]){g.add(boxM(1.78,.05,.05,wd,0,.3,sd*.85));g.add(boxM(.05,.05,1.78,wd,sd*.85,.3,0))}
    flag(g,b,1,-.85,-.85);
    b.pile=new THREE.Group();g.add(b.pile);
  },
  grenier(g,b){
    g.add(boxM(1.5,.28,1.3,TM('stone',2,1),-.1,0,-.15));
    for(const [x,z] of [[-.75,-.72],[.55,-.72],[-.75,.42],[.55,.42]])g.add(cylM(.06,.07,.28,6,M(0x6b4a28),x,0,z));
    g.add(boxM(1.4,.62,1.2,TM('timber',2,1),-.1,.28,-.15));
    g.add(mk(gableGeo(1.38,1.6,.7).rotateY(Math.PI/2),TM('tile',2,2),-.1,.9,-.15));
    g.add(boxM(.3,.36,.04,TM('planks',1,1,0x8a7a6a),-.1,.36,.46));
    g.add(mk(B(.04,.6,.04).rotateX(.35),M(0x6b4a28),-.22,.18,.62));g.add(mk(B(.04,.6,.04).rotateX(.35),M(0x6b4a28),.02,.18,.62));
    g.add(boxM(.1,.3,.02,M(TEAMC[b.team].hex),.42,.42,.46));
    flag(g,b,1,.8,-.75);
    b.pile=new THREE.Group();b.pile.position.set(.62,0,.62);g.add(b.pile);
  },
  fleches(g,b){
    hut(g,b,{x:-.25,z:-.3,w:1.15,d:.95,wall:'timber',roof:'thatch'});
    g.add(cylM(.17,.15,.32,8,TM('planks',2,1),.55,0,.45));
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,rr=.08*(i%3?1:.4);g.add(mk(C(.008,.008,.42,3).rotateZ((Math.random()-.5)*.2),M(0xd8c49a),.55+Math.cos(a)*rr,.5,.45+Math.sin(a)*rr));g.add(mk(B(.05,.06,.01),M(TEAMC[b.team].light),.55+Math.cos(a)*rr,.68,.45+Math.sin(a)*rr))}
    g.add(mk(C(.24,.24,.06,12).rotateX(Math.PI/2),M(0xe9dcb8),.6,.42,-.55));g.add(mk(C(.15,.15,.065,12).rotateX(Math.PI/2),M(0xc0392b),.6,.42,-.55));g.add(mk(C(.06,.06,.07,10).rotateX(Math.PI/2),M(0xe9dcb8),.6,.42,-.55));
    g.add(boxM(.04,.42,.04,M(0x5a3a1e),.48,0,-.6));g.add(boxM(.04,.42,.04,M(0x5a3a1e),.72,0,-.6));
    flag(g,b,.95,-.85,.7);
  },
  forge(g,b){
    hut(g,b,{x:-.25,z:-.25,w:1.2,d:1,wall:'stone',roof:'slate'});
    g.add(boxM(.26,.75,.26,TM('stone',1,2),.12,.75,-.5));g.add(boxM(.3,.06,.3,M(0x3d3d40),.12,1.5,-.5));
    const fire=M(0xff7a2a,{emissive:0xff4a10,emissiveIntensity:1.2});
    g.add(boxM(.36,.3,.3,TM('stone',1,1),.6,0,.45));g.add(boxM(.2,.06,.16,fire,.6,.3,.45));
    g.add(cylM(.1,.12,.22,6,M(0x5a3a1e),.6,0,-.05));g.add(boxM(.26,.08,.12,M(0x2e3033),.6,.22,-.05));g.add(boxM(.1,.06,.08,M(0x2e3033),.76,.24,-.05));
    for(let i=0;i<3;i++)g.add(mk(B(.02,.42,.05).rotateZ(.15),M(0xc3c9cf),-.8+i*.1,.3,.42));
    flag(g,b,.95,-.85,.75);
  },
  caserne(g,b){
    g.add(boxM(2.9,.1,1.9,M(0x7d776b)));
    g.add(boxM(2.6,.5,1.4,TM('stone',4,1),0,.1,-.15));
    g.add(boxM(2.6,.5,1.4,TM('timber',3,1),0,.6,-.15));
    g.add(mk(gableGeo(1.6,2.8,.8).rotateY(Math.PI/2),TM('slate',3,2),0,1.1,-.15));
    g.add(boxM(.36,.56,.04,TM('planks',1,1,0x7a6a5a),0,.1,.56));
    for(const x of [-.75,.75]){g.add(boxM(.3,.55,.03,M(TEAMC[b.team].hex),x,.42,.57));g.add(boxM(.3,.05,.035,M(0xe3b54e),x,.95,.57))}
    g.add(boxM(.05,.6,.05,M(0x6b4a28),1.2,0,.75));g.add(boxM(.36,.05,.05,M(0x6b4a28),1.2,.42,.75));g.add(mk(I(.09),M(0xc9a36a),1.2,.68,.75));
    flag(g,b,1.4,-1.25,.65,true);
  },
};
export function buildingObj(b){
  const g=new THREE.Group();b.flags=[];BUILD[b.type](g,b);
  g.position.set(b.x*S,Math.min(gh(b.x,b.y),gh(b.bx,b.by),gh(b.bx+b.bw,b.by),gh(b.bx,b.by+b.bh),gh(b.bx+b.bw,b.by+b.bh)),b.y*S);b.rise=b.type==='keep'?1:0;g.scale.y=b.rise?1:.05;
  dyn.add(g);b.obj=g;
}
// ---- Unités ----
export const SKIN=0xe0b48a,DARK=0x3b2a1c,LEATHER=0x7a5230,STEEL=0xaab1b9,GOLD=0xe3b54e;
export const UGEO:Record<string,any>={};
export function unitGeo(type,team):any{
  const k=type+team;if(UGEO[k])return UGEO[k];
  const c=TEAMC[team],P=[],worker=type==='worker',lord=type==='lord';
  if(type==='spadassin'){
    const ST=0x9aa2ab,DS=0x5d646c;
    P.push([B(.09,.26,.09).translate(0,.13,.07),DS],[B(.09,.26,.09).translate(0,.13,-.07),DS]);
    P.push([C(.14,.18,.34,6).translate(0,.42,0),ST],[B(.06,.3,.2).translate(.13,.42,0),c.hex],[B(.065,.06,.21).translate(.13,.5,0),GOLD]);
    P.push([I(.1).translate(0,.62,.19),ST],[I(.1).translate(0,.62,-.19),ST]);
    P.push([B(.08,.22,.08).translate(.04,.44,.2),DS],[B(.08,.22,.08).translate(.04,.44,-.2),DS]);
    P.push([C(.12,.12,.2,8).translate(0,.75,0),ST],[C(.125,.125,.02,8).translate(0,.86,0),DS],[B(.02,.03,.14).translate(.12,.77,0),0x1a1a1a],[B(.02,.08,.02).translate(.12,.72,0),0x1a1a1a]);
    P.push([B(.14,.03,.03).translate(0,.9,0),c.hex]);
    P.push([B(.7,.05,.018).translate(.5,.5,.22),0xd8dde2],[B(.05,.04,.16).translate(.15,.5,.22),GOLD],[B(.12,.035,.035).translate(.07,.5,.22),0x4a3522]);
    P.push([B(.04,.36,.24).translate(.15,.42,-.24),c.hex],[B(.045,.08,.25).translate(.15,.5,-.24),GOLD],[K(.12,.14,4).rotateZ(Math.PI).translate(.15,.17,-.24),c.hex]);
    const g=merge(P);g.scale(1.12,1.12,1.12);return UGEO[k]=g;
  }
  const tunic=worker?0xb79a6a:c.hex,sleeve=worker?0xa58a5c:c.dark;
  P.push([B(.08,.25,.08).translate(0,.125,.065),DARK],[B(.08,.25,.08).translate(0,.125,-.065),DARK]);
  P.push([C(.12,.17,.32,6).translate(0,.4,0),tunic],[C(.128,.128,.04,6).translate(0,.33,0),lord?GOLD:LEATHER]);
  P.push([B(.07,.22,.07).translate(.02,.42,.17),sleeve],[B(.07,.22,.07).translate(.02,.42,-.17),sleeve]);
  P.push([I(.1).translate(0,.66,0),SKIN]);
  if(type==='archer'||lord){
    const R=lord?.3:.24,a=Math.PI*.8;
    P.push([new THREE.TorusGeometry(R,.018,3,8,a).rotateZ(-a/2).translate(.14-R*Math.cos(a/2),.45,-.2),LEATHER]);
    P.push([B(.01,2*R*Math.sin(a/2),.01).translate(.14,.45,-.2),0xeeeeee]);
    P.push([C(.05,.05,.3,5).rotateZ(.35).translate(-.15,.52,.06),LEATHER]);
  }
  if(type==='archer'){P.push([K(.13,.2,6).translate(0,.8,0),c.dark],[C(.13,.13,.05,6).translate(0,.57,0),c.dark])}
  if(type==='lancier'){
    P.push([C(.11,.13,.1,6).translate(0,.74,0),STEEL],[K(.12,.12,6).translate(0,.85,0),STEEL]);
    P.push([C(.016,.016,1.2,4).rotateZ(-Math.PI/2+.2).translate(.15,.5,.19),0x8a6a40],[K(.04,.15,4).rotateZ(-Math.PI/2+.2).translate(.81,.63,.19),STEEL]);
    P.push([C(.18,.18,.04,8).rotateZ(Math.PI/2).translate(.16,.42,-.2),c.hex],[C(.06,.06,.05,6).rotateZ(Math.PI/2).translate(.19,.42,-.2),STEEL]);
  }
  if(lord){P.push([C(.105,.105,.09,5,true).translate(0,.78,0),GOLD],[B(.04,.44,.32).translate(-.15,.43,0),c.dark],[C(.14,.14,.04,6).translate(0,.57,0),GOLD])}
  if(worker){P.push([C(.22,.22,.03,8).translate(0,.74,0),0xd9b765],[K(.11,.12,6).translate(0,.81,0),0xd9b765],[C(.13,.13,.05,6).translate(0,.56,0),c.hex])}
  const g=merge(P);const s=lord?1.3:worker?.85:1;g.scale(s,s,s);
  return UGEO[k]=g;
}
export const CARRY:Record<string,any>={
  fleche:merge([[C(.01,.01,.5,3).rotateZ(Math.PI/2),0xd8c49a],[C(.01,.01,.5,3).rotateZ(Math.PI/2).translate(0,.03,.02),0xd8c49a],[C(.01,.01,.5,3).rotateZ(Math.PI/2).translate(0,.015,-.02),0xd8c49a],[B(.05,.05,.07).translate(-.26,.015,0),0xeeeeee]]),
  bois:merge([[C(.06,.06,.45,5).rotateX(Math.PI/2),0x8a5a2b],[C(.06,.06,.45,5).rotateX(Math.PI/2).translate(0,.1,.03),0x9a6a35]]),
  pierre:merge([[B(.2,.16,.2),0xe3d9c0]]),
  ble:merge([[I(.13),0xe0bd4a],[K(.05,.1,4).translate(0,.13,0),0xc9a63e]]),
  arc:merge([[new THREE.TorusGeometry(.18,.018,3,8,Math.PI*.8),0x6b4520]]),
  lance:merge([[C(.015,.015,.7,4).rotateZ(Math.PI/2),0x8a6a40],[K(.035,.1,4).rotateZ(-Math.PI/2).translate(.4,0,0),STEEL]]),
  fer:merge([[new THREE.DodecahedronGeometry(.13,0),0x4a403c],[I(.06).translate(.06,.07,.03),0xc8642c]]),
  epee:merge([[B(.6,.04,.015),0xd8dde2],[B(.04,.03,.14).translate(-.3,0,0),GOLD],[B(.1,.03,.03).translate(-.37,0,0),0x4a3522]]),
};
export const RINGGEO=new THREE.RingGeometry(.34,.42,24).rotateX(-Math.PI/2);
export const RINGMAT=new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,opacity:.85,depthWrite:false});
export function unitObj(u){const m=mk(unitGeo(u.kind==='worker'?'worker':u.type,u.team),VC);m.rotation.order='YXZ';m.receiveShadow=false;dyn.add(m);u.obj=m;
  if(u.kind==='worker'){const cm=new THREE.Mesh(CARRY.bois,VC);cm.position.set(0,.98,0);cm.visible=false;cm.castShadow=true;m.add(cm);u.cobj=cm}}
export let AGEO=[0,1].map(t=>merge([[C(.012,.012,.5,4).rotateZ(-Math.PI/2),0xd8c49a],[K(.03,.08,4).rotateZ(-Math.PI/2).translate(.29,0,0),0x9aa1a8],[B(.1,.01,.07).translate(-.21,0,0),TEAMC[t].light],[B(.1,.07,.01).translate(-.21,0,0),TEAMC[t].light]]));
// applique la couleur choisie à tout le royaume (unités, bâtiments, flèches, territoire)
export function applyColors(){
  const k=window.__kingdom||{me:'#3f6fd8',foe:'#c9402e'};
  TEAMC[0]=teamColor(k.me);TEAMC[1]=teamColor(k.foe);
  for(const key in UGEO)delete UGEO[key];
  AGEO=[0,1].map(t=>merge([[C(.012,.012,.5,4).rotateZ(-Math.PI/2),0xd8c49a],[K(.03,.08,4).rotateZ(-Math.PI/2).translate(.29,0,0),0x9aa1a8],[B(.1,.01,.07).translate(-.21,0,0),TEAMC[t].light],[B(.1,.07,.01).translate(-.21,0,0),TEAMC[t].light]]));
  for(const id of [0,1])if(terrRing[id])terrRing[id].material.color.setHex(TEAMC[id].light);
}
export function arrowObj(a){const m=mk(AGEO[a.team],VC);m.rotation.order='YXZ';m.receiveShadow=false;if(a.lord)m.scale.setScalar(1.35);dyn.add(m);a.obj=m;a.peak=.2+a.md*S*.05}
export const STUMPGEO=merge([[C(.09,.11,.12,6).translate(0,.06,0),0x6b4526],[C(.085,.085,.01,6).translate(0,.125,0),0xc9a06a]]);
