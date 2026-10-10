// Synchronise la scène 3D avec l'état de la simulation, image par image.
// Les maillages sont créés à la demande : la simulation ne connaît pas Three.js.
import * as THREE from 'three';
import { DEF, G, S, T, afford, canPlace, gh, isFoe, stockPt, trees } from '@ffl/shared';
import { B, C, CAM_D, I, ISO, M, SUN_OFF, VC, VCF, boxM, camT, camera, dyn, mk, scene, sun } from './engine';
import { birdsTakeOff, life } from './life';
import { AGEO, CARRY, RINGGEO, RINGMAT, STUMPGEO, arrowObj, buildingObj, treeObj, unitObj } from './models';
import { groundMesh, terrRing } from './world';
import { $, ME, keys, mouse, sel, tilt, ui, view } from '../state';
export const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),V2=new THREE.Vector2(),V3=new THREE.Vector3(),HIT=new THREE.Vector3();
export function screenToWorld(sx,sy){V2.set(sx/view.VW*2-1,-(sy/view.VH)*2+1);ray.setFromCamera(V2,camera);if(groundMesh){const h=ray.intersectObject(groundMesh,false)[0];if(h)return{x:h.point.x*T,y:h.point.z*T}}return ray.ray.intersectPlane(plane,HIT)?{x:HIT.x*T,y:HIT.z*T}:{x:0,y:0}}
export function toScreen(x,y,h){V3.set(x*S,h+gh(x,y),y*S).project(camera);return{x:(V3.x+1)/2*view.VW,y:(1-V3.y)/2*view.VH}}
export function updateCam(dt){
  // éliminé en 2v2 : la caméra suit le seigneur allié encore debout
  let L=G.teams[ME].lord;if(L.dead){const ally=G.teams.find(t=>t.id!==ME&&!isFoe(t.id,ME)&&t.lord&&!t.lord.dead);if(ally)L=ally.lord}
  const k=1-Math.pow(.0015,dt);
  camT.x+=(L.x*S-camT.x)*k;camT.z+=(L.y*S-camT.z)*k;
  const topPad=$('hudTop').offsetHeight,botPad=$('hudBot').offsetHeight,sh=(topPad-botPad)/2/view.ppu;
  const hw=view.VW/2/view.ppu,hh=view.VH/2/view.ppu;
  camera.left=-hw;camera.right=hw;camera.top=hh+sh;camera.bottom=-hh+sh;camera.updateProjectionMatrix();
  if(ui.running){if(keys.KeyQ)view.yawTarget-=dt*1.7;if(keys.KeyE)view.yawTarget+=dt*1.7;if(keys.PageUp)tilt(dt*1.2);if(keys.PageDown)tilt(-dt*1.2)}
  const ease=1-Math.pow(.0005,dt);
  view.camYaw+=(view.yawTarget-view.camYaw)*ease;view.pitch+=(view.pitchTarget-view.pitch)*ease;
  const hr=CAM_D*Math.cos(view.pitch);ISO.set(Math.cos(view.camYaw)*hr,CAM_D*Math.sin(view.pitch),Math.sin(view.camYaw)*hr);
  camera.position.copy(camT).add(ISO);camera.lookAt(camT);camera.updateMatrixWorld();
  sun.position.copy(camT).add(SUN_OFF);sun.target.position.copy(camT);sun.target.updateMatrixWorld();
  const w=screenToWorld(mouse.sx,mouse.sy);mouse.wx=w.x;mouse.wy=w.y;
}
export const aimLine:any=new THREE.Mesh(new THREE.BoxGeometry(1,.02,.06),new THREE.MeshBasicMaterial({color:0xffe9b0,transparent:true,opacity:.6,depthWrite:false}));
export const aimEnd=new THREE.Mesh(new THREE.RingGeometry(.18,.26,20).rotateX(-Math.PI/2),aimLine.material);
export const ghost:any=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x79c06a,transparent:true,opacity:.35,depthWrite:false}));
export const ghostRange:any=new THREE.Mesh(new THREE.RingGeometry(280*S-.05,280*S,96).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.35,depthWrite:false}));
for(const m of [aimLine,aimEnd,ghost,ghostRange]){m.visible=false;scene.add(m)}
aimLine.material.depthTest=false;ghostRange.material.depthTest=false;aimLine.renderOrder=aimEnd.renderOrder=ghostRange.renderOrder=5;
export function ghostTile(){const d=DEF[ui.placing];return{tx:Math.round(mouse.wx/T-d.w/2),ty:Math.round(mouse.wy/T-d.h/2)}}
export function syncScene(dt){
  const t=G.t;
  ensureObjs();
  for(const u of [...G.units,...G.workers]){
    const m=u.obj;if(!m)continue;
    const sp=Math.hypot(u.vx||0,u.vy||0);u.ph=(u.ph||0)+dt*Math.min(sp,140)*.11;
    if(u.dead){u.dT=(u.dT||0)+dt;m.position.set(u.x*S,gh(u.x,u.y)+.05,u.y*S);m.rotation.set(0,-u.face,-Math.min(1,u.dT*2.5)*Math.PI/2);if(u.ring)u.ring.visible=false;continue}
    let bob=sp>5?Math.abs(Math.sin(u.ph))*.06:0,sway=sp>5?Math.sin(u.ph*2)*.07:0,pitch=0;
    if(u.working){bob=Math.abs(Math.sin((u.anim||0)*7))*.04;pitch=Math.sin((u.anim||0)*7)*.25}
    const l=u.lunge?u.lunge/.15*.14:0;
    m.position.set(u.x*S+Math.cos(u.face)*l,gh(u.x,u.y)+bob,u.y*S+Math.sin(u.face)*l);
    m.rotation.set(sway,-u.face,-pitch);
    m.material=u.flash>0?VCF:VC;
    if(u.cobj){u.cobj.visible=!!u.carry;if(u.carry)u.cobj.geometry=CARRY[u.carry.type]}
    const isSel=sel.has(u);
    if(isSel&&!u.ring){u.ring=new THREE.Mesh(RINGGEO,RINGMAT);dyn.add(u.ring)}
    if(u.ring){u.ring.visible=isSel;u.ring.position.set(u.x*S,gh(u.x,u.y)+.06,u.y*S)}
  }
  for(const a of G.arrows){if(!a.obj)continue;const p=Math.min(1,a.d/a.md),h=.55+a.peak*4*p*(1-p)-.45*p,dh=(a.peak*4*(1-2*p)-.45)/(a.md*S);
    a.obj.position.set(a.x*S,h+gh(a.x,a.y),a.y*S);a.obj.rotation.set(0,-Math.atan2(a.vy,a.vx),Math.atan(dh))}
  for(const f of G.fx){const p=f.t/f.life;if(!f.obj&&f.k!=='num')fxObj(f);if(!f.obj)continue;
    if(f.k==='puff'){f.obj.scale.setScalar(f.r*(.5+p));f.obj.position.y=f.h+p*.4;f.obj.material.opacity=.7*(1-p)}
    else if(f.k==='stuck'&&!f.set){f.set=1;const h=(f.h===undefined?.08:f.h)+gh(f.x,f.y);f.obj.position.set(f.x*S,h,f.y*S);f.obj.rotation.set(0,-f.a,f.h===undefined?-.5:-.1)}}
  for(const b of G.buildings){
    const g=b.obj;if(!g)continue;
    if(b.rise<1){b.rise=Math.min(1,b.rise+dt*1.8);const e=1-Math.pow(1-b.rise,3);g.scale.y=.05+.95*e}
    g.position.x=b.x*S+(b.flash>0?(Math.random()-.5)*.06:0);
    for(let i=0;i<b.flags.length;i++)b.flags[i].rotation.y=Math.sin(t*2.6+b.id+i)*.35;
    if(b.wheat){b.wheat.scale.y=.35+.65*b.grow;b.wheat.material.color.setRGB(.48+.4*b.grow,.66+.06*b.grow,.24-.02*b.grow)}
  }
  updMarks(dt);
  for(const tm of G.teams){
    if(!tm.pile){tm.pile=new THREE.Group();const sp=stockPt(tm.id);tm.pile.position.set(sp.x*S,gh(sp.x,sp.y),sp.y*S+.25);dyn.add(tm.pile);tm.pileKey=''}
    const r=tm.res,res=G.buildings.find(o=>o.team===tm.id&&o.type==='reserve'&&!o.dead),gre=G.buildings.find(o=>o.team===tm.id&&o.type==='grenier'&&!o.dead);
    const n=[Math.min(12,Math.ceil(r.bois/6)),Math.min(9,Math.ceil(r.pierre/4)),Math.min(8,Math.ceil(r.ble/8)),Math.min(4,r.arc),Math.min(4,r.lance),Math.min(9,r.fer),Math.min(3,r.epee),Math.min(5,Math.ceil(r.fleche/4))];
    // réserve : bois, pierre, fer
    if(res){const key=n[0]+','+n[1]+','+n[5];if(res.pileKey!==key){res.pileKey=key;const g=res.pile;while(g.children.length)g.remove(g.children[0]);
      let i=0;for(let row=0;row<3;row++)for(let j=0;j<4-row&&i<n[0];j++,i++)g.add(mk(C(.07,.07,.6,6).rotateX(Math.PI/2),M(0x8a5a2b),-.55+j*.15+row*.075,.1+row*.13,-.45));
      for(let k=0;k<n[1];k++)g.add(boxM(.2,.15,.2,M(k%2?0xe9e0c8:0xd9ceb3),.2+(k%3)*.22,.06+(k/3|0)*.15,-.45));
      for(let k=0;k<n[5];k++)g.add(boxM(.17,.08,.1,M(k%2?0x4f5358:0x5d4a40),-.5+(k%3)*.2,.06+(k/3|0)*.08,.4))}}
    // grenier : sacs de blé
    if(gre){const key=''+n[2];if(gre.pileKey!==key){gre.pileKey=key;const g=gre.pile;while(g.children.length)g.remove(g.children[0]);
      for(let k=0;k<n[2];k++){const sk=new THREE.DodecahedronGeometry(.11,0);sk.scale(1,1.2,1);g.add(mk(sk,M(k%2?0xd9b452:0xc9a446),(k%3)*.2-.2,.13+(k/3|0)*.2,(k%2)*.08))}}}
    // donjon : armes et flèches
    const key=n.slice(3,5).join()+','+n[6]+','+n[7];
    if(key!==tm.pileKey){tm.pileKey=key;const g=tm.pile;while(g.children.length)g.remove(g.children[0]);
      for(let k=0;k<n[3];k++)g.add(mk(new THREE.TorusGeometry(.14,.015,3,8,Math.PI*.8).rotateX(-Math.PI/2),M(0x6b4520),-.5+k*.1,.03+k*.02,.35));
      for(let k=0;k<n[4];k++)g.add(mk(C(.012,.012,.6,4).rotateZ(Math.PI/2),M(0x8a6a40),.2,.03+k*.03,.32+k*.04));
      for(let k=0;k<n[6];k++)g.add(mk(B(.5,.03,.04),M(0xd8dde2),.8,.04+k*.04,.35+k*.05));
      for(let k=0;k<n[7];k++)g.add(mk(C(.05,.05,.4,6).rotateZ(Math.PI/2),M(0xc9b48a),-1.0,.05+k*.06,.2+(k%2)*.06));
    }
  }
  const L=G.teams[ME].lord;
  const showAim=ui.running&&!L.dead&&G.ctrl[ME].charging;aimLine.visible=aimEnd.visible=showAim;
  if(showAim){const md=(200+520*L.charge)*S,c=Math.cos(L.face),s=Math.sin(L.face);aimLine.scale.x=Math.max(.1,md-.4);aimLine.position.set(L.x*S+c*(md/2+.2),gh(L.x,L.y)+.12,L.y*S+s*(md/2+.2));aimLine.rotation.y=-L.face;aimEnd.position.set(L.x*S+c*md,gh(L.x+c*md*T,L.y+s*md*T)+.1,L.y*S+s*md);aimLine.material.opacity=.3+L.charge*.5}
  ghost.visible=ghostRange.visible=false;
  if(terrRing[ME])terrRing[ME].material.opacity=ui.placing&&ui.running?.6:.22;
  if(ui.placing&&ui.running){
    const d=DEF[ui.placing],g=ghostTile(),ok=!canPlace(ME,ui.placing,g.tx,g.ty)&&afford(G.teams[ME],ui.placing);
    ghost.visible=true;ghost.scale.set(d.w,.9,d.h);ghost.position.set(g.tx+d.w/2,gh((g.tx+d.w/2)*T,(g.ty+d.h/2)*T)+.45,g.ty+d.h/2);ghost.material.color.setHex(ok?0x79c06a:0xe3634f);
    if(ui.placing==='bucheron'){ghostRange.visible=true;ghostRange.position.set(g.tx+1,gh((g.tx+1)*T,(g.ty+1)*T)+.15,g.ty+1)}
  }
}

/** crée les maillages des entités apparues depuis la dernière image */
export function ensureObjs(){
  for(const t of trees)if(!t.obj)treeObj(t);
  for(const b of G.buildings)if(!b.obj)buildingObj(b);
  for(const u of G.units)if(!u.obj)unitObj(u);
  for(const w of G.workers)if(!w.obj)unitObj(w);
  for(const a of G.arrows)if(!a.obj&&!a.dead)arrowObj(a);
}
export function fxObj(f){
  if(f.k==='puff'){
    const m=new THREE.Mesh(I(.2),new THREE.MeshStandardMaterial({color:0xd8cfbf,flatShading:true,transparent:true,opacity:.7,roughness:1,depthWrite:false}));
    m.position.set(f.x*S,f.h,f.y*S);dyn.add(m);f.obj=m;
  }else if(f.k==='stump'){f.obj=mk(STUMPGEO,VC,f.x*S,gh(f.x,f.y),f.y*S);dyn.add(f.obj)}
  else if(f.k==='stuck'){const m=mk(AGEO[f.team],VC);m.rotation.order='YXZ';m.receiveShadow=false;if(f.lord)m.scale.setScalar(1.35);dyn.add(m);f.obj=m}
}
/** une entité quitte la partie : on retire son maillage */
export function onRemoved(e){
  // un arbre abattu : quelques oiseaux s'en envolent
  if(e.wood!==undefined&&!e.kind&&e.obj&&Math.random()<.6)birdsTakeOff(e.x,e.y);
  if(e.obj){dyn.remove(e.obj);if(e.k==='puff')e.obj.material.dispose();e.obj=null}
  if(e.ring){dyn.remove(e.ring);e.ring=null}
}
/** nouvelle partie : la scène dynamique repart de zéro */
export function onReset(){while(dyn.children.length)dyn.remove(dyn.children[0]);marks.length=0}
// repères d'ordre (anneau qui s'élargit là où on a cliqué) : purement locaux
export const marks=[];
export function addMark(x,y){const m=new THREE.Mesh(RINGGEO,new THREE.MeshBasicMaterial({color:0xffe9a8,transparent:true,depthWrite:false}));m.position.set(x*S,gh(x,y)+.07,y*S);dyn.add(m);marks.push({t:0,life:.5,obj:m})}
export function updMarks(dt){
  for(const f of marks){f.t+=dt;const p=Math.min(1,f.t/f.life);f.obj.scale.setScalar(1+p*1.5);f.obj.material.opacity=1-p;if(f.t>=f.life){dyn.remove(f.obj);f.obj.material.dispose()}}
  for(let i=marks.length-1;i>=0;i--)if(marks[i].t>=marks[i].life)marks.splice(i,1);
}
