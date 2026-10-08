import { DEF, G, RESN, T, afford, canPlace, missing } from '@ffl/shared';
import { TEAMC, octx } from './engine';
import { ghostTile, toScreen } from './sync';
import { mouse, ui, view } from '../state';
export function bar(x,y,w,frac,col){octx.fillStyle='rgba(0,0,0,.6)';octx.fillRect(x-w/2-1,y-1,w+2,5);octx.fillStyle=col;octx.fillRect(x-w/2,y,w*Math.max(0,frac),3)}
// icône « bâtiment à l'arrêt » : ouvrier barré + compte à rebours
export function idleBadge(x,y,sec,z){
  const r=13*Math.max(.8,Math.min(1.3,z));
  octx.save();octx.translate(x,y-r);
  octx.fillStyle='rgba(28,20,16,.9)';octx.beginPath();octx.arc(0,0,r,0,Math.PI*2);octx.fill();
  octx.lineWidth=2;octx.strokeStyle='#e3634f';octx.stroke();
  octx.fillStyle='#efe7d6';octx.beginPath();octx.arc(0,-r*.28,r*.26,0,Math.PI*2);octx.fill();
  octx.beginPath();octx.ellipse(0,r*.42,r*.46,r*.32,0,Math.PI,0);octx.fill();
  octx.strokeStyle='#e3634f';octx.lineWidth=2.4;octx.beginPath();octx.moveTo(-r*.62,-r*.62);octx.lineTo(r*.62,r*.62);octx.stroke();
  octx.font='800 12px "Alegreya Sans", sans-serif';octx.textAlign='center';octx.lineWidth=3;octx.strokeStyle='rgba(0,0,0,.7)';octx.fillStyle='#ffb3a6';
  octx.strokeText(sec+' s',0,r+13);octx.fillText(sec+' s',0,r+13);
  octx.restore();
}
export function drawOverlay(){
  octx.setTransform(view.DPR,0,0,view.DPR,0,0);octx.clearRect(0,0,view.VW,view.VH);
  if(!ui.running&&!G.over)return;
  const z=view.ppu/46;
  for(const u of G.units){if(u.dead)continue;const lord=u.type==='lord';if(!lord&&u.hp>=u.maxhp)continue;
    const p=toScreen(u.x,u.y,lord?1.35:1.05);if(!lord||u.team===0)bar(p.x,p.y,(lord?38:22)*z,u.hp/u.maxhp,TEAMC[u.team].m);
    if(lord&&u.charge>0){const q=toScreen(u.x,u.y,.5);octx.strokeStyle=u.charge>=1?'#ffe08a':'#e3b54e';octx.lineWidth=3;octx.beginPath();octx.arc(q.x,q.y,22*z,-Math.PI/2,-Math.PI/2+u.charge*Math.PI*2);octx.stroke()}}
  for(const w of G.workers)if(w.hp<w.maxhp){const p=toScreen(w.x,w.y,.95);bar(p.x,p.y,16*z,w.hp/w.maxhp,TEAMC[w.team].m)}
  octx.font='700 13px "Alegreya Sans", sans-serif';octx.textAlign='center';octx.lineWidth=3;octx.strokeStyle='rgba(0,0,0,.65)';
  for(const b of G.buildings){
    if(b.hp<b.maxhp){const p=toScreen(b.x,b.y,b.type==='caserne'?2:1.7);bar(p.x,p.y,50*z,b.hp/b.maxhp,TEAMC[b.team].m)}
    const w=b.worker;if(b.team===0&&w&&!w.dead&&((w.state==='working'&&w.need)||w.idle||w.noStore)){const p=toScreen(b.x,b.y,1.9);const s=w.noStore?(w.noStore==='grenier'?'Pas de grenier':'Pas de réserve'):w.idle?'Plus d\'arbres':'Manque de '+Object.keys(DEF[b.type].input).filter(k=>G.teams[0].res[k]<DEF[b.type].input[k]).map(k=>RESN[k]).join(' et ');octx.fillStyle='#ffd98a';octx.strokeText(s,p.x,p.y-8);octx.fillText(s,p.x,p.y-8)}
  }
  for(const b of G.buildings)if(b.team===0&&b.respawn!=null&&!b.dead){const p=toScreen(b.x,b.y,2.1);idleBadge(p.x,p.y,Math.ceil(b.respawn),z)}
  octx.font='800 16px "Alegreya Sans", sans-serif';
  for(const f of G.fx)if(f.k==='num'){const p=toScreen(f.x,f.y,f.h),q=f.t/f.life;octx.globalAlpha=1-q;octx.fillStyle='#fff1c9';octx.strokeText(f.v,p.x,p.y-q*24);octx.fillText(f.v,p.x,p.y-q*24);octx.globalAlpha=1}
  if(ui.placing&&ui.running){const d=DEF[ui.placing],g=ghostTile(),err=canPlace(0,ui.placing,g.tx,g.ty),tm=G.teams[0],ok=!err&&afford(tm,ui.placing);
    const s=err||(!afford(tm,ui.placing)?'Il manque '+missing(tm,ui.placing):d.name),p=toScreen((g.tx+d.w/2)*T,(g.ty+d.h/2)*T,1.3);
    octx.font='700 14px "Alegreya Sans", sans-serif';octx.fillStyle=ok?'#e9ffd9':'#ffb3a6';octx.strokeText(s,p.x,p.y);octx.fillText(s,p.x,p.y)}
  if(ui.box){const x=Math.min(ui.box.sx,mouse.sx),y=Math.min(ui.box.sy,mouse.sy),w=Math.abs(mouse.sx-ui.box.sx),h=Math.abs(mouse.sy-ui.box.sy);
    octx.fillStyle='rgba(255,233,168,.1)';octx.fillRect(x,y,w,h);octx.strokeStyle='rgba(255,233,168,.85)';octx.lineWidth=1;octx.setLineDash([4,4]);octx.strokeRect(x+.5,y+.5,w,h);octx.setLineDash([])}
}
