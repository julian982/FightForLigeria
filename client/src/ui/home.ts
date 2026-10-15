// L'accueil : navigation entre les pages, préparation contre l'IA, couleur du royaume, règles du classement.
// Le classement en direct, la file classée et l'animation d'Elo sont dans ui/ranked.ts.
// Les parties en ligne (liste, création, salon) sont dans ui/online.ts.
import { ELO } from '@ffl/shared';
import { initOnline } from './online';
import { initAccount } from './account';
import { initRanked } from './ranked';
import { RANKS, DIV, range, shield } from './rankbadge';

const byId=(id:string):any=>document.getElementById(id);
const all=(q:string):any[]=>Array.from(document.querySelectorAll(q));

export function initHome(){
  (()=>{
    const VIEWS=['jouer','solo','en-ligne','creer','salon','classement','guide','file','compte','parties','reinit','mentions','confidentialite','cgu'],NAV={file:'jouer',solo:'jouer','en-ligne':'jouer',creer:'jouer',salon:'jouer'},
      TITLES={jouer:'FightForLigeria',solo:'Contre l\'IA · FightForLigeria','en-ligne':'Parties en ligne · FightForLigeria',creer:'Créer une partie · FightForLigeria',salon:'Salon · FightForLigeria',classement:'Classement · FightForLigeria',guide:'Comment jouer · FightForLigeria',file:'Partie classée · FightForLigeria',compte:'Mon compte · FightForLigeria',parties:'Mes parties · FightForLigeria',reinit:'Nouveau mot de passe · FightForLigeria',mentions:'Mentions légales · FightForLigeria',confidentialite:'Confidentialité · FightForLigeria',cgu:'Conditions d\'utilisation · FightForLigeria'};
    const home=byId('home');
    function show(v,scroll=false){
      v=String(v||'').split('?')[0];
      if(!VIEWS.includes(v))v='jouer';
      for(const id of VIEWS)byId('v-'+id).hidden=id!==v;
      for(const a of all('.navlinks a'))a.dataset.view===(NAV[v]||v)?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');
      window.dispatchEvent(new CustomEvent('ffl:view',{detail:v}));
      if(!home.hidden)document.title=TITLES[v];
      window.__homeView=v;
      if(scroll)home.scrollTo(0,0);
    }
    window.__showView=show;
    addEventListener('hashchange',()=>show(location.hash.slice(1),true));
    show(location.hash.slice(1),false);
  })();
  // ---- Couleur du royaume ----
  (()=>{
    const K=[{id:'azur',n:'Azur',c:'#3f6fd8'},{id:'gueules',n:'Gueules',c:'#c9402e'},{id:'sinople',n:'Sinople',c:'#2f8a4a'},{id:'pourpre',n:'Pourpre',c:'#7f43b0'},
             {id:'or',n:'Or',c:'#d9a630'},{id:'loire',n:'Loire',c:'#2a8f9a'},{id:'orange',n:'Orangé',c:'#e0782a'},{id:'sable',n:'Sable',c:'#3b3d45'}];
    const foeOf=id=>['gueules','orange','or','pourpre'].includes(id)?K[0]:K[1];
    const box=byId('swatches'),name=byId('realmName'),root=document.documentElement;
    function pick(id,focus=false){
      const k=K.find(x=>x.id===id)||K[0],f=foeOf(k.id);
      root.style.setProperty('--me',k.c);root.style.setProperty('--foe',f.c);
      window.__kingdom={me:k.c,foe:f.c,name:k.n};name.textContent=k.n;
      for(const b of box.children){const on=b.dataset.id===k.id;b.setAttribute('aria-checked',on);b.tabIndex=on?0:-1;if(on&&focus)b.focus()}
      try{localStorage.setItem('ffl.realm',k.id)}catch(e){}
    }
    K.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='sw';b.dataset.id=k.id;b.style.background=k.c;
      b.setAttribute('role','radio');b.setAttribute('aria-label',k.n);b.title=k.n;
      b.addEventListener('click',()=>pick(k.id));
      b.addEventListener('keydown',e=>{const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(d){e.preventDefault();pick(K[(i+d+K.length)%K.length].id,true)}});
      box.appendChild(b)});
    let saved='azur';try{saved=localStorage.getItem('ffl.realm')||'azur'}catch(e){}
    pick(saved);
  })();
  // ---- Classement (aperçu, pas encore actif) ----
  (()=>{
    const START=1000;
    const ladder=byId('ladder');
    const startIdx=(START-800)/100; // 2 = Bois I
    ladder.innerHTML=RANKS.map((r,ri)=>{
      const here=Math.floor(startIdx/3)===ri;
      const rows=[0,1,2].map(d=>{const i=ri*3+d;return `<li class="${i===startIdx?'start':''}"><span>${DIV[d]}</span><span>${range(i)}</span></li>`}).join('');
      return `<div class="tier${here?' here':''}"><svg viewBox="0 0 100 120" role="img" aria-label="Rang ${r.n}">${shield(ri,2)}</svg><b>${r.n}</b>${here?'<span class="here-tag">Départ</span>':''}<ul class="divs">${rows}</ul></div>`;
    }).join('');
    byId('meBadge').innerHTML=shield(0,0,true);
    const COPY:Record<string,any>={
      '1v1':{mode:'Ton rang 1v1',text:'Joue 5 parties classées en 1v1 pour être placé. Tu démarres à <b>1000 Elo</b>, soit <b>Bois I</b>, puis ton rang monte ou descend selon tes résultats.',board:'Le tableau des meilleurs joueurs 1v1 s\'affichera ici à l\'ouverture du classement.'},
      '2v2':{mode:'Ton rang 2v2',text:'Joue 5 parties classées en 2v2 pour être placé. Tu démarres aussi à <b>1000 Elo</b>, soit <b>Bois I</b>. Une équipe compte comme la moyenne de ses deux seigneurs.',board:'Le tableau des meilleurs joueurs 2v2 s\'affichera ici à l\'ouverture du classement.'},
    };
    const tabs=[...all('.tab')];
    function setMode(m){
      for(const t of tabs){const on=t.dataset.mode===m;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1}
      byId('rankPanel').setAttribute('aria-labelledby','tab'+m);
      byId('meMode').textContent=COPY[m].mode;
      byId('meText').innerHTML=COPY[m].text;
      byId('boardEmpty').textContent=COPY[m].board;
      try{localStorage.setItem('ffl.rankMode',m)}catch(e){}
      window.dispatchEvent(new CustomEvent('ffl:rankmode',{detail:m}));
    }
    tabs.forEach((t,i)=>{t.addEventListener('click',()=>setMode(t.dataset.mode));
      t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];n.focus();setMode(n.dataset.mode)}})});
    let m='1v1';try{const v=localStorage.getItem('ffl.rankMode');if(v==='2v2')m=v}catch(e){}
    setMode(m);
  })();
  // ---- Elo : calcul partagé par le simulateur (et plus tard par le serveur) ----
  window.ELO=ELO;
  (()=>{
    const $=byId;
    // ---- simulateur ----
    function sim(){
      const me=Math.max(0,+$('simMe').value||0),foe=Math.max(0,+$('simFoe').value||0),g=+$('simG').value;
      const ch=ELO.expected(me,foe),w=ELO.delta(me,foe,true,g),l=ELO.delta(me,foe,false,g);
      $('simChance').textContent=`Tes chances estimées : ${Math.round(ch*100)} % · K = ${ELO.K(g)}`;
      $('simWin').textContent='+'+w;$('simLoss').textContent='−'+Math.abs(l);
      $('simWinR').textContent=`${me} → ${me+w} · ${ELO.rank(me+w)}`;
      $('simLossR').textContent=`${me} → ${Math.max(0,me+l)} · ${ELO.rank(Math.max(0,me+l))}`;
    }
    for(const id of ['simMe','simFoe','simG'])$(id).addEventListener('input',sim);
    sim();

  })();
  // ---- contre l'IA : stock et vitesse, la carte est choisie par main.ts (#maps) ----
  (()=>{
    const solo={stock:'normal',speed:'1'};
    for(const [box,key] of [['soloStock','stock'],['soloSpeed','speed']])
      for(const b of byId(box).children)b.addEventListener('click',()=>{solo[key]=b.dataset.v;for(const o of byId(box).children)o.setAttribute('aria-pressed',o===b)});
    byId('tutoStart').addEventListener('click',()=>{if(window.__startGame)window.__startGame({tuto:true})});
    byId('start').addEventListener('click',()=>{if(window.__startGame)window.__startGame({rich:solo.stock==='riche',speed:+solo.speed})});
  })();
  initOnline();
  initAccount();
  initRanked();
}
