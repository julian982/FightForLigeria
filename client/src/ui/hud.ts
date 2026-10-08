// Le bandeau du haut (ressources, vie du seigneur) et celui du bas (bâtiments, recrutement).
import { BUILD_LIST, DEF, G, RESN, afford, armySize, cancelCharge, missing, recruit } from '@ffl/shared';
import { $, ME, ui } from '../state';

export const SHORT={ferme:'Ferme',fleches:'Flèches',arcs:'Arcs',lances:'Lances',mine:'Mine de fer'};
export const RESCOL={bois:'#9a6a35',pierre:'#e3d9c0',fer:'#b8622e',ble:'#e0bd4a'};
export function costHtml(c){const e=Object.entries(c);return e.length?e.map(([k,v])=>`<span class="ci"><i style="background:${RESCOL[k]}"></i>${v}</span>`).join(''):'Gratuit'}
export function costStr(c){const e=Object.entries(c);return e.length?e.map(([k,v])=>v+' '+RESN[k]).join(' · '):'Gratuit'}
export const toastBox=$('toast');
export function toast(msg,kind=''){const d=document.createElement('div');d.textContent=msg;if(kind)d.className=kind;toastBox.appendChild(d);while(toastBox.children.length>3)toastBox.firstChild.remove();setTimeout(()=>d.remove(),2700)}
export const bb=$('buildBtns');
for(const t of BUILD_LIST){const d=DEF[t],b=document.createElement('button');b.className='btn';b.type='button';b.dataset.b=t;
  b.title=d.name+" : "+costStr(d.cost);b.innerHTML=`<kbd>${d.key}</kbd><span class="n">${SHORT[t]||d.name}</span><span class="c">${costHtml(d.cost)}</span>`;
  b.addEventListener('click',()=>selectBuild(t));bb.appendChild(b)}
export function selectBuild(t){if(!ui.running)return;ui.placing=ui.placing===t?null:t;cancelCharge(ME);refreshHud()}
export function askRecruit(type){
  if(!ui.running)return;
  const err=recruit(ME,type);if(err){toast(err);return}
  refreshHud();
}
$('bArcher').addEventListener('click',()=>askRecruit('archer'));
$('bLancier').addEventListener('click',()=>askRecruit('lancier'));
$('bSpad').addEventListener('click',()=>askRecruit('spadassin'));
export function setChip(id,v,low=false){const el=$(id);el.querySelector('b').textContent=v;el.classList.toggle('low',!!low)}
export function refreshHud(){
  const tm=G.teams[ME],r=tm.res;
  setChip('cBois',r.bois);setChip('cPierre',r.pierre);setChip('cBle',r.ble,r.ble<=0);setChip('cFer',r.fer);setChip('cArc',r.arc);setChip('cLance',r.lance);setChip('cEpee',r.epee);setChip('cFleche',r.fleche,r.fleche<=2);
  setChip('cArmy',armySize(ME));
  for(const b of bb.children){const t=b.dataset.b,missing=DEF[t].store&&!G.buildings.some(o=>o.team===ME&&o.type===t&&!o.dead);b.classList.toggle('poor',!afford(tm,t)||!!(DEF[t].store&&!missing));b.classList.toggle('active',ui.placing===t);b.classList.toggle('need',!!missing)}
  const cas=G.buildings.some(b=>b.team===ME&&b.type==='caserne');
  $('bArcher').classList.toggle('poor',!cas||r.arc<1);$('bLancier').classList.toggle('poor',!cas||r.lance<1);$('bSpad').classList.toggle('poor',!cas||r.epee<1);
  const L=tm.lord,el=$('hpP');el.querySelector('b').textContent=Math.max(0,Math.ceil(L.hp));el.querySelector('.fill').style.width=Math.max(0,L.hp/L.maxhp*100)+'%';
}
