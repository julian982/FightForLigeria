// Les modèles low poly : arbres, bâtiments, unités, flèches, objets portés.
// ---- Arbres ----
import * as THREE from 'three';
import { G, S, gh, identityOf, isFoe } from '@ffl/shared';
import { B, C, I, K, M, TEAMC, TM, VC, boxM, cylM, companion, dyn, gableGeo, merge, mk, teamColor, tr } from './engine';
import { terrRing } from './world';
import { personGeo, workerGeo, workerKey, rigGeo, clearRigCache, RIG_TYPES, SHOULDER, ARM_LEN } from './people';
import { buildKeep, buildHut, buildQuarry, buildBarracks, buildReserve, buildGranary, buildFarm, buildArmory, buildBowyer, buildSpearmaker, buildFletcher, buildMine, buildForge } from './stylized';
import { ME } from '../state';
/** peuplier : une colonne de feuillage faite de boules déformées, sur un tronc fin */
function poplar(){
  const P=[],jit=(g,a)=>{const p=g.attributes.position,seen=new Map();for(let i=0;i<p.count;i++){const k=Math.round(p.getX(i)*500)+','+Math.round(p.getY(i)*500)+','+Math.round(p.getZ(i)*500);let o=seen.get(k);if(!o){o=[(tr()-.5)*a,(tr()-.5)*a,(tr()-.5)*a];seen.set(k,o)}p.setXYZ(i,p.getX(i)+o[0],p.getY(i)+o[1],p.getZ(i)+o[2])}p.needsUpdate=true;g.computeVertexNormals();return g};
  P.push([C(.035,.06,.7,5).translate(0,.35,0),0xb8ab92],[C(.015,.025,.26,4).rotateZ(.7).translate(.07,.55,0),0xb8ab92]);
  // colonne étroite et haute, vert tendre et lumineux (bien différente des chênes et des sapins)
  [[.2,.62,0x8db34c],[.23,.86,0x9ec25a],[.24,1.1,0xb0d36a],[.23,1.34,0x9ec25a],[.21,1.58,0xb0d36a],[.18,1.8,0x9ec25a],[.14,2.0,0xbada74],[.09,2.17,0xb0d36a]].forEach(([r,y,c],i)=>{const g=jit(new THREE.IcosahedronGeometry(r,0),r*.3);g.scale(1,1.3,1);g.translate((i%2?.025:-.025),y,(i%3?.02:-.02));P.push([g,c])});
  return merge(P);
}
export const TREEGEO=[
  merge([[C(.06,.09,.45,5).translate(0,.22,0),0x6b4526],[K(.46,.72,6).translate(0,.75,0),0x2f5e2c],[K(.36,.6,6).translate(0,1.08,0),0x3a6e33],[K(.22,.45,6).translate(0,1.38,0),0x467d3a]]),
  merge([[C(.07,.1,.55,5).translate(0,.27,0),0x6b4526],[I(.46).translate(0,.9,0),0x4a8238],[I(.3).translate(.2,1.15,.1),0x5c9644],[I(.26).translate(-.22,.75,-.12),0x3f7231]]),
  merge([[C(.05,.07,.6,5).translate(0,.3,0),0xd8d2c4],[I(.34).translate(0,.95,0),0x7aa846],[I(.25).translate(.12,1.2,-.05),0x8bb852]]),
  // peuplier de Loire : tronc clair et élancé, feuillage en colonne de boules irrégulières, vert tendre
  poplar(),
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
  keep:buildKeep,
  bucheron:buildHut,
  carriere:buildQuarry,
  ferme:buildFarm,
  arcs:buildBowyer,
  lances:buildSpearmaker,
  mine:buildMine,
  reserve:buildReserve,
  armurerie:buildArmory,
  grenier:buildGranary,
  fleches:buildFletcher,
  forge:buildForge,
  caserne:buildBarracks,
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
  return UGEO[k]=personGeo(type,team);
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
/** chaque ouvrier a son apparence (la même que sur sa fiche) ; les géométries identiques sont partagées */
export function workerGeoOf(u){const idn=identityOf(u.id,(G&&G.seed)||0),k='w'+u.team+workerKey(idn.female,idn.face,u.id);return UGEO[k]||(UGEO[k]=workerGeo(idn.female,idn.face,u.id,u.team))}
/** archer et seigneur : corps + pièces articulées (bras d'arc, arc, corde en deux brins, bras qui tire, flèche encochée) */
function rigObj(u){
  const R=rigGeo(u.type,u.team),m=mk(R.base,VC),rig=new THREE.Group();rig.scale.setScalar(R.scale);m.add(rig);
  const meshes=[m],part=(geo,parent)=>{const p=mk(geo,VC);p.receiveShadow=false;parent.add(p);meshes.push(p);return p};
  const armL=new THREE.Group();armL.position.set(0,SHOULDER.y,-SHOULDER.z);rig.add(armL);part(R.armBow,armL);
  const hand=new THREE.Group();hand.position.set(0,-ARM_LEN,0);armL.add(hand);part(R.bow,hand);
  const sTop=part(R.string,hand),sBot=part(R.string,hand),arrow=part(R.arrow,hand);arrow.visible=false;
  const armR=new THREE.Group();armR.position.set(0,SHOULDER.y,SHOULDER.z);rig.add(armR);part(R.armDraw,armR);
  u.rig={armL,hand,armR,sTop,sBot,arrow,aim:0,draw:0,meshes};
  return m;
}
export function unitObj(u){const m=u.kind!=='worker'&&RIG_TYPES.has(u.type)?rigObj(u):mk(u.kind==='worker'?workerGeoOf(u):unitGeo(u.type,u.team),VC);m.rotation.order='YXZ';m.receiveShadow=false;dyn.add(m);u.obj=m;
  if(u.kind==='worker'){const cm=new THREE.Mesh(CARRY.bois,VC);cm.position.set(0,.98,0);cm.visible=false;cm.castShadow=true;m.add(cm);u.cobj=cm}}
export let AGEO=[0,1,2,3].map(t=>merge([[C(.012,.012,.5,4).rotateZ(-Math.PI/2),0xd8c49a],[K(.03,.08,4).rotateZ(-Math.PI/2).translate(.29,0,0),0x9aa1a8],[B(.1,.01,.07).translate(-.21,0,0),TEAMC[t].light],[B(.1,.07,.01).translate(-.21,0,0),TEAMC[t].light]]));
// applique la couleur choisie à tout le royaume (unités, bâtiments, flèches, territoire)
export function applyColors(){
  const k=window.__kingdom||{me:'#3f6fd8',foe:'#c9402e'};
  // toi : ta couleur ; ton allié : une teinte voisine ; les ennemis : la couleur adverse et sa voisine
  const foes=[0,1,2,3].filter(p=>isFoe(p,ME));
  for(let p=0;p<4;p++)TEAMC[p]=teamColor(p===ME?k.me:!isFoe(p,ME)?companion(k.me):foes.indexOf(p)===0?k.foe:companion(k.foe));
  for(const key in UGEO)delete UGEO[key];clearRigCache();
  AGEO=[0,1,2,3].map(t=>merge([[C(.012,.012,.5,4).rotateZ(-Math.PI/2),0xd8c49a],[K(.03,.08,4).rotateZ(-Math.PI/2).translate(.29,0,0),0x9aa1a8],[B(.1,.01,.07).translate(-.21,0,0),TEAMC[t].light],[B(.1,.07,.01).translate(-.21,0,0),TEAMC[t].light]]));
  terrRing.forEach((r,id)=>{if(r)r.material.color.setHex(TEAMC[id].light)});
}
export function arrowObj(a){const m=mk(AGEO[a.team],VC);m.rotation.order='YXZ';m.receiveShadow=false;if(a.lord)m.scale.setScalar(1.35);dyn.add(m);a.obj=m;a.peak=.2+a.md*S*.05}
export const STUMPGEO=merge([[C(.09,.11,.12,6).translate(0,.06,0),0x6b4526],[C(.085,.085,.01,6).translate(0,.125,0),0xc9a06a]]);
