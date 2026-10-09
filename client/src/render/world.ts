// Le décor d'une carte : sol, rivières, ponts, vignes, gisements, territoires.
// ---- Sol, bordure, gisements, décor ----
import * as THREE from 'three';
import { BRIDGE_Y, GH, GW, GXV, H, IRON, MAP, ROCKS, S, STONES, T, TERR, W, dist, gh, hgrid, inBridge, rng, wDist, walkWater } from '@ffl/shared';
import { B, I, M, TEAMC, TM, VC, boxM, cylM, merge, mk, world } from './engine';
import { buildGrass, resetLife, rippleMat, setRipples, waterMat } from './life';
export const terrRing=[];
export let groundMesh:any=null;
/** pose une géométrie sur le relief */
export function drape(geo,lift=0){const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+gh(p.getX(i)*T,p.getZ(i)*T)+lift);p.needsUpdate=true;geo.computeVertexNormals();return geo}
export function buildWorld(){
  const r=rng(MAP.seed);
  const pg=new THREE.PlaneGeometry(GW,GH,GW*2,GH*2);pg.rotateX(-Math.PI/2);pg.translate(GW/2,0,GH/2);
  const pa=pg.attributes.position;for(let i=0;i<pa.count;i++){const ix=Math.round(pa.getX(i)*2),iz=Math.round(pa.getZ(i)*2);pa.setY(i,hgrid[iz*GXV+ix])}
  const g=pg.toNonIndexed();g.computeVertexNormals();
  const p=g.attributes.position.array,col=[],c=new THREE.Color(),grass=MAP.grass;
  for(let i=0;i<p.length;i+=9){
    const cx=(p[i]+p[i+3]+p[i+6])/3*T,cz=(p[i+2]+p[i+5]+p[i+8])/3*T,cy=(p[i+1]+p[i+4]+p[i+7])/3;
    let hex=grass[r()*grass.length|0];
    if(cx>260&&cx<W-260&&Math.abs(cz-MAP.path(cx))<24)hex=r()<.5?0x9b7a4e:0x8d6e45;
    for(const s of STONES){const d=dist(cx,cz,s.x,s.y);if(d<s.r*1.05)hex=r()<.5?0xcfc3a3:0xc2b695;else if(d<s.r*1.3&&r()<.5)hex=0x7d8a5e}
    {const d=dist(cx,cz,IRON.x,IRON.y);if(d<IRON.r*1.05)hex=r()<.5?0x5e4a40:0x6b4f3e;else if(d<IRON.r*1.35&&r()<.5)hex=0x7a6a48}
    for(const kx of [300,W-300]){if(dist(cx,cz,kx,780)<95)hex=r()<.5?0x8f7a58:0x857050}
    if(cy<-.05)hex=0x55664c;else if(wDist(cx,cz)<34)hex=r()<.5?0xd9c99a:0xcdbb8a;
    c.set(hex);const v=.94+r()*.1;
    for(let k=0;k<3;k++)col.push(c.r*v,c.g*v,c.b*v);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  const ground=new THREE.Mesh(g,VC);ground.receiveShadow=true;world.add(ground);groundMesh=ground;
  // rivières : une nappe d'eau, des reflets, des bancs de sable
  {const wp=new THREE.PlaneGeometry(GW,GH,GW*2,GH*2);wp.rotateX(-Math.PI/2);wp.translate(GW/2,0,GH/2);
    const water=new THREE.Mesh(wp,waterMat);
    water.receiveShadow=true;world.add(water);
    const rip=[];for(let i=0;i<500&&rip.length<90;i++){const x=r()*W,y=r()*H;if(walkWater(x,y)&&wDist(x+30,y)===0&&wDist(x-30,y)===0)rip.push([B(.3+r()*.6,.01,.035).translate(x*S,.02,y*S),0x9cc7e0])}
    if(rip.length){const rm=new THREE.Mesh(merge(rip),rippleMat);world.add(rm);setRipples(rm)}
    for(const [x,y,l] of MAP.sand){const sb=new THREE.DodecahedronGeometry(.5,0);sb.scale(l,.12,1);world.add(mk(sb,M(0xe3d3a0),x*S,.06,y*S))}
  }
  // ponts de tuffeau au tablier de bois
  for(const b of MAP.bridges){const cx=(b.x+b.w/2)*S,cz=(b.y+b.h/2)*S,w=b.w*S,d=b.h*S;
    world.add(boxM(w+.2,.09,d,TM('planks',5,1),cx,BRIDGE_Y-.09,cz));
    for(const sd of [-1,1]){world.add(boxM(w+.2,.18,.1,TM('stone',4,1),cx,BRIDGE_Y,cz+sd*(d/2-.05)));
      for(const t of [-.5,0,.5])world.add(boxM(.14,.08,.14,M(0xd9ceb3),cx+t*w,BRIDGE_Y+.18,cz+sd*(d/2-.05)))}
    for(const t of [-.25,.25])world.add(cylM(.16,.2,.45,7,TM('stone',1,1),cx+t*w,-.4,cz));
  }
  // vignes de Touraine
  if(MAP.vines.length){const v=[];for(const [vx,vy] of MAP.vines)for(let row=0;row<5;row++)for(let i=0;i<9;i++){const x=vx-130+i*32,y=vy-40+row*20;
      v.push([B(.02,.22,.02).translate(x*S,.11,y*S),0x6b4a28],[I(.075).translate(x*S,.22,y*S),r()<.5?0x4e7f34:0x5f8f3e]);if(r()<.25)v.push([I(.03).translate(x*S+.05,.18,y*S),0x5a2a5a])}
    const vm=mk(drape(merge(v)),VC);vm.castShadow=false;world.add(vm);}
  // bordure de diorama
  world.add(mk(B(GW,1.4,GH),M(0x6b4b2e),GW/2,-.8,GH/2));
  world.add(mk(B(GW+.6,2.2,GH+.6),M(0x5b5850),GW/2,-2.5,GH/2));
  // gisements de pierre
  for(const s of STONES){
    const parts=[];
    for(let i=0;i<24;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*(s.r-12)*S,k=.15+r()*.28;
      const geo=new THREE.DodecahedronGeometry(k,0);geo.scale(1,.55+r()*.5,1);geo.rotateY(r()*3);geo.translate(s.x*S+Math.cos(a)*d,k*.3,s.y*S+Math.sin(a)*d);
      parts.push([geo,[0xe6dcc4,0xd8cdb2,0xefe7d3,0xc9bea2][r()*4|0]])}
    world.add(mk(drape(merge(parts)),VC));
  }
  {const parts=[],s=IRON;
    for(let i=0;i<26;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*(s.r-12)*S,k=.14+r()*.3;
      const geo=new THREE.DodecahedronGeometry(k,0);geo.scale(1,.6+r()*.6,1);geo.rotateY(r()*3);geo.translate(s.x*S+Math.cos(a)*d,k*.3,s.y*S+Math.sin(a)*d);
      parts.push([geo,[0x4a403c,0x5a4a44,0x3b3532,0x8c4f2c,0x6e3f26][r()*5|0]])}
    for(let i=0;i<10;i++){const a=r()*Math.PI*2,d=Math.sqrt(r())*(s.r-20)*S,k=.06+r()*.05;
      parts.push([I(k).translate(s.x*S+Math.cos(a)*d,.32+r()*.1,s.y*S+Math.sin(a)*d),0xc8642c])}
    world.add(mk(drape(merge(parts)),VC));
  }
  // décor : buissons, cailloux, fleurs (hors territoires)
  const deco=[];
  for(let i=0;i<420;i++){
    const x=r()*W,y=r()*H;
    if(dist(x,y,300,780)<TERR+20||dist(x,y,W-300,780)<TERR+20)continue;
    if(x>260&&x<W-260&&Math.abs(y-MAP.path(x))<40)continue;
    if(ROCKS.some(s=>dist(x,y,s.x,s.y)<s.r+20))continue;
    if(wDist(x,y)<30||inBridge(x,y))continue;
    const k=r();
    if(k<.45){const s=.14+r()*.16;deco.push([I(s).translate(x*S,s*.6,y*S),[0x4e7f34,0x5b8c3b,0x456f2e][r()*3|0]]);if(r()<.5)deco.push([I(s*.7).translate(x*S+s,s*.4,y*S+s*.4),0x6a9a42])}
    else if(k<.75){const s=.07+r()*.08;deco.push([new THREE.DodecahedronGeometry(s,0).translate(x*S,s*.3,y*S),0x9a968c])}
    else{for(let j=0;j<3;j++)deco.push([B(.06,.06,.06).translate(x*S+(r()-.5)*.3,.08,y*S+(r()-.5)*.3),[0xf2e27a,0xe8e3d6,0xd47ab0][r()*3|0]])}
  }
  const dm=mk(drape(merge(deco)),VC);dm.castShadow=false;world.add(dm);
  // herbe qui ondule au vent
  world.add(buildGrass(r));
  // cercles de territoire
  for(const [id,kx] of [[0,300],[1,W-300]]){
    const rg=new THREE.RingGeometry(TERR*S-.07,TERR*S,160);rg.rotateX(-Math.PI/2);rg.translate(kx*S,0,780*S);drape(rg,.1);
    const m=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({color:TEAMC[id].light,transparent:true,opacity:.22,depthWrite:false}));
    world.add(m);terrRing[id]=m;
  }
}

/** reconstruit tout le décor pour la carte chargée */
export function rebuildWorld(){
  while(world.children.length){const o=world.children[world.children.length-1];world.remove(o);o.traverse((n:any)=>{if(n.geometry)n.geometry.dispose()})}
  resetLife();buildWorld();
}
