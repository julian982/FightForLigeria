// Les insignes de rang (Bois, Pierre, Fer, Argent, Or, Rubis ; trois divisions chacun), en SVG (viewBox 100 × 120).
import { ELO } from '@ffl/shared';

export const RANKS=[
  {n:'Bois',  a:'#9a6a3c',b:'#5e3d20',e:'#3b2614',k:'grain'},
  {n:'Pierre',a:'#b3aea3',b:'#7a766d',e:'#4c4943',k:'blocks'},
  {n:'Fer',   a:'#6e747c',b:'#3c4047',e:'#24272b',k:'rivets'},
  {n:'Argent',a:'#eef1f4',b:'#a9b0b8',e:'#6f7780',k:'filigree'},
  {n:'Or',    a:'#ffe08a',b:'#d39b2a',e:'#8a5d12',k:'filigree'},
  {n:'Rubis', a:'#ffe08a',b:'#d39b2a',e:'#8a5d12',k:'gem'},
];
export const DIV=['III','II','I'];
export const lo=(i:number)=>i===0?null:800+100*i;
export const hi=(i:number)=>i===17?null:899+100*i;
export const range=(i:number)=>lo(i)==null?'< 900':hi(i)==null?lo(i)+' +':lo(i)+'–'+hi(i);
let uid=0;
/** insigne du rang `rank` (0 à 5), division `div` (0 = III … 2 = I), ou « ? » pour un joueur pas encore placé */
export function shield(rank:number,div:number,unknown=false){
  const id='rk'+(uid++),r=RANKS[rank]||RANKS[0];
  const path='M50 4 L92 16 L92 56 C92 86 72 104 50 116 C28 104 8 86 8 56 L8 16 Z';
  if(unknown)return `<path d="${path}" fill="none" stroke="#6b5b45" stroke-width="4" stroke-dasharray="7 6"/><text x="50" y="72" text-anchor="middle" font-family="Grenze Gotisch, Georgia, serif" font-size="44" fill="#8a7a62">?</text>`;
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
/** insigne complet pour un Elo : `placed` faux = pas encore classé (« ? ») */
export function badgeSvg(elo:number,placed=true,cls=''){
  const t=ELO.tier(elo);
  return `<svg class="${cls}" viewBox="0 0 100 120" aria-hidden="true">${shield((t/3)|0,t%3,!placed)}</svg>`;
}
