// Le moteur 3D : rendu WebGL, caméra isométrique, lumières, textures et aides géométrie.
import * as THREE from 'three';
import { rng } from '@ffl/shared';
import { $, view } from '../state';

export const cv=$('game'), ov=$('ov'), octx:CanvasRenderingContext2D=ov.getContext('2d');
// sans WebGL, on garde un moteur factice : l'accueil reste utilisable et affiche un message
export let glOk=true,renderer:any;
try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}
catch(e){glOk=false;renderer={shadowMap:{},setPixelRatio(){},setSize(){},render(){}}}
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
export const scene=new THREE.Scene();
export const camera=new THREE.OrthographicCamera(-10,10,10,-10,1,500);
export const ISO=new THREE.Vector3(1,1,1).normalize().multiplyScalar(150);
// caméra rotative autour du seigneur : A/E (Q/E en QWERTY) ou clic molette glissé
export const CAM_R=Math.hypot(ISO.x,ISO.z),CAM_Y=ISO.y;
scene.add(new THREE.HemisphereLight(0xdcecff,0x6b5a3a,.72));
export const sun=new THREE.DirectionalLight(0xfff0d2,.95);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:140});
sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;
scene.add(sun);scene.add(sun.target);
export const SUN_OFF=new THREE.Vector3(-22,46,12);
export const world=new THREE.Group(), dyn=new THREE.Group();scene.add(world);scene.add(dyn);
export function resize(){view.DPR=Math.min(2,window.devicePixelRatio||1);view.VW=innerWidth;view.VH=innerHeight;renderer.setPixelRatio(view.DPR);renderer.setSize(view.VW,view.VH,false);ov.width=Math.round(view.VW*view.DPR);ov.height=Math.round(view.VH*view.DPR)}
addEventListener('resize',resize);resize();

// ---- Textures procédurales ----
export function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
export const tr=rng(99);
export const TEX:Record<string,any>={
  stone:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#b3a688';g.fillRect(0,0,w,h);const rh=16;for(let r=0;r<8;r++){const off=(r%2)*16;for(let x=-32+off;x<w;x+=32){const v=212+tr()*32|0;g.fillStyle=`rgb(${v},${v-10},${v-38})`;g.fillRect(x+2,r*rh+2,28,rh-4);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x+2,r*rh+2,28,3)}}}),
  timber:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#e6dcc4';g.fillRect(0,0,w,h);for(let i=0;i<60;i++){g.fillStyle=`rgba(150,130,100,${tr()*.15})`;g.fillRect(tr()*w,tr()*h,6+tr()*14,3+tr()*6)}g.fillStyle='#4a3121';g.fillRect(0,0,w,10);g.fillRect(0,h-10,w,10);g.fillRect(0,0,10,h);g.fillRect(w-10,0,10,h);g.fillRect(w/2-5,0,10,h);g.lineWidth=9;g.strokeStyle='#4a3121';g.beginPath();g.moveTo(10,h-10);g.lineTo(w/2-5,10);g.moveTo(w-10,h-10);g.lineTo(w/2+5,10);g.stroke()}),
  tile:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#7a2e1c';g.fillRect(0,0,w,h);for(let r=0;r<8;r++){const off=(r%2)*8;for(let x=-16+off;x<w;x+=16){const v=tr()*30|0;g.fillStyle=`rgb(${170+v},${70+(v/2|0)},45)`;g.beginPath();g.moveTo(x+1,r*16);g.lineTo(x+15,r*16);g.lineTo(x+15,r*16+11);g.quadraticCurveTo(x+8,r*16+16,x+1,r*16+11);g.closePath();g.fill()}}}),
  thatch:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#a8823f';g.fillRect(0,0,w,h);for(let i=0;i<500;i++){const x=tr()*w,y=tr()*h,v=tr()*50|0;g.strokeStyle=`rgb(${190+(v/2|0)},${150+(v/2|0)},${70+(v/3|0)})`;g.lineWidth=1.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+(tr()-.5)*3,y+10+tr()*8);g.stroke()}g.fillStyle='rgba(80,55,20,.35)';for(let r=0;r<4;r++)g.fillRect(0,r*32+28,w,4)}),
  slate:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#2f363d';g.fillRect(0,0,w,h);for(let r=0;r<8;r++){const off=(r%2)*10;for(let x=-20+off;x<w;x+=20){const v=tr()*25|0;g.fillStyle=`rgb(${80+v},${92+v},${104+v})`;g.fillRect(x+1,r*16+1,18,13)}}}),
  planks:canvasTex(128,128,(g,w,h)=>{for(let i=0;i<8;i++){const v=tr()*30|0;g.fillStyle=`rgb(${120+v},${82+(v/2|0)},48)`;g.fillRect(i*16,0,16,h);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(i*16,0,2,h);g.fillStyle='rgba(0,0,0,.15)';g.fillRect(i*16+6,tr()*h,2,20)}}),
  soil:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#6a4a2a';g.fillRect(0,0,w,h);for(let r=0;r<8;r++){g.fillStyle='#57391f';g.fillRect(0,r*16+10,w,5)}}),
};
export const matCache:Record<string,any>={};
export function M(color,opt?){const k=color+(opt?JSON.stringify(opt):'');return matCache[k]||(matCache[k]=new THREE.MeshStandardMaterial(Object.assign({color,flatShading:true,roughness:.92,metalness:0},opt||{})))}
export function TM(name,rx,ry,color=0xffffff){const k='t'+name+rx+'x'+ry+'c'+color;if(matCache[k])return matCache[k];const t=TEX[name].clone();t.needsUpdate=true;t.repeat.set(rx,ry);return matCache[k]=new THREE.MeshStandardMaterial({map:t,color,flatShading:true,roughness:.95,metalness:0})}
export const VC=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,metalness:0});
export const VCF=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9,metalness:0,emissive:0xaa3322});

// ---- Aides géométrie ----
export function mk(geo,mat,x=0,y=0,z=0):any{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
export function boxM(w,h,d,mat,x=0,y=0,z=0):any{return mk(new THREE.BoxGeometry(w,h,d),mat,x,y+h/2,z)}
export function cylM(rt,rb,h,seg,mat,x=0,y=0,z=0):any{return mk(new THREE.CylinderGeometry(rt,rb,h,seg),mat,x,y+h/2,z)}
export function gableGeo(w,len,h){const g=new THREE.CylinderGeometry(1,1,1,3,1);g.rotateX(-Math.PI/2);const sx=w/1.732,sy=h/1.5;g.scale(sx,sy,len);g.translate(0,.5*sy,0);return g}
export function merge(parts){
  const pos=[],nor=[],col=[],c=new THREE.Color();
  for(const [geo,color] of parts){const g=geo.index?geo.toNonIndexed():geo;const p=g.attributes.position.array,n=g.attributes.normal.array;c.set(color);
    for(let i=0;i<p.length;i+=3){pos.push(p[i],p[i+1],p[i+2]);nor.push(n[i],n[i+1],n[i+2]);col.push(c.r,c.g,c.b)}}
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  out.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  return out;
}
export const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d), C=(rt,rb,h,s,o?)=>new THREE.CylinderGeometry(rt,rb,h,s,1,!!o), K=(r,h,s)=>new THREE.ConeGeometry(r,h,s), I=r=>new THREE.IcosahedronGeometry(r,0);

// couleurs des deux royaumes (remplacées par la couleur choisie à chaque partie)
export const TEAMC=[{m:'#3f6fd8',hex:0x3f6fd8,dark:0x1f3c86,light:0xb6cbff},{m:'#c9402e',hex:0xc9402e,dark:0x6e1f15,light:0xffb9ad}];
export function teamColor(css){const c=new THREE.Color(css),d=c.clone().multiplyScalar(.5),l=c.clone().lerp(new THREE.Color(0xffffff),.6);return{m:css,hex:c.getHex(),dark:d.getHex(),light:l.getHex()}}
export const camT=new THREE.Vector3(7.5,0,19.5);
