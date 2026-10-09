// La vie de la carte, purement visuelle : vent dans les arbres et l'herbe, eau animée, oiseaux, gabarre sur la Loire.
import * as THREE from 'three';
import { H, MAP, ROCKS, S, W, dist, gh, inBridge, trees, wDist, walkWater } from '@ffl/shared';
import { B, C, K, M, mk, scene, tr } from './engine';

/** horloge partagée par les shaders (vent, vagues) */
export const LIFE_T = { value: 0 };
export const life = new THREE.Group(); scene.add(life);

// ---------------- vent ----------------
/** matériau de l'herbe : les pointes ondulent au vent (attribut « sway » : 0 au pied, 1 à la pointe) */
export const grassMat: any = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0, side: THREE.DoubleSide });
grassMat.onBeforeCompile = sh => {
  sh.uniforms.uTime = LIFE_T;
  sh.vertexShader = 'attribute float sway;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float ph = uTime * 1.9 + position.x * .55 + position.z * .35;
    float gust = .6 + .4 * sin(uTime * .35 + position.x * .05);
    transformed.x += (sin(ph) * .05 + .03) * sway * gust;
    transformed.z += cos(ph * .8) * .025 * sway * gust;`);
};
/** touffes d'herbe disséminées dans les prés (un seul maillage) */
export function buildGrass(r: () => number) {
  const pos: number[] = [], col: number[] = [], sw: number[] = [], c = new THREE.Color();
  const tones = [0x5f9a3c, 0x6fae47, 0x4f8834, 0x7cb553, 0x8aa84a];
  for (let i = 0, n = 0; i < 9000 && n < 2600; i++) {
    const x = r() * W, y = r() * H;
    if (wDist(x, y) < 26 || inBridge(x, y)) continue;
    if (dist(x, y, 300, 780) < 110 || dist(x, y, W - 300, 780) < 110) continue;
    if (x > 260 && x < W - 260 && Math.abs(y - MAP.path(x)) < 22) continue;
    if (ROCKS.some(s => dist(x, y, s.x, s.y) < s.r + 6)) continue;
    n++;
    const gy = gh(x, y), bx = x * S, bz = y * S, blades = 3 + (r() * 3 | 0);
    for (let b = 0; b < blades; b++) {
      const a = r() * Math.PI, w = .025 + r() * .02, h = .11 + r() * .13, ox = (r() - .5) * .12, oz = (r() - .5) * .12;
      const dx = Math.cos(a) * w, dz = Math.sin(a) * w, lean = (r() - .5) * .06;
      pos.push(bx + ox - dx, gy, bz + oz - dz, bx + ox + dx, gy, bz + oz + dz, bx + ox + lean, gy + h, bz + oz + lean * .5);
      sw.push(0, 0, 1);
      c.set(tones[r() * tones.length | 0]); const v = .85 + r() * .25;
      for (let k = 0; k < 2; k++) col.push(c.r * v * .8, c.g * v * .8, c.b * v * .8);
      col.push(Math.min(1, c.r * v * 1.15), Math.min(1, c.g * v * 1.15), Math.min(1, c.b * v * 1.15));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sway', new THREE.Float32BufferAttribute(sw, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, grassMat); m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false;
  return m;
}

// ---------------- eau ----------------
/** matériau de l'eau : petites vagues qui roulent ; les facettes accrochent la lumière */
export const waterMat: any = new THREE.MeshStandardMaterial({ color: 0x4b86ad, roughness: .25, metalness: .15, transparent: true, opacity: .93, flatShading: true });
waterMat.onBeforeCompile = sh => {
  sh.uniforms.uTime = LIFE_T;
  sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    transformed.y += sin(position.x * 1.7 + uTime * 1.3) * .012 + sin(position.z * 2.3 - uTime * 1.1) * .01 + sin((position.x + position.z) * 3.1 + uTime * 2.1) * .006;`);
};
/** reflets qui scintillent et dérivent à la surface */
export const rippleMat: any = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, depthWrite: false });
export let ripples: any = null;
export function setRipples(m) { ripples = m }

// ---------------- oiseaux ----------------
export const BODY = B(.13, .045, .05), WING_R = B(.07, .008, .2).translate(0, 0, .1), WING_L = B(.07, .008, .2).translate(0, 0, -.1);
export const BIRD_MAT = M(0x2b2522);
type Bird = { g: any, wl: any, wr: any, off: number, dx: number, dz: number };
type Flock = { birds: Bird[], vx: number, vz: number, vy: number, t: number, life: number };
export const flocks: Flock[] = [];
export function makeBird(): Bird {
  const g = new THREE.Group(), wl = mk(WING_L, BIRD_MAT), wr = mk(WING_R, BIRD_MAT);
  g.add(mk(BODY, BIRD_MAT)); g.add(wl); g.add(wr);
  return { g, wl, wr, off: Math.random() * 6, dx: 0, dz: 0 };
}
/** un vol d'oiseaux qui traverse la carte en V */
export function spawnFlock() {
  const n = 5 + (Math.random() * 6 | 0), fromLeft = Math.random() < .5, wU = W * S, hU = H * S;
  const x0 = fromLeft ? -3 : wU + 3, z0 = Math.random() * hU, x1 = fromLeft ? wU + 3 : -3, z1 = Math.random() * hU;
  const len = Math.hypot(x1 - x0, z1 - z0), sp = 2.2 + Math.random() * .8, vx = (x1 - x0) / len * sp, vz = (z1 - z0) / len * sp;
  const y = 4.5 + Math.random() * 2, f: Flock = { birds: [], vx, vz, vy: 0, t: 0, life: len / sp + 2 };
  const ang = Math.atan2(vz, vx), px = -Math.sin(ang), pz = Math.cos(ang);
  for (let i = 0; i < n; i++) {
    const b = makeBird(), row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    b.dx = -Math.cos(ang) * row * .45 + px * side * row * .4; b.dz = -Math.sin(ang) * row * .45 + pz * side * row * .4;
    b.g.position.set(x0 + b.dx, y + (Math.random() - .5) * .3, z0 + b.dz); b.g.rotation.y = -ang;
    life.add(b.g); f.birds.push(b);
  }
  flocks.push(f);
}
/** quelques oiseaux s'envolent d'un arbre abattu */
export function birdsTakeOff(x: number, y: number) {
  const n = 2 + (Math.random() * 3 | 0), ang = Math.random() * Math.PI * 2, sp = 2.4;
  const f: Flock = { birds: [], vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp, vy: 1.4, t: 0, life: 9 };
  for (let i = 0; i < n; i++) {
    const b = makeBird(); b.dx = (Math.random() - .5) * .6; b.dz = (Math.random() - .5) * .6;
    b.g.position.set(x * S + b.dx, gh(x, y) + 1.1 + Math.random() * .3, y * S + b.dz); b.g.rotation.y = -ang;
    life.add(b.g); f.birds.push(b);
  }
  flocks.push(f);
}
export function updBirds(dt: number) {
  for (const f of flocks) {
    f.t += dt; const climb = f.vy * Math.max(0, 1 - f.t / 3);
    for (const b of f.birds) {
      b.g.position.x += f.vx * dt; b.g.position.z += f.vz * dt; b.g.position.y += climb * dt;
      const flap = Math.sin(LIFE_T.value * 11 + b.off), glide = Math.sin(LIFE_T.value * .7 + b.off) > .55 ? .15 : 1;
      b.wl.rotation.x = flap * .7 * glide; b.wr.rotation.x = -flap * .7 * glide;
    }
  }
  for (let i = flocks.length - 1; i >= 0; i--) if (flocks[i].t > flocks[i].life) { for (const b of flocks[i].birds) life.remove(b.g); flocks.splice(i, 1) }
}

// ---------------- gabarre ----------------
/** bateau traditionnel de Loire : coque plate, mât, voile carrée, un marinier à la gaffe */
export function makeGabarre() {
  const g = new THREE.Group(), hull = M(0x5a3a1e), deck = M(0x8a6a44), sail = M(0xe9dfc6), rope = M(0x4a3522);
  g.add(mk(B(1.5, .13, .38).translate(0, .065, 0), hull));
  const bow = mk(B(.42, .13, .3).translate(.21, .065, 0), hull); bow.position.x = .72; bow.rotation.z = .35; g.add(bow);
  const st = mk(B(.3, .13, .32).translate(-.15, .065, 0), hull); st.position.x = -.72; st.rotation.z = -.25; g.add(st);
  g.add(mk(B(1.3, .02, .3).translate(0, .135, 0), deck));
  g.add(mk(C(.022, .028, 1.25, 6).translate(.12, .76, 0), rope));
  g.add(mk(B(.025, .62, .66).translate(.14, .86, 0), sail));
  g.add(mk(B(.03, .025, .05).translate(.14, 1.18, .0), rope));
  g.add(mk(C(.012, .012, .74, 4).rotateX(Math.PI / 2).translate(.14, 1.18, 0), rope));
  for (const [x, z] of [[-.25, .06], [-.42, -.06], [.42, .05]]) g.add(mk(C(.075, .075, .14, 8).translate(x, .21, z), M(0x7a5230)));
  g.add(mk(B(.18, .12, .16).translate(-.05, .2, -.04), M(0xb59a76)));
  // le marinier et sa gaffe
  g.add(mk(C(.05, .07, .2, 6).translate(-.6, .24, 0), M(0x6b5a3a)));
  g.add(mk(new THREE.IcosahedronGeometry(.05, 0).translate(-.6, .39, 0), M(0xe0b48a)));
  g.add(mk(K(.08, .06, 6).translate(-.6, .45, 0), M(0xd9b765)));
  g.add(mk(C(.008, .008, .9, 3).rotateZ(.5).translate(-.75, .35, .08), rope));
  return g;
}
export let boat: any = null, boatT = 25 + Math.random() * 20, boatDir = 1, boatX = 0;
export const riverZ = (x: number) => { const s = MAP.south(x); return (s + H) / 2 };
export function updBoat(dt: number) {
  if (!boat) {
    boatT -= dt; if (boatT > 0) return;
    // la Loire doit être assez large sur toute la traversée
    for (let x = 60; x < W; x += 120) if (!walkWater(x, riverZ(x)) || H - MAP.south(x) < 70) { boatT = 120; return }
    boatDir = Math.random() < .5 ? 1 : -1; boatX = boatDir > 0 ? -60 : W + 60;
    boat = makeGabarre(); boat.scale.setScalar(1.5); life.add(boat);
  }
  boatX += boatDir * 16 * dt;
  const z = riverZ(boatX), z2 = riverZ(boatX + boatDir * 20);
  boat.position.set(boatX * S, .02 + Math.sin(LIFE_T.value * 1.4) * .015, z * S);
  boat.rotation.set(Math.sin(LIFE_T.value * 1.1) * .03, -Math.atan2((z2 - z), boatDir * 20), Math.sin(LIFE_T.value * .9) * .02);
  if (boatX < -80 || boatX > W + 80) { life.remove(boat); boat = null; boatT = 90 + Math.random() * 90 }
}

// ---------------- boucle ----------------
export let flockT = 6 + Math.random() * 8;
/** à appeler à chaque image */
export function updateLife(dt: number) {
  LIFE_T.value += dt;
  const t = LIFE_T.value;
  // les arbres se balancent, chacun à son rythme, avec des rafales
  const gust = .7 + .3 * Math.sin(t * .35);
  for (const tr of trees) { const o = tr.obj; if (!o) continue; const ph = t * 1.5 + tr.x * .013 + tr.y * .009;
    o.rotation.z = (Math.sin(ph) * .028 + .012) * gust; o.rotation.x = Math.cos(ph * .8) * .018 * gust }
  if (ripples) { ripples.position.x = Math.sin(t * .25) * .18; ripples.position.z = Math.cos(t * .2) * .06; rippleMat.opacity = .4 + .2 * Math.sin(t * 1.3) }
  flockT -= dt; if (flockT <= 0) { spawnFlock(); flockT = 18 + Math.random() * 25 }
  updBirds(dt); updBoat(dt);
}
/** changement de carte : on retire oiseaux et bateau */
export function resetLife() {
  for (const f of flocks) for (const b of f.birds) life.remove(b.g); flocks.length = 0;
  if (boat) { life.remove(boat); boat = null } boatT = 25 + Math.random() * 20; flockT = 6 + Math.random() * 8;
}
/** pour les tests : faire venir tout de suite un vol d'oiseaux et la gabarre */
export function lifeDebug(force = true, bx?: number) { if (force) { spawnFlock(); boatT = 0 } if (bx !== undefined && boat) boatX = bx; return { boat: !!boat, x: Math.round(boatX), dir: boatDir, t: Math.round(boatT), flocks: flocks.length, birds: flocks.map(f => f.birds[0] && [+f.birds[0].g.position.x.toFixed(1), +f.birds[0].g.position.z.toFixed(1)]) } }
