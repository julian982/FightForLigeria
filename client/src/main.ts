// FightForLigeria : point d'entrée du client.
import '../css/game.css';
import '../css/home.css';
import { S, MAPS, loadMap, genTrees, newGame, update, setHooks, G, trees, pushOut, findSpot, addBuilding, pay, afford, spawnUnit } from '@ffl/shared';
import { $, ui, sel, ME, setMe, view } from './state';
import { online, act } from './net/act';
import { initMirror, netTick } from './net/mirror';
import { setNetHandlers, leaveGame } from './net/online';
import { THUMBS } from './ui/thumbs';
import { initHome } from './ui/home';
import { glOk, renderer, scene, camera, resize, camT } from './render/engine';
import { rebuildWorld } from './render/world';
import { applyColors } from './render/models';
import { syncScene, updateCam, onRemoved, onReset, toScreen } from './render/sync';
import { drawOverlay } from './render/overlay';
import { updateLife, lifeDebug } from './render/life';
import { drawMapBase, makeMiniBase, renderMini } from './render/minimap';
import { toast, refreshHud, renderSelBar, renderBldPanel } from './ui/hud';
import { fpsCam, updateFps, exitFps } from './render/fps';
import { endGame } from './ui/end';
import { steerLord, updateCursor } from './ui/input';
import { audio, startAmbiance, stopAmbiance, setAmbianceVolume, setMuted, audioState } from './audio';

initHome();
if(!glOk){$('nogl').hidden=false;$('start').disabled=true}

// la simulation prévient le client : maillages à retirer, messages, fin de partie
setHooks({
  removed:onRemoved,
  reset:onReset,
  notify:(team,msg,kind)=>{if(team===ME)toast(msg,kind)},
  end:winner=>endGame(winner),
});

/** carte dont le décor 3D est construit */
let worldMap:string|null=null;
/** charge une carte dans sa version 1v1 ou 2v2 et reconstruit le décor (si ce n'est pas déjà celle-là) */
function setMap(id,mode:'1v1'|'2v2'='1v1'){const key=id+':'+mode;if(worldMap===key)return;loadMap(id,mode);worldMap=key;rebuildWorld();makeMiniBase()}
function startGame(opts){
  newGame({rich:!!opts.rich});
  sel.clear();ui.placing=null;ui.box=null;ui.selB=null;
  const L=G.teams[ME].lord;camT.set(L.x*S,0,L.y*S);
}

function showHome(on){$('home').hidden=!on;$('play').hidden=on;if(on&&window.__showView)window.__showView(window.__homeView||'jouer');else document.title='FightForLigeria · partie'}
let gameOpts:any={},timeScale=1;
/** oriente la caméra pour que son camp soit toujours en bas à gauche de l'écran */
function faceTeam(){view.camYaw=view.yawTarget=Math.PI/4+(ME===1?Math.PI:0)}
function start(opts){leaveGame();setMe(0);faceTeam();gameOpts=opts||{};timeScale=gameOpts.speed||1;showHome(false);applyColors();setMap(selMap);startGame(gameOpts);
  ui.running=true;$('end').hidden=true;resize();refreshHud();startAmbiance();
  if(timeScale>1||gameOpts.rich)toast([timeScale>1?'Vitesse rapide':'',gameOpts.rich?'stock généreux':''].filter(Boolean).join(' · '));toast('Ton stock attend dans les charrettes : pose ta réserve (1) et ton grenier (2), ils sont gratuits')}
function goHome(){if(online())leaveGame();exitFps();stopAmbiance();ui.running=false;if(G)G.ctrl[ME].charging=false;ui.placing=null;ui.box=null;$('end').hidden=true;showHome(true);$('start').focus()}
$('again').addEventListener('click',()=>{if(gameOpts.online){goHome();location.hash='en-ligne';return}start(gameOpts)});
window.__startGame=start;window.__getMap=()=>selMap;window.__pickMap=id=>pickMap(id);
$('toMenu').addEventListener('click',goHome);
$('quit').addEventListener('click',goHome);

// sélection de la carte (vignettes dessinées depuis les vraies données de chaque carte)
let selMap='amboise';try{const v=localStorage.getItem('ffl.map');if(MAPS[v])selMap=v}catch(e){}
{const box=$('maps'),ids=Object.keys(MAPS);
  for(const [i,id] of ids.entries()){
    loadMap(id);const tl=genTrees();
    const b=document.createElement('button');b.type='button';b.className='mapcard';b.dataset.id=id;b.setAttribute('role','radio');
    const cvs=document.createElement('canvas');cvs.width=360;cvs.height=200;drawMapBase(cvs.getContext('2d'),360,200,tl);
    try{THUMBS[id]=cvs.toDataURL()}catch(e){}
    // vignette de la version 2v2 (deux fois plus haute), pour la liste des parties et le salon
    {loadMap(id,'2v2');const c2=document.createElement('canvas');c2.width=360;c2.height=400;drawMapBase(c2.getContext('2d'),360,400,genTrees());try{THUMBS[id+':2v2']=c2.toDataURL()}catch(e){}loadMap(id)}
    const txt=document.createElement('span');txt.className='mc-txt';
    const nm=document.createElement('span');nm.className='mc-name';nm.textContent=MAPS[id].name;
    const pill=document.createElement('span');pill.className='pill';pill.textContent='Choisie';nm.append(' ',pill);
    const ds=document.createElement('span');ds.className='mc-desc';ds.textContent=MAPS[id].desc;
    txt.append(nm,ds);b.append(cvs,txt);
    b.addEventListener('click',()=>pickMap(id));
    b.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(d){e.preventDefault();pickMap(ids[(i+d+ids.length)%ids.length],true)}});
    box.appendChild(b)}
  window.dispatchEvent(new Event('ffl:thumbs'));
}
function pickMap(id,focus=false){
  selMap=id;for(const b of $('maps').children){const on=b.dataset.id===id;b.setAttribute('aria-checked',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus()}
  $('soloSum').textContent=MAPS[id].name+" · 1v1 contre l'IA · non classée";
  try{localStorage.setItem('ffl.map',id)}catch(e){}
}
pickMap(selMap);
applyColors();setMap(selMap);startGame({});refreshHud();

let last=performance.now(),hudT=0,miniT=0;
function frame(now){
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(gameOpts.online){if(ui.running)steerLord();netTick(dt)}
  else if(ui.running){steerLord();const n=timeScale>1?2:1;for(let i=0;i<n&&ui.running;i++)update(dt*timeScale/n)}
  for(const u of [...sel])if(u.dead)sel.delete(u);
  if($('play').hidden||(gameOpts.online&&!G.teams[ME].lord)){requestAnimationFrame(frame);return}
  updateCam(dt);syncScene(dt);updateLife(dt);
  if(ui.fps){updateFps();renderer.render(scene,fpsCam)}else renderer.render(scene,camera);
  drawOverlay();renderSelBar();renderBldPanel();updateCursor();
  hudT+=dt;if(hudT>.15&&ui.running){hudT=0;refreshHud()}
  miniT+=dt;if(miniT>.2){miniT=0;renderMini()}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// accès pour le débogage et les tests de bout en bout
window.__fief={get G(){return G},get trees(){return trees},setMap,pickMap,pushOut,update,start,findSpot,addBuilding,pay,afford,spawnUnit,syncScene,sel,toScreen,lifeDebug,audioState,act,get ME(){return ME},frame:()=>frame(performance.now())};

// ---- réglages du son ----
const sndBtn=$('sndBtn'),sndPanel=$('sndPanel'),volAmb=$('volAmb'),muteBox=$('mute');
function syncSound(){volAmb.value=String(Math.round(audio.ambiance*100));muteBox.checked=audio.muted;sndBtn.classList.toggle('off',audio.muted)}
syncSound();
sndBtn.addEventListener('click',()=>{sndPanel.hidden=!sndPanel.hidden;sndBtn.setAttribute('aria-expanded',String(!sndPanel.hidden));sndBtn.blur()});
volAmb.addEventListener('input',()=>{setAmbianceVolume(+volAmb.value/100);if(audio.muted&&+volAmb.value>0){setMuted(false)}syncSound()});
muteBox.addEventListener('change',()=>{setMuted(muteBox.checked);syncSound()});
addEventListener('keydown',(e:any)=>{if(!ui.running||e.repeat||(e.target&&e.target.tagName==='INPUT'))return;if(e.key==='m'||e.key==='M'){setMuted(!audio.muted);syncSound()}});
addEventListener('mousedown',(e:any)=>{if(!sndPanel.hidden&&!e.target.closest('.snd'))sndPanel.hidden=true});

// ---- partie en ligne : le salon (ui/online.ts) passe la main ici quand l'hôte lance ----
setNetHandlers({
  // le serveur lance la partie : on prépare la carte et un miroir vide, l'affichage démarre au premier instantané
  start(m){setMe(m.team);faceTeam();gameOpts={online:true,code:m.code,mode:m.mode,names:m.names||[]};timeScale=1;sel.clear();ui.placing=null;ui.box=null;ui.selB=null;ui.running=false;
    setMap(m.map,m.mode==='2v2'?'2v2':'1v1');applyColors();initMirror(m.mode==='2v2'?4:2);showHome(false);$('end').hidden=true;resize();toast('La partie commence !')},
  first(){const L=G.teams[ME].lord;camT.set(L.x*S,0,L.y*S);ui.running=true;refreshHud();startAmbiance();
    const duo=G.teams.length>2,where=duo?['en haut à gauche','en haut à droite','en bas à gauche','en bas à droite'][ME]:(ME===0?'à gauche':'à droite');
    toast('Tu joues '+where+(duo&&gameOpts.names[ME^2]?' · ton allié : '+gameOpts.names[ME^2]:''));
    toast('Ton stock attend dans les charrettes : pose ta réserve (1) et ton grenier (2)')},
  end(m){G.over=true;G.winner=m.winner;G.st=m.st;G.t=m.t;endGame(m.winner)},
  note(msg,kind){toast(msg,kind)},
  lost(){toast('Connexion au serveur perdue','warn');setTimeout(goHome,1500)},
});
