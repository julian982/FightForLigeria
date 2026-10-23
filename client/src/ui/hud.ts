// Le bandeau du haut (ressources, vie du seigneur) et celui du bas (bâtiments, recrutement).
import { BUILD_LIST, DEF, G, RESN, truceReal, STORE_OF, afford, armySize, identityOf, isFoe, jobOf, missing, refundOf } from '@ffl/shared';
import { TEAMC } from '../render/engine';
import { portraitSvg } from './portrait';
import { unitShot } from '../render/unitshot';
import { act } from '../net/act';
import { playSfx } from '../audio';

// ---- trêve du début de partie : décompte en haut de l'écran, cloche à la fin ----
let truceWas = 0;
export function renderTruce(){
  const t=G&&ui.running&&!G.over?truceReal():0,el=$('truce');
  if(t>0){if(el.hidden){el.hidden=false;document.body.classList.add('in-truce')}$('truceS').textContent=String(Math.ceil(t))}
  else if(!el.hidden){el.hidden=true;document.body.classList.remove('in-truce');
    if(truceWas>0&&truceWas<1.5&&ui.running){toast('La trêve est terminée : le combat commence !');playSfx('cloche',.75)}}
  truceWas=t;
}
import { $, ME, sel, ui } from '../state';

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
export function selectBuild(t){if(!ui.running)return;ui.placing=ui.placing===t?null:t;if(ui.placing)playSfx('choix',.6,0,.97+Math.random()*.06);ui.selB=null;ui.selW=null;act.cancel();refreshHud()}
export function askRecruit(type){
  if(!ui.running)return;
  const err=act.recruit(type);if(err){toast(err);return}
  refreshHud();
}
$('bArcher').addEventListener('click',()=>askRecruit('archer'));
$('bLancier').addEventListener('click',()=>askRecruit('lancier'));
$('bSpad').addEventListener('click',()=>askRecruit('spadassin'));
export function setChip(id,v,low=false,wait=0){const el=$(id);el.querySelector('b').textContent=v;el.classList.toggle('low',!!low);
  // stock en attente d'une réserve ou d'un grenier
  let w=el.querySelector('em');if(wait>0){if(!w){w=document.createElement('em');el.appendChild(w)}const t='+'+wait;if(w.textContent!==t)w.textContent=t;el.title=wait+' en attente : pose '+(id==='cBle'?'ton grenier':['cArc','cLance','cEpee'].includes(id)?'ton armurerie':'ta réserve')}else if(w){w.remove();el.title=''}}
export function refreshHud(){
  const tm=G.teams[ME],r=tm.res;
  const sh=tm.stash;setChip('cBois',r.bois,false,sh.bois);setChip('cPierre',r.pierre,false,sh.pierre);setChip('cBle',r.ble,r.ble<=0&&sh.ble<=0,sh.ble);setChip('cFer',r.fer,false,sh.fer);setChip('cArc',r.arc,false,sh.arc||0);setChip('cLance',r.lance,false,sh.lance||0);setChip('cEpee',r.epee,false,sh.epee||0);setChip('cFleche',r.fleche,r.fleche<=2);
  setChip('cArmy',armySize(ME));
  for(const b of bb.children){const t=b.dataset.b,missing=DEF[t].store&&!G.buildings.some(o=>o.team===ME&&o.type===t&&!o.dead);b.classList.toggle('poor',!afford(tm,t)||!!(DEF[t].store&&!missing));b.classList.toggle('active',ui.placing===t);b.classList.toggle('need',!!missing)}
  const cas=G.buildings.some(b=>b.team===ME&&b.type==='caserne'&&!b.dead&&!(b.build<1));
  $('bArcher').classList.toggle('poor',!cas||r.arc<1);$('bLancier').classList.toggle('poor',!cas||r.lance<1);$('bSpad').classList.toggle('poor',!cas||r.epee<1);
  const L=tm.lord,el=$('hpP');el.querySelector('b').textContent=Math.max(0,Math.ceil(L.hp));el.querySelector('.fill').style.width=Math.max(0,L.hp/L.maxhp*100)+'%';
}

// ---- barre de sélection : « 2 Lanciers · 3 Archers », un clic garde un seul type ----
export const SEL_NAMES={archer:['Archer','Archers'],lancier:['Lancier','Lanciers'],spadassin:['Spadassin','Spadassins']};
export const selBar=$('selBar');let selKey='';
export function renderSelBar(){
  const n:Record<string,number>={};for(const u of sel)if(!u.dead)n[u.type]=(n[u.type]||0)+1;
  const types=Object.keys(SEL_NAMES).filter(t=>n[t]);
  const key=types.map(t=>t+n[t]).join(',');if(key===selKey)return;selKey=key;
  selBar.hidden=!types.length;if(!types.length){selBar.innerHTML='';return}
  // chaque type de troupe a sa carte : image du modèle 3D, nombre et nom
  selBar.innerHTML='<span>Sélection</span>'+types.map(t=>{const img=unitShot(t,ME);
    return `<button type="button" data-t="${t}" title="Ne garder que les ${SEL_NAMES[t][1].toLowerCase()} (Maj : les retirer)">${img?`<img src="${img}" alt="" draggable="false">`:''}<span class="sb-txt"><b>${n[t]}</b>${SEL_NAMES[t][n[t]>1?1:0]}</span></button>`}).join('');
}
selBar.addEventListener('click',(e:any)=>{
  const b=e.target.closest('button');if(!b)return;const t=b.dataset.t;
  for(const u of [...sel])if(e.shiftKey?u.type===t:u.type!==t)sel.delete(u);
  b.blur();renderSelBar();
});

// ---- fenêtre du bâtiment sélectionné : nom, vie, bouton Démolir ----
export const bldPanel=$('bldPanel');let bldKey='';
export function renderBldPanel(){
  let b=ui.selB;if(b&&(b.dead||!ui.running)){b=ui.selB=null}
  const site=b&&b.build<1,mine=b&&b.team===ME,dmg=b&&!site&&b.hp<b.maxhp,ref=b?refundOf(b.type):{};
  const key=b?[b.id,b.team,Math.ceil(b.hp),dmg,site?Math.floor(b.build*100):100].join(','):'';if(key===bldKey)return;bldKey=key;
  bldPanel.hidden=!b;if(!b){bldPanel.innerHTML='';return}
  const d=DEF[b.type],gain=Object.entries(ref).map(([k,v])=>'+'+v+' '+RESN[k]).join(', ');
  let act='';
  if(mine){
    const why=b.type==='keep'?'Le donjon ne peut pas être démoli':dmg?'Endommagé : impossible de le démolir':'';
    act=why?`<p class="why">${why}</p>`:`<button type="button" class="demo">Démolir${gain?' <small>('+gain+')</small>':' <small>(rien à récupérer)</small>'}</button>`;
  }
  bldPanel.innerHTML=`<div class="bp-head"><b>${d.name}</b><button type="button" class="x" aria-label="Fermer">×</button></div>
    <p class="who">${mine?'Ton bâtiment':'Bâtiment ennemi'}</p>${site?`<p class="hp">En construction : ${Math.floor(b.build*100)} %${b.worker&&!b.worker.dead?'':' · l\'ouvrier arrive'}</p>`:''}${mine?`<div class="bp-hp"><div style="width:${Math.max(0,b.hp/b.maxhp*100)}%"></div></div><p class="hp">Vie ${Math.max(0,Math.ceil(b.hp))} / ${b.maxhp}</p>`:''}${act}`;
}
bldPanel.addEventListener('click',(e:any)=>{
  if(e.target.closest('.x')){ui.selB=null;renderBldPanel();return}
  if(e.target.closest('.demo')&&ui.selB){const err=act.demolish(ui.selB);if(err)toast(err,'warn');else{toast(DEF[ui.selB.type].name+' démoli');ui.selB=null;refreshHud()}renderBldPanel()}
});

// ---- fiche de l'ouvrier sélectionné : portrait, prénom et nom, métier, ce qu'il fait ----
const WITH:Record<string,string>={bois:'du bois',pierre:'de la pierre',ble:'du blé',fer:'du fer',arc:'un arc',lance:'une lance',epee:'une épée',fleche:'des flèches'};
/** le chantier passe avant le métier */
const BUILDS='Construit le bâtiment';
const DOING:Record<string,string>={bucheron:'Coupe du bois',carriere:'Taille la pierre',ferme:'Cultive le blé',arcs:'Fabrique un arc',lances:'Fabrique une lance',mine:'Extrait du fer',forge:'Forge une épée',fleches:'Taille des flèches'};
const STORE_NAME:Record<string,string>={reserve:'à la réserve',grenier:'au grenier',armurerie:'à l\'armurerie'};
const WORKSHOP:Record<string,string>={arcs:'à l\'atelier',lances:'à l\'atelier',fleches:'à l\'atelier',forge:'à la forge'};
const TAKE:Record<string,string>={arcs:'du bois',lances:'du bois',fleches:'du bois',forge:'du fer et du bois'};
/** ce que fait l'ouvrier, lisible en solo comme en ligne (seuls les drapeaux affichés sont transmis par le réseau) */
export function workerActivity(w){
  const b=w.b;if(!b)return '';
  if(w.noStore==='grenier')return 'Attend un grenier pour ranger son blé';
  if(w.noStore==='armurerie')return 'Attend une armurerie pour ranger '+(WITH[w.carry?.type]||'son arme');
  if(w.noStore)return w.state==='toFetch'||!w.carry?'Attend une réserve pour y prendre '+(TAKE[b.type]||'ses matières'):'Attend une réserve pour ranger '+(WITH[w.carry.type]||'sa production');
  if(w.idle)return 'Plus d\'arbres à couper';
  if(w.need){const inp=DEF[b.type].input||{},r=G.teams[w.team].res;const m=Object.keys(inp).filter(k=>r[k]<inp[k]).map(k=>RESN[k]);return 'Attend '+(m.length?m.join(' et '):'ses matières')+' à la réserve'}
  if(w.state==='toFetch')return 'Va chercher '+(TAKE[b.type]||'ses matières')+' à la réserve';
  if(w.carry&&w.carry.input)return 'Apporte '+(TAKE[b.type]||'ses matières')+' '+(WORKSHOP[b.type]||'à l\'atelier');
  if(w.carry)return 'Rapporte '+(WITH[w.carry.type]||'sa production')+' '+(STORE_NAME[STORE_OF[w.carry.type]]||'au donjon');
  if(b.build<1)return w.working?BUILDS:'Se rend sur le chantier';
  if(w.working)return DOING[b.type]||'Travaille';
  return w.builder?'Rentre au donjon':'Se rend au travail';
}
export const wkPanel=$('wkPanel');let wkId=-1,wkKey='';
export function renderWkPanel(){
  let w=ui.selW;if(w&&(w.dead||!ui.running||!G.workers.includes(w))){w=ui.selW=null}
  if(!w){if(wkId!==-1){wkId=-1;wkKey='';wkPanel.hidden=true;wkPanel.innerHTML=''}return}
  const idn=identityOf(w.id,G.seed||0),mine=w.team===ME,foe=isFoe(w.team,ME);
  if(w.id!==wkId){
    wkId=w.id;wkKey='';wkPanel.hidden=false;
    wkPanel.innerHTML=`<div class="wk-pic">${portraitSvg(idn,TEAMC[w.team].m,64)}</div><div class="wk-txt"><div class="bp-head"><b></b><button type="button" class="x" aria-label="Fermer">×</button></div>
      <p class="who"></p><div class="bp-hp"><div></div></div><p class="act"></p></div>`;
    wkPanel.querySelector('.bp-head b').textContent=idn.first+' '+idn.last;
  }
  const job=jobOf(w.b?.type,idn.female),act=mine?workerActivity(w):'',starve=G.teams[w.team]?.starving;
  const key=[job,act,Math.ceil(w.hp),w.maxhp,starve].join('|');if(key===wkKey)return;wkKey=key;
  wkPanel.querySelector('.who').textContent=`${job} · ${idn.age} ans${mine?'':foe?' · ennemi':' · allié'}`;
  (wkPanel.querySelector('.bp-hp div') as HTMLElement).style.width=Math.max(0,w.hp/w.maxhp*100)+'%';
  wkPanel.querySelector('.act').textContent=(starve&&mine?'Affamé · ':'')+act;
}
wkPanel.addEventListener('click',(e:any)=>{if(e.target.closest('.x')){ui.selW=null;renderWkPanel()}});
