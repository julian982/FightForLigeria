// FightForLigeria : point d'entrée du client.
import '../css/game.css';
import '../css/home.css';
import { S, MAPS, loadMap, genTrees, newGame, update, setHooks, G, trees, pushOut, findSpot, addBuilding, pay, afford, spawnUnit } from '@ffl/shared';
import { $, ui, sel, ME, setMe, view } from './state';
import { online, act } from './net/act';
import { initMirror, netTick } from './net/mirror';
import { setNetHandlers, hostGame, joinGame, leaveGame, netState, serverUrl, setServerUrl } from './net/online';
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
function setMap(id){worldMap=loadMap(id);rebuildWorld();makeMiniBase()}
function startGame(opts){
  newGame({rich:!!opts.rich});
  sel.clear();ui.placing=null;ui.box=null;ui.selB=null;
  const L=G.teams[ME].lord;camT.set(L.x*S,0,L.y*S);
}

function showHome(on){$('home').hidden=!on;$('play').hidden=on;if(on&&window.__showView)window.__showView(window.__homeView||'jouer');else document.title='FightForLigeria · partie'}
let gameOpts:any={},timeScale=1;
/** oriente la caméra pour que son camp soit toujours en bas à gauche de l'écran */
function faceTeam(){view.camYaw=view.yawTarget=Math.PI/4+(ME===1?Math.PI:0)}
function start(opts){leaveGame();setMe(0);faceTeam();gameOpts=opts||{};timeScale=gameOpts.speed||1;showHome(false);applyColors();if(worldMap!==selMap)setMap(selMap);startGame(gameOpts);
  ui.running=true;$('end').hidden=true;resize();refreshHud();startAmbiance();
  if(gameOpts.priv)toast('Partie privée'+(timeScale>1?' · vitesse rapide':'')+(gameOpts.rich?' · stock généreux':''));toast('Ton stock attend dans les charrettes : pose ta réserve (1) et ton grenier (2), ils sont gratuits')}
function goHome(){if(online())leaveGame();exitFps();stopAmbiance();ui.running=false;if(G)G.ctrl[ME].charging=false;ui.placing=null;ui.box=null;$('end').hidden=true;showHome(true);$('start').focus()}
$('start').addEventListener('click',()=>start({}));
$('again').addEventListener('click',()=>{if(gameOpts.online){goHome();location.hash='lobby';return}start(gameOpts)});
window.__startGame=start;window.__getMap=()=>selMap;window.__pickMap=id=>pickMap(id);
$('toMenu').addEventListener('click',goHome);
$('quit').addEventListener('click',goHome);

// sélection de la carte (vignettes dessinées depuis les vraies données de chaque carte)
let selMap='amboise';try{const v=localStorage.getItem('ffl.map');if(MAPS[v])selMap=v}catch(e){}
{const box=$('maps'),ids=Object.keys(MAPS);
  for(const [i,id] of ids.entries()){
    loadMap(id);const tl=genTrees();
    const b=document.createElement('button');b.type='button';b.className='mapcard';b.dataset.id=id;b.setAttribute('role','radio');
    const cvs=document.createElement('canvas');cvs.width=180;cvs.height=100;drawMapBase(cvs.getContext('2d'),180,100,tl);
    const nm=document.createElement('span');nm.textContent=MAPS[id].name;b.append(cvs,nm);
    b.addEventListener('click',()=>pickMap(id));
    b.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(d){e.preventDefault();pickMap(ids[(i+d+ids.length)%ids.length],true)}});
    box.appendChild(b)}
}
function pickMap(id,focus=false){
  selMap=id;for(const b of $('maps').children){const on=b.dataset.id===id;b.setAttribute('aria-checked',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus()}
  $('mapDesc').textContent=MAPS[id].desc;$('quickSub').textContent="Toi contre l'IA · 1v1 · "+MAPS[id].name;
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

// ---- partie en ligne (lobby privé 1v1) ----
const lobStatus=(msg:string,code?:string)=>{$('netNote').textContent=msg;$('joinMsg').textContent=window.__homeView==='lobby'&&!code&&/introuvable|joindre|Connexion/.test(msg)?msg:'';if(code)$('lobCode').textContent=code;window.__lobRender&&window.__lobRender()};
setNetHandlers({
  lobby:lobStatus,
  // le serveur lance la partie : on prépare la carte et un miroir vide, l'affichage démarre au premier instantané
  start(m){setMe(m.team);faceTeam();gameOpts={online:true,code:m.code};timeScale=1;sel.clear();ui.placing=null;ui.box=null;ui.selB=null;ui.running=false;
    applyColors();if(worldMap!==m.map)setMap(m.map);initMirror();showHome(false);$('end').hidden=true;resize();toast('Partie en ligne '+m.code+' : la partie commence !')},
  first(){const L=G.teams[ME].lord;camT.set(L.x*S,0,L.y*S);ui.running=true;refreshHud();startAmbiance();
    toast((ME===0?'Tu joues à gauche':'Tu joues à droite')+' · ton stock attend dans les charrettes : pose ta réserve (1) et ton grenier (2)')},
  end(m){G.over=true;G.winner=m.winner;G.st=m.st;G.t=m.t;endGame(m.winner)},
  note(msg,kind){toast(msg,kind)},
  lost(){toast('Connexion au serveur perdue','warn');setTimeout(goHome,1500)},
});
window.__onlineHost=(o)=>{const v=$('srvUrl').value.trim();if(v)setServerUrl(v);return hostGame(o)};
window.__onlineJoin=(code)=>{const v=$('srvUrl').value.trim();if(v)setServerUrl(v);$('joinMsg').textContent='Connexion…';return joinGame(code)};
window.__onlineState=netState;
$('srvUrl').value=serverUrl();
