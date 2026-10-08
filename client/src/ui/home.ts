// L'accueil : navigation entre les pages, couleur du royaume, classement, file classée, lobby privé.
import { ELO, QUEUE_WINDOWS } from '@ffl/shared';

const byId=(id:string):any=>document.getElementById(id);
const all=(q:string):any[]=>Array.from(document.querySelectorAll(q));

export function initHome(){
  (()=>{
    const VIEWS=['jouer','classement','guide','file','lobby'],NAV={file:'jouer',lobby:'jouer'},TITLES={jouer:'FightForLigeria',classement:'Classement · FightForLigeria',guide:'Comment jouer · FightForLigeria',file:'Partie classée · FightForLigeria',lobby:'Partie privée · FightForLigeria'};
    const home=byId('home');
    function show(v,scroll=false){
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
    const RANKS=[
      {n:'Bois',  a:'#9a6a3c',b:'#5e3d20',e:'#3b2614',k:'grain'},
      {n:'Pierre',a:'#b3aea3',b:'#7a766d',e:'#4c4943',k:'blocks'},
      {n:'Fer',   a:'#6e747c',b:'#3c4047',e:'#24272b',k:'rivets'},
      {n:'Argent',a:'#eef1f4',b:'#a9b0b8',e:'#6f7780',k:'filigree'},
      {n:'Or',    a:'#ffe08a',b:'#d39b2a',e:'#8a5d12',k:'filigree'},
      {n:'Rubis', a:'#ffe08a',b:'#d39b2a',e:'#8a5d12',k:'gem'},
    ];
    const DIV=['III','II','I'];
    const START=1000;
    const lo=i=>i===0?null:800+100*i, hi=i=>i===17?null:899+100*i;
    const range=i=>lo(i)==null?'< 900':hi(i)==null?lo(i)+' +':lo(i)+'–'+hi(i);
    let uid=0;
    function shield(rank,div,unknown=false){
      const id='g'+(uid++),r=RANKS[rank]||RANKS[0];
      const path='M50 4 L92 16 L92 56 C92 86 72 104 50 116 C28 104 8 86 8 56 L8 16 Z';
      if(unknown)return `<path d="${path}" fill="none" stroke="#6b5b45" stroke-width="4" stroke-dasharray="7 6"/><text x="50" y="72" text-anchor="middle" font-family="IM Fell English SC, Georgia, serif" font-size="44" fill="#8a7a62">?</text>`;
      let deco='';
      if(r.k==='grain')deco=`<g stroke="${r.e}" stroke-width="2" fill="none" opacity=".55"><path d="M26 24 C30 50 24 76 34 100"/><path d="M50 14 C46 46 54 74 50 108"/><path d="M74 24 C70 50 76 76 66 100"/></g><path d="M8 40 L92 40" stroke="#c9a46a" stroke-width="5" opacity=".7"/>`;
      if(r.k==='blocks')deco=`<g stroke="${r.e}" stroke-width="2" opacity=".55"><path d="M10 38 H90 M10 62 H90 M12 86 H88"/><path d="M36 16 V38 M64 16 V38 M50 38 V62 M28 62 V86 M72 62 V86 M50 86 V108"/></g>`;
      if(r.k==='rivets')deco=`<g fill="${r.a}" stroke="${r.e}" stroke-width="1.5">${[[22,22],[78,22],[18,58],[82,58],[32,94],[68,94]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</g><path d="M50 10 V110 M10 52 H90" stroke="${r.e}" stroke-width="3" opacity=".6"/>`;
      if(r.k==='filigree')deco=`<g fill="none" stroke="${r.e}" stroke-width="2" opacity=".6"><path d="M50 30 C36 40 36 60 50 70 C64 60 64 40 50 30Z"/><path d="M50 70 C40 80 40 92 50 100 C60 92 60 80 50 70Z"/><path d="M22 40 C30 46 30 56 22 62 M78 40 C70 46 70 56 78 62"/></g>`;
      if(r.k==='gem')deco=`<g fill="none" stroke="${r.e}" stroke-width="2" opacity=".55"><path d="M22 40 C30 46 30 56 22 62 M78 40 C70 46 70 56 78 62"/></g><polygon points="50,34 68,50 62,74 38,74 32,50" fill="#c0182f" stroke="#5c0612" stroke-width="2.5"/><polygon points="50,34 58,50 50,58 42,50" fill="#ff6b7d" opacity=".75"/><polygon points="38,74 50,58 62,74" fill="#8a0d20" opacity=".7"/>`;
      const studs=Array.from({length:3},(_,k)=>{const on=k<=div;const x=50+(k-1)*16;return `<path d="M${x} 9 l5 8 l-5 8 l-5 -8 Z" fill="${on?'#fff3cf':'rgba(0,0,0,.35)'}" stroke="${r.e}" stroke-width="1.2"/>`}).join('');
      return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.a}"/><stop offset="1" stop-color="${r.b}"/></linearGradient></defs>
        <path d="${path}" fill="url(#${id})" stroke="${r.e}" stroke-width="4"/>${deco}<path d="M8 28 L92 28 L92 16 L50 4 L8 16 Z" fill="rgba(0,0,0,.18)"/>${studs}`;
    }
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

    // ---- file classée (démonstration de l'élargissement) ----
    let qMode='1v1',qT=0,qTimer=null;
    const WIN=QUEUE_WINDOWS;
    const fmt=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
    function qRender(){
      const wi=WIN.findIndex(([lim])=>qT<lim);
      $('qTimer').textContent=fmt(qT);$('qWindow').textContent=WIN[wi][1]==='Tous'?"N'importe qui":WIN[wi][1]+' Elo';
      $('qBar').style.width=Math.min(100,qT/60*100)+'%';
      for(const tr of $('qRules').children)tr.classList.toggle('on',!!qTimer&&+tr.dataset.w===wi);
      if(qTimer)$('qStatus').textContent=qT<60?`Recherche d'un adversaire ${qMode}…`:"Aucun seigneur en ligne pour l'instant. Le classé ouvrira avec le jeu en ligne.";
      $('qAi').hidden=!qTimer||qT<8;
    }
    function qStop(){clearInterval(qTimer);qTimer=null;qT=0;$('qStart').hidden=false;$('qCancel').hidden=true;$('qStatus').textContent='Prêt à chercher un adversaire.';qRender()}
    $('qStart').addEventListener('click',()=>{qT=0;qTimer=setInterval(()=>{qT++;qRender()},1000);$('qStart').hidden=true;$('qCancel').hidden=false;qRender()});
    $('qCancel').addEventListener('click',qStop);
    $('qAi').addEventListener('click',()=>{qStop();window.__startGame&&window.__startGame({})});
    for(const b of all('.qtab'))b.addEventListener('click',()=>{qMode=b.dataset.q;
      for(const o of all('.qtab'))o.setAttribute('aria-selected',o===b);
      $('qModeLbl').textContent=`File ${qMode} · ton Elo ${ELO.START} (${ELO.rank(ELO.START)})`;if(qTimer)qRender()});
    addEventListener('ffl:view',(e:any)=>{if(e.detail!=='file'&&qTimer)qStop();if(e.detail==='lobby')lobRender()});

    // ---- lobby privé ----
    const L:any={mode:'1v1',stock:'normal',speed:'1',slots:{'1v1':[['me'],['ia']],'2v2':[['me','ami'],['ia','ia']]}};
    const pick=a=>a[Math.random()*a.length|0],AL='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $('lobCode').textContent=pick(['LOIRE','CHER','VIENNE','TOURS','CHINON'])+'-'+Array.from({length:4},()=>pick([...AL])).join('');
    function segSet(box,v){for(const b of $(box).children)b.setAttribute('aria-pressed',b.dataset.v===v)}
    function lobRender(){
      const sl=L.slots[L.mode],cs=getComputedStyle(document.documentElement);
      const col=[cs.getPropertyValue('--me').trim(),cs.getPropertyValue('--foe').trim()];
      $('teams').innerHTML=sl.map((team,ti)=>`<div class="team"><h4><i style="background:${col[ti]}"></i>${ti===0?'Ton royaume':'Royaume adverse'}</h4>`+
        team.map((t,si)=>t==='me'?`<div class="slot me"><span class="who">Toi</span><span class="st">Hôte du lobby</span></div>`:
          `<div class="slot"><span class="who">${t==='ia'?'IA':'Ami'}</span><span class="st">${t==='ia'?'Contrôlé par l\'ordinateur':'En attente : envoie-lui le code'}</span>
           <div class="seg" data-t="${ti}" data-s="${si}"><button type="button" data-v="ami" aria-pressed="${t==='ami'}">Ami</button><button type="button" data-v="ia" aria-pressed="${t==='ia'}">IA</button></div></div>`).join('')+`</div>`).join('');
      for(const sg of $('teams').querySelectorAll('.seg'))for(const b of sg.children)b.addEventListener('click',()=>{L.slots[L.mode][+sg.dataset.t][+sg.dataset.s]=b.dataset.v;lobRender()});
      segSet('lobMode',L.mode);segSet('lobStock',L.stock);segSet('lobSpeed',L.speed);
      let mp='amboise';try{mp=window.__getMap?window.__getMap():(localStorage.getItem('ffl.map')||'amboise')}catch(e){}segSet('lobMap',mp);
      const ok=L.mode==='1v1'&&sl[1][0]==='ia';
      $('lobLaunch').disabled=!ok;
      $('lobNote').textContent=ok?'Partie non classée contre l\'IA, avec tes réglages.':(L.mode==='2v2'?'Le 2v2 arrivera avec le jeu en ligne.':'Pour jouer contre un ami, il faudra le jeu en ligne.')+' Mets une IA en face en 1v1 pour lancer tout de suite.';
    }
    for(const [box,key] of [['lobMode','mode'],['lobStock','stock'],['lobSpeed','speed']])
      for(const b of $(box).children)b.addEventListener('click',()=>{L[key]=b.dataset.v;lobRender()});
    for(const b of $('lobMap').children)b.addEventListener('click',()=>{window.__pickMap&&window.__pickMap(b.dataset.v);lobRender()});
    $('lobLaunch').addEventListener('click',()=>{if(!$('lobLaunch').disabled&&window.__startGame)window.__startGame({rich:L.stock==='riche',speed:+L.speed,priv:true})});
    $('copyCode').addEventListener('click',()=>{const c=$('lobCode').textContent,b=$('copyCode');
      const done=()=>{b.textContent='Copié';setTimeout(()=>b.textContent='Copier',1500)};
      try{navigator.clipboard.writeText(c).then(done,()=>{getSelection().selectAllChildren($('lobCode'));b.textContent='Code sélectionné'})}catch(e){getSelection().selectAllChildren($('lobCode'))}});
    $('joinForm').addEventListener('submit',e=>{e.preventDefault();const c=$('joinCode').value.trim().toUpperCase();
      $('joinMsg').textContent=c?`Le jeu en ligne n'est pas encore ouvert : impossible de rejoindre le lobby ${c} pour l'instant.`:'Entre le code que ton ami t\'a envoyé.'});
    lobRender();
  })();
}
