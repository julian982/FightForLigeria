import { G, IRON, MAP, STONES, W, inBridge, rawWater, trees, wDist } from '@ffl/shared';
import { TEAMC } from './engine';
import { screenToWorld } from './sync';
import { $, view } from '../state';
export const mm=$('mini'),mctx=mm.getContext('2d'),miniBase=document.createElement('canvas');
export function drawMapBase(g,cw,ch,treeList){
  const s=cw/W,img=g.createImageData(cw,ch),d=img.data;
  for(let py=0;py<ch;py++)for(let px=0;px<cw;px++){const x=(px+.5)/s,y=(py+.5)/s,i=(py*cw+px)*4;
    const c=inBridge(x,y)&&rawWater(x,y)?[150,108,64]:rawWater(x,y)?[75,134,173]:wDist(x,y)<30?[205,190,140]:[79,125,53];
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255}
  g.putImageData(img,0,0);
  g.strokeStyle='#8d6e45';g.lineWidth=Math.max(1.5,cw/64);g.beginPath();
  for(let x=300;x<=W-300;x+=40){const y=MAP.path(x);if(rawWater(x,y)&&!inBridge(x,y)){g.stroke();g.beginPath();continue}g.lineTo(x*s,y*s)}g.stroke();
  g.fillStyle='#e0d6bb';for(const st of STONES){g.beginPath();g.arc(st.x*s,st.y*s,st.r*s,0,7);g.fill()}
  g.fillStyle='#b8622e';g.beginPath();g.arc(IRON.x*s,IRON.y*s,IRON.r*s,0,7);g.fill();
  if(treeList){g.fillStyle='#24421d';const z=Math.max(1.5,cw/110);for(const t of treeList)g.fillRect(t.x*s-z/2,t.y*s-z/2,z,z);
    g.fillStyle='#e3d6b5';g.strokeStyle='#3a2f22';g.lineWidth=1;for(const kx of [300,W-300]){g.fillRect(kx*s-4,780*s-4,8,8);g.strokeRect(kx*s-4,780*s-4,8,8)}}
}
export function makeMiniBase(){miniBase.width=192;miniBase.height=128;drawMapBase(miniBase.getContext('2d'),192,128,null)}
export function renderMini(){
  const s=192/W;mctx.drawImage(miniBase,0,0);
  mctx.fillStyle='#24421d';for(const t of trees)mctx.fillRect(t.x*s-1,t.y*s-1,2,2);
  for(const b of G.buildings){mctx.fillStyle=TEAMC[b.team].m;mctx.fillRect(b.bx*s,b.by*s,Math.max(2,b.bw*s),Math.max(2,b.bh*s))}
  for(const u of G.units){if(u.dead)continue;const lord=u.type==='lord',z=lord?4:2;mctx.fillStyle=lord?'#ffe08a':(u.team?'#ffb9ad':'#b6cbff');mctx.fillRect(u.x*s-z/2,u.y*s-z/2,z,z)}
  const top=$('hudTop').offsetHeight,bot=view.VH-$('hudBot').offsetHeight;
  const q=[[0,top],[view.VW,top],[view.VW,bot],[0,bot]].map(([x,y])=>screenToWorld(x,y));
  mctx.strokeStyle='rgba(255,255,255,.85)';mctx.lineWidth=1;mctx.beginPath();q.forEach((p,i)=>i?mctx.lineTo(p.x*s,p.y*s):mctx.moveTo(p.x*s,p.y*s));mctx.closePath();mctx.stroke();
}
