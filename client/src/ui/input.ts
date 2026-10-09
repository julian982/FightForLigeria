// Clavier et souris : ZQSD + arc pour le seigneur, placement des bâtiments, sélection et ordres.
import { BUILD_LIST, G, S, cancelCharge, orderAttack, orderMove, placeBuilding, releaseCharge, startCharge, steer } from '@ffl/shared';
import { cv } from '../render/engine';
import { enterFps, exitFps, fpsLook } from '../render/fps';
import { addMark, ghostTile, screenToWorld, toScreen } from '../render/sync';
import { $, ME, keys, mouse, sel, tilt, ui, view } from '../state';
import { askRecruit, refreshHud, selectBuild, toast } from './hud';
export function setMouse(e){mouse.sx=e.clientX;mouse.sy=e.clientY;mouse.in=true;const w=screenToWorld(mouse.sx,mouse.sy);mouse.wx=w.x;mouse.wy=w.y}
cv.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(ui.fps){fpsLook(e.movementX||0,e.movementY||0);return}if(view.rotDrag){view.yawTarget+=(e.clientX-view.rotDrag.x)*.008;tilt((e.clientY-view.rotDrag.y)*.006);view.rotDrag.x=e.clientX;view.rotDrag.y=e.clientY}setMouse(e)});
addEventListener('mouseup',e=>{if(e.button===1)view.rotDrag=null});
cv.addEventListener('wheel',e=>{e.preventDefault();if(ui.fps)return;
  // Maj + molette : incliner la caméra ; molette seule : zoomer
  if(e.shiftKey){tilt((e.deltaY||e.deltaX)>0?-.08:.08);return}
  view.ppu=Math.max(40,Math.min(72,view.ppu*(e.deltaY>0?.9:1.1)))},{passive:false});
cv.addEventListener('mousedown',e=>{
  if(ui.fps){if(e.button===0&&ui.running){const c:any=cv;if(!document.pointerLockElement)try{c.requestPointerLock()}catch(er){}const err=startCharge(ME);if(err)toast(err,'warn')}return}
  setMouse(e);if(!ui.running)return;
  if(e.button===1){e.preventDefault();view.rotDrag={x:e.clientX,y:e.clientY};return}
  if(e.button===0){
    if(ui.placing){tryPlace(e.shiftKey);return}
    // clic simple : un soldat ; glisser : encadrer plusieurs soldats
    ui.box={sx:mouse.sx,sy:mouse.sy};
  }else if(e.button===2){
    if(ui.placing){ui.placing=null;refreshHud();return}
    orderSelected();
  }
});
addEventListener('mouseup',e=>{if(e.button!==0)return;if(ui.fps){releaseShot();return}if(ui.box){selectBox(e.shiftKey||e.ctrlKey||e.metaKey);ui.box=null}});
export function tryPlace(keep){
  const g=ghostTile(),err=placeBuilding(ME,ui.placing,g.tx,g.ty);
  if(err){toast(err);return}
  if(!keep)ui.placing=null;refreshHud();
}
export function pickNear(list,maxPx){let best=null,bd=maxPx;for(const e of list){const p=toScreen(e.x,e.y,.4),d=Math.hypot(p.x-mouse.sx,p.y-mouse.sy);if(d<bd){bd=d;best=e}}return best}
export function selectBox(add){
  const x0=Math.min(ui.box.sx,mouse.sx),x1=Math.max(ui.box.sx,mouse.sx),y0=Math.min(ui.box.sy,mouse.sy),y1=Math.max(ui.box.sy,mouse.sy);
  const mine=G.units.filter(u=>u.team===0&&u.type!=='lord'&&!u.dead);
  let pick;
  ui.selB=null;
  if(x1-x0<6&&y1-y0<6){const u=pickNear(mine,22*view.ppu/46);pick=u?[u]:[];
    // clic sur un bâtiment (sans soldat dessous) : fenêtre d'info
    if(!u){const b=G.buildings.find(b=>!b.dead&&mouse.wx>b.bx&&mouse.wx<b.bx+b.bw&&mouse.wy>b.by&&mouse.wy<b.by+b.bh);if(b){sel.clear();ui.selB=b;return}}}
  else pick=mine.filter(u=>{const p=toScreen(u.x,u.y,.4);return p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1});
  if(!add||!pick.length)sel.clear();
  for(const u of pick)sel.add(u);
}
/** l'ennemi (soldat, ouvrier, seigneur ou bâtiment) sous le curseur */
export function targetUnderMouse(){
  let tgt=pickNear([...G.units,...G.workers].filter(e=>e.team!==ME&&!e.dead),34*view.ppu/46);
  if(!tgt)for(const b of G.buildings){if(b.team!==ME&&!b.dead&&b.type!=='keep'&&mouse.wx>b.bx&&mouse.wx<b.bx+b.bw&&mouse.wy>b.by&&mouse.wy<b.by+b.bh){tgt=b;break}}
  return tgt;
}
// curseur « épées croisées » quand des soldats sont sélectionnés et qu'on survole un ennemi
export const SWORDS='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="#1a0d08" stroke-width="5" stroke-linecap="round"><path d="M5 5 L23 23"/><path d="M27 5 L9 23"/><path d="M19 27 L27 19"/><path d="M5 19 L13 27"/></g><g stroke-linecap="round"><path d="M5 5 L23 23" stroke="#f2ede4" stroke-width="2.5"/><path d="M27 5 L9 23" stroke="#f2ede4" stroke-width="2.5"/><path d="M19 27 L27 19" stroke="#e3634f" stroke-width="3"/><path d="M5 19 L13 27" stroke="#e3634f" stroke-width="3"/></g></svg>')+'") 16 16, crosshair';
export let curMode='';
export function updateCursor(){
  const attack=ui.running&&!ui.fps&&!ui.placing&&!ui.box&&sel.size>0&&mouse.in&&!!targetUnderMouse();
  const m=attack?'attack':'';if(m===curMode)return;curMode=m;cv.style.cursor=attack?SWORDS:'';
}
export function orderSelected(){
  const units=[...sel];if(!units.length)return;
  const tgt=targetUnderMouse();
  if(tgt){orderAttack(ME,units,tgt);addMark(tgt.x,tgt.y);return}
  orderMove(ME,units,mouse.wx,mouse.wy);
  addMark(mouse.wx,mouse.wy);
}
addEventListener('keydown',(e:any)=>{
  if(e.target.closest&&e.target.closest('button')&&(e.code==='Enter'||e.code==='Space')){
    // en partie, Espace sert à l'arc : on retire le focus du bouton au lieu de le cliquer
    if(ui.running&&e.code==='Space'){e.preventDefault();e.target.blur()}else return;
  }
  keys[e.code]=true;
  if(e.code.startsWith('Arrow')||e.code==='PageUp'||e.code==='PageDown')e.preventDefault();
  if(!ui.running)return;
  if(e.code==='Space'||e.code.startsWith('Digit'))e.preventDefault();
  // Espace maintenue : bander l'arc ; relâchée : tirer
  if(e.code==='Space'){if(!e.repeat){const err=startCharge(ME);if(err)toast(err,'warn')}return}
  // V : vue seigneur, rien d'autre que le tir à l'arc tant qu'on y est
  if(e.code==='KeyV'){if(ui.fps)exitFps();else enterFps();return}
  if(ui.fps){if(e.code==='Escape')exitFps();return}
  const m=/^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  if(m){selectBuild(BUILD_LIST[m[1]==='0'?9:+m[1]-1]);return}
  if(e.code==='Minus'){selectBuild(BUILD_LIST[10]);return}
  if(e.code==='Escape'){ui.placing=null;ui.selB=null;sel.clear();refreshHud()}
  if(e.code==='KeyF'){sel.clear();for(const u of G.units)if(u.team===0&&u.type!=='lord'&&!u.dead)sel.add(u)}
  if(e.code==='KeyR')askRecruit('archer');
  if(e.code==='KeyT')askRecruit('lancier');
  if(e.code==='KeyY')askRecruit('spadassin');
});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Space')releaseShot()});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;releaseShot()});

/** relâche l'arc (si la partie est en pause, on annule simplement la charge) */
export function releaseShot(){if(!G)return;if(!ui.running){cancelCharge(ME);return}releaseCharge(ME)}
/** direction ZQSD (écran) convertie en direction monde selon l'orientation de la caméra */
export function steerLord(){
  if(!G)return;
  if(ui.fps){
    // vue seigneur : Z/S avancent et reculent dans la direction du regard, Q/D se décalent de côté
    const L=G.teams[ME].lord,fx=Math.cos(view.fpsYaw),fy=Math.sin(view.fpsYaw);
    const f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
    steer(ME,fx*f-fy*r,fy*f+fx*r,{x:L.x+fx*200,y:L.y+fy*200});return}
  const dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0);
  const dy=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
  const cy=Math.cos(view.camYaw),sy=Math.sin(view.camYaw);
  steer(ME,dx*sy+dy*cy,dy*sy-dx*cy,mouse.in?{x:mouse.wx,y:mouse.wy}:null);
}
