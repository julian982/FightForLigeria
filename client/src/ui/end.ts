// L'écran de fin : bilan détaillé et courbes de la partie.
import { G, MAP, T } from '@ffl/shared';
import { TEAMC, tr } from '../render/engine';
import { exitFps } from '../render/fps';
import { $, ME, keys, ui } from '../state';
import { refreshHud } from './hud';
export function endGame(winner){
  const win=winner===ME;exitFps();ui.running=false;ui.placing=null;ui.box=null;
  const m=Math.floor(G.t/60),s=String(Math.floor(G.t%60)).padStart(2,'0');
  $('endTitle').textContent=win?'Victoire':'Défaite';
  $('endText').textContent=(win?'Le seigneur ennemi est tombé. ':'Ton seigneur est tombé. ')+`Partie de ${m} min ${s} s sur ${MAP.name}.`;
  $('endStats').innerHTML=statsHtml();
  for(const b of (Array.from(document.querySelectorAll('#resTabs button')) as any[]))b.addEventListener('click',()=>showResChart(b.dataset.r));
  showResChart('total');
  refreshHud();setTimeout(()=>{$('end').hidden=false;$('again').focus()},900);
}
// ---- statistiques de fin de partie ----
export function statsHtml(){
  const A=G.st[0],E=G.st[1],pct=s=>s.shot?Math.round(s.hit/s.shot*100)+' %':'—',cases=v=>v?(v/T).toFixed(1).replace('.',',')+' cases':'—';
  const mmss=v=>{v=Math.round(v);return v?Math.floor(v/60)+' min '+String(v%60).padStart(2,'0')+' s':'—'};
  // better : 1 = plus haut gagne, -1 = plus bas gagne, 0 = neutre
  const row=(label,a,e,better=1,fmt=v=>v)=>{
    const wa=better&&a!==e&&(better>0?a>e:a<e),we=better&&a!==e&&!wa;
    return `<tr><th scope="row">${label}</th><td class="${wa?'best':''}">${fmt(a)}</td><td class="${we?'best':''}">${fmt(e)}</td></tr>`};
  const head=`<thead><tr><th></th><th><i style="background:${TEAMC[0].m}"></i>Toi</th><th><i style="background:${TEAMC[1].m}"></i>Ennemi</th></tr></thead>`;
  const sec=(title,rows,cls='')=>`<section class="es ${cls}"><h3>${title}</h3><table>${head}<tbody>${rows}</tbody></table></section>`;
  const combat=row('Soldats ennemis tués',A.killS,E.killS)+row('Ouvriers ennemis tués',A.killW,E.killW)+row('Soldats perdus',A.lostS,E.lostS,-1)+row('Ouvriers perdus',A.lostW,E.lostW,-1)+row('Soldats recrutés',A.recruits,E.recruits);
  const lord=row('Flèches tirées',A.shot,E.shot,0)+row('Flèches touchées',A.hit,E.hit)+`<tr><th scope="row">Précision</th><td class="${A.shot&&E.shot&&A.hit/A.shot>E.hit/E.shot?'best':''}">${pct(A)}</td><td class="${A.shot&&E.shot&&E.hit/E.shot>A.hit/A.shot?'best':''}">${pct(E)}</td></tr>`+row('Dégâts infligés',A.dmg,E.dmg)+row('Plus long tir réussi',A.longest,E.longest,1,cases);
  const bld=row('Bâtiments construits',A.built,E.built)+row('Bâtiments perdus',A.lostB,E.lostB,-1)+row('Bâtiments ennemis rasés',A.razed,E.razed);
  const P=[['bois','Bois'],['pierre','Pierre'],['ble','Blé'],['fer','Fer'],['arc','Arcs'],['lance','Lances'],['epee','Épées'],['fleche','Flèches']];
  const res=P.map(([k,l])=>row(l,A.prod[k],E.prod[k])).join('')+row('Temps de famine',A.starve,E.starve,-1,mmss);
  return sec('Combat',combat)+sec('Ton seigneur et le sien',lord)+sec('Bâtiments',bld)+sec('Ressources produites',res)+`<section class="es wide"><h3>Armée au fil de la partie</h3>${armyChart(A.army,E.army)}</section>`+
    `<section class="es wide"><div class="es-head"><h3>Ressources produites au fil de la partie</h3><div class="seg" id="resTabs">${Object.entries(RES_CHART).map(([k,[l]])=>`<button type="button" data-r="${k}" aria-pressed="false">${l}</button>`).join('')}</div></div><div id="resChart"></div></section>`;
}
export const RES_CHART:Record<string,[string,string[]|null]>={total:['Total',null],bois:['Bois',['bois']],pierre:['Pierre',['pierre']],ble:['Blé',['ble']],fer:['Fer',['fer']]};
export function showResChart(k){
  const keys=RES_CHART[k][1]||['bois','pierre','ble','fer'],sum=h=>keys.reduce((t,r)=>t+(h[r]||0),0);
  const a=G.st[0].resH.map(sum),e=G.st[1].resH.map(sum);
  $('resChart').innerHTML=lineChart(a,e,'Ressources produites ('+RES_CHART[k][0].toLowerCase()+') cumulées, toutes les 10 secondes');
  for(const b of (Array.from(document.querySelectorAll('#resTabs button')) as any[]))b.setAttribute('aria-pressed',b.dataset.r===k);
}
export function armyChart(a,e){return lineChart(a,e,'Taille des deux armées toutes les 10 secondes')}
export function lineChart(a,e,label){
  const n=Math.max(a.length,e.length,2),raw=Math.max(4,...a,...e),mx=raw>20?Math.ceil(raw/10)*10:raw,W_=600,H_=130,L=34,Rr=8,Tp=10,Bt=22;
  const X=i=>L+(W_-L-Rr)*i/(n-1),Y=v=>Tp+(H_-Tp-Bt)*(1-v/mx);
  const line=(arr,c)=>arr.length?`<polyline fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" points="${arr.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/><circle cx="${X(arr.length-1)}" cy="${Y(arr[arr.length-1])}" r="3.5" fill="${c}"/>`:'';
  const mins=Math.round(G.t/60);
  return `<svg viewBox="0 0 ${W_} ${H_}" role="img" aria-label="${label}">
    <g stroke="rgba(239,231,214,.12)">${[0,.5,1].map(f=>`<line x1="${L}" x2="${W_-Rr}" y1="${Y(mx*f)}" y2="${Y(mx*f)}"/>`).join('')}</g>
    <g fill="#a99d87" font-size="11" font-family="Alegreya Sans, sans-serif">${[0,Math.round(mx/2),mx].map(v=>`<text x="${L-6}" y="${Y(v)+4}" text-anchor="end">${v}</text>`).join('')}
      <text x="${L}" y="${H_-6}">0 min</text><text x="${W_-Rr}" y="${H_-6}" text-anchor="end">${mins} min</text></g>
    ${line(e,TEAMC[1].m)}${line(a,TEAMC[0].m)}</svg>`;
}
