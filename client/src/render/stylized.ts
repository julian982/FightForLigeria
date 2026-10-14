// Bâtiments en low poly stylisé : volumes trapus aux arêtes chanfreinées, pierres posées une à une, toits épais.
// Chaque bâtiment est assemblé à partir de petites pièces puis fusionné en un seul maillage (couleurs par sommet) :
// un objet pour le bâti, un pour ce qui brille (fenêtres éclairées, flammes), un par drapeau (qui flotte au vent).
import * as THREE from 'three';
import { TEAMC, VC, merge, mk } from './engine';

const V3 = THREE.Vector3, ONE = new V3(1, 1, 1);
const GLOW = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, metalness: 0, emissive: 0xffa53a, emissiveIntensity: .75 });

// ---- palette ----
export const P = {
  stoneL: 0xd2c9b6, stoneL2: 0xc4baa5, stoneM: 0xa99f8a, stoneD: 0x8a8173, stoneDD: 0x6c655b,
  // tuffeau : la pierre blanche de Touraine
  tufL: 0xf0e8d2, tuf: 0xe4d9bd, tufM: 0xd5c7a4, tufD: 0xbfae88,
  woodL: 0xb7814f, woodM: 0x8f5d35, woodD: 0x66432a, woodDD: 0x4a301e, woodEnd: 0xd8aa74,
  iron: 0x3a3c43, steel: 0xc9ced4, gold: 0xf0c050, dark: 0x251c16,
  dirt: 0x8c6c45, dirtL: 0xa98b5e, gravel: 0xcabd9c, grass: 0x6a9a3b,
  shingle: 0x96533a, shingleL: 0xa65e3f, shingleD: 0x6f3a26,
  slate: 0x4f5a68, slateL: 0x5f6b7a, slateD: 0x3a424d,
  window: 0xffc56a, flame: 0xffb03a, straw: 0xd9b765, cloth: 0xd8c08a,
  wood: 0x8f5d35, leatherD: 0x553820, white: 0xf2ece0,
};

// ---- formes de base ----
/** boîte aux arêtes chanfreinées, posée sur y = 0 */
export function cbox(w: number, h: number, d: number, b?: number) {
  b = Math.min(b === undefined ? Math.min(w, h, d) * .16 : b, w / 2.2, h / 2.2, d / 2.2);
  const hw = w / 2 - b, hh = h / 2 - b, s = new THREE.Shape();
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.lineTo(-hw, -hh);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.002, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1 });
  g.center(); g.translate(0, h / 2, 0); return g;
}
export const cyl = (rt: number, rb: number, h: number, n = 8) => { const g = new THREE.CylinderGeometry(rt, rb, h, n); g.translate(0, h / 2, 0); return g };
export const cone = (r: number, h: number, n = 8) => { const g = new THREE.ConeGeometry(r, h, n); g.translate(0, h / 2, 0); return g };
/** arc plein cintre (porte, fenêtre) dans le plan XY, épaisseur d */
export function arch(w: number, h: number, d: number) {
  const r = w / 2, s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 6 }); g.translate(0, 0, -d / 2); return g;
}
/** pyramide tronquée à base carrée (rangs de toit) */
export function frustum4(rb: number, rt: number, h: number) { const g = new THREE.CylinderGeometry(rt, rb, h, 4); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); return g }

/** couleurs du royaume d'un joueur : principale, sombre, claire */
export function teamPal(team: number) {
  const c = new THREE.Color(TEAMC[team].hex);
  return { main: c.getHex(), dark: c.clone().multiplyScalar(.68).getHex(), light: c.clone().lerp(new THREE.Color(0xffffff), .22).getHex() };
}

/** atelier d'assemblage : on pose des pièces (repère local empilable), puis on fusionne */
export class Kit {
  parts: [any, number][] = []; glow: [any, number][] = [];
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  rnd: () => number;
  constructor(seed: number) { let s = (Math.abs(seed | 0) % 2147483646) + 1; this.rnd = () => (s = s * 16807 % 2147483647, (s - 1) / 2147483646) }
  pick<T>(l: T[]): T { return l[this.rnd() * l.length | 0] }
  private mat(x: number, y: number, z: number, rx: number, ry: number, rz: number, s = 1) {
    return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), s === 1 ? ONE : new V3(s, s, s));
  }
  /** travaille dans un repère décalé/tourné (comme un groupe), le temps de fn */
  at(x: number, y: number, z: number, ry: number, fn: () => void, rx = 0, rz = 0, s = 1) {
    this.stack.push(this.stack[this.stack.length - 1].clone().multiply(this.mat(x, y, z, rx, ry, rz, s))); fn(); this.stack.pop();
  }
  add(geo: any, color: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, glow = false) {
    geo.applyMatrix4(this.stack[this.stack.length - 1].clone().multiply(this.mat(x, y, z, rx, ry, rz)));
    (glow ? this.glow : this.parts).push([geo, color]);
  }
  /** déforme légèrement (pierre taillée à la main) en gardant soudés les sommets partagés */
  jitter(g: any, a: number) {
    const p = g.attributes.position, seen = new Map<string, number[]>();
    for (let i = 0; i < p.count; i++) {
      const k = Math.round(p.getX(i) * 500) + ',' + Math.round(p.getY(i) * 500) + ',' + Math.round(p.getZ(i) * 500);
      let o = seen.get(k); if (!o) { o = [(this.rnd() - .5) * a, (this.rnd() - .5) * a, (this.rnd() - .5) * a]; seen.set(k, o) }
      p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
    }
    p.needsUpdate = true; g.computeVertexNormals(); return g;
  }
  stone(w: number, h: number, d: number, a = .025) { return this.jitter(cbox(w, h, d), a) }
  rock(r: number, a = .3) { const g = new THREE.IcosahedronGeometry(r, 0); this.jitter(g, r * a); g.scale(1, .7, 1); return g }
  /** fusionne tout dans le groupe g */
  build(g: any) {
    if (this.parts.length) g.add(mk(merge(this.parts), VC));
    if (this.glow.length) { const m = mk(merge(this.glow), GLOW); m.castShadow = false; g.add(m) }
    this.parts = []; this.glow = [];
  }
}

/** drapeau qui flotte : un pivot au mât, ajouté à b.flags (animé par la scène) */
function flagPivot(g: any, b: any, x: number, y: number, z: number, w: number, h: number, team: ReturnType<typeof teamPal>, kit: Kit) {
  const piv = new THREE.Group(); piv.position.set(x, y, z);
  const f = new Kit(kit.rnd() * 1e6);
  f.add(cbox(w, h, .025, .006), team.main, w / 2 + .02, -h, 0);
  f.add(cbox(h * .32, h * .32, .02, .02), P.gold, w / 2 + .02, -h / 2 - h * .16, .014, 0, 0, Math.PI / 4);
  f.build(piv); g.add(piv); b.flags.push(piv);
}

// =====================================================================
// Donjon (3 × 3 cases)
// =====================================================================
export function buildKeep(g: any, b: any) {
  const k = new Kit(b.id * 7919 + 13), team = teamPal(b.team), y0 = .24, C = P;
  k.add(k.jitter(cbox(3.1, .3, 3.1), .03), C.dirt, 0, -.26, 0);                       // terre battue (descend sous le relief)
  k.add(k.stone(3.0, y0 + .2, 3.0, .03), C.stoneD, 0, -.2, 0);                          // socle
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 1.52 + k.rnd() * .06; k.add(k.rock(.09 + k.rnd() * .07), k.pick([C.stoneD, C.stoneDD, C.stoneM]), Math.cos(a) * r, .02, Math.sin(a) * r, 0, k.rnd() * 6) }

  // courtines : rangées de pierres décalées, chemin de ronde et merlons
  const wall = (z: number, rot: number, gap?: number[]) => k.at(0, 0, 0, rot, () => k.at(0, 0, z, 0, () => {
    const H = 1.0, T = .3, rowH = .2, x0 = -.8, x1 = .8;
    for (let r = 0; r * rowH < H - .01; r++) {
      let x = x0 + (r % 2 ? -.1 : 0);
      while (x < x1 - .02) {
        let len = .26 + k.rnd() * .18; if (x + len > x1) len = x1 - x;
        const cx = x + len / 2;
        if (!(gap && cx > gap[0] && cx < gap[1] && r * rowH < gap[2])) k.add(k.stone(Math.max(.08, len - .02), rowH - .015, T * (.94 + k.rnd() * .1), .02), k.pick([C.stoneL, C.stoneL, C.stoneL2, C.stoneM]), cx, y0 + r * rowH, 0);
        x += len;
      }
    }
    k.add(k.stone(x1 - x0 + .06, .08, T + .1, .01), C.stoneM, 0, y0 + H, 0);
    for (let x = x0 + .12; x < x1 - .08; x += .3) k.add(k.stone(.19, .24, .12, .015), k.pick([C.stoneL, C.stoneL2]), x + .05, y0 + H + .08, T / 2);
  }));
  wall(-1.15, 0); wall(-1.15, Math.PI, [-.32, .32, .78]); wall(-1.15, Math.PI / 2); wall(-1.15, -Math.PI / 2);

  // porte : arc de pierres, vantaux cerclés de fer, torches, bannière
  k.at(0, y0, 1.15, 0, () => {
    k.add(arch(.5, .66, .06), C.woodM, 0, 0, .1);
    for (const x of [-.12, 0, .12]) k.add(cbox(.012, .6, .012, .003), C.woodDD, x, 0, .135);
    for (const y of [.14, .42]) k.add(cbox(.5, .045, .02, .006), C.iron, 0, y, .135);
    for (let i = 0; i <= 6; i++) { const a = Math.PI - i / 6 * Math.PI, r = .31; k.add(k.stone(.13, .14, .36, .015), i % 2 ? C.stoneM : C.stoneL2, Math.cos(a) * r, .41 + Math.sin(a) * r - .07, 0, 0, 0, a - Math.PI / 2) }
    for (const s of [-1, 1]) {
      k.add(k.stone(.2, 1.12, .42, .02), C.stoneM, s * .37, 0, 0);
      k.add(cbox(.04, .04, .1, .01), C.iron, s * .37, .62, .23);
      k.add(cyl(.02, .015, .2, 5), C.woodD, s * .37, .62, .27, -.25);
      k.add(cone(.045, .12, 5), C.flame, s * .37, .8, .31, 0, 0, 0, true);
    }
    k.add(cbox(.3, .42, .03, .008), team.main, 0, .76, .24);
    k.add(cbox(.09, .09, .02, .02), C.gold, 0, .92, .26, 0, 0, Math.PI / 4);
  });
  k.add(k.jitter(cbox(.62, .03, .5), .03), C.dirt, 0, 0, 1.6);

  // tours d'angle octogonales, toits coniques aux couleurs du royaume
  for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) k.at(x, y0, z, 0, () => {
    k.add(k.jitter(cyl(.5, .56, .32, 8), .02), C.stoneD);
    k.add(k.jitter(cyl(.42, .47, 1.5, 8), .015), C.stoneL, 0, .3);
    for (let i = 0; i < 9; i++) { const a = k.rnd() * Math.PI * 2, y = .45 + k.rnd() * 1.1; k.add(k.stone(.15 + k.rnd() * .1, .1 + k.rnd() * .05, .06, .012), k.pick([C.stoneM, C.stoneL2, C.stoneD]), Math.cos(a) * .44, y, Math.sin(a) * .44, 0, -a + Math.PI / 2) }
    k.add(k.jitter(cyl(.52, .48, .16, 8), .015), C.stoneM, 0, 1.78);
    k.add(cyl(.62, .62, .07, 8), team.dark, 0, 1.94);
    k.add(k.jitter(cone(.6, .5, 8), .015), team.main, 0, 2.0);
    k.add(cone(.36, .5, 8), team.light, 0, 2.38);
    k.add(cyl(.012, .012, .2, 4), C.iron, 0, 2.8); k.add(new THREE.IcosahedronGeometry(.055, 0), C.gold, 0, 3.0);
    const out = Math.atan2(x, z); k.add(cbox(.07, .26, .04, .01), C.dark, Math.sin(out) * .45, 1.0, Math.cos(out) * .45, 0, out);
  });

  // tour maîtresse
  const W = 1.36;
  k.at(0, y0, -.28, 0, () => {
    k.add(k.stone(W + .22, .36, W + .22, .02), C.stoneD);
    k.add(cbox(W, 2.4, W, .04), C.stoneL, 0, .3);
    k.add(k.stone(W + .08, .1, W + .08, .01), C.stoneM, 0, 1.45);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 10; i++) {
      const big = i % 2;
      k.add(k.stone(big ? .3 : .18, .19, big ? .18 : .3, .015), k.pick([C.stoneM, C.stoneL2, C.stoneD]), sx * (W / 2 - (big ? .12 : .06)), .36 + i * .21, sz * (W / 2 - (big ? .06 : .12)));
    }
    for (let f = 0; f < 4; f++) for (let i = 0; i < 9; i++) {
      const a = f * Math.PI / 2, u = (k.rnd() - .5) * (W - .5), y = .45 + k.rnd() * 1.9;
      if (Math.abs(u) < .22 && f === 0) continue;
      k.add(k.stone(.16 + k.rnd() * .14, .1 + k.rnd() * .06, .05, .012), k.pick([C.stoneM, C.stoneL2, C.stoneL2]), Math.sin(a) * (W / 2 + .01) + Math.cos(a) * u, y, Math.cos(a) * (W / 2 + .01) - Math.sin(a) * u, 0, a);
    }
    for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2; for (let u = -.55; u <= .56; u += .22) k.add(k.stone(.12, .14, .16, .01), C.stoneM, Math.sin(a) * (W / 2 + .05) + Math.cos(a) * u, 2.56, Math.cos(a) * (W / 2 + .05) - Math.sin(a) * u, 0, a) }
    k.add(k.stone(W + .24, .16, W + .24, .015), C.stoneM, 0, 2.7);
    for (let f = 0; f < 4; f++) { const a = f * Math.PI / 2; for (let u = -.6; u <= .61; u += .3) k.add(k.stone(.2, .26, .14, .015), k.pick([C.stoneL, C.stoneL2]), Math.sin(a) * (W / 2 + .05) + Math.cos(a) * u, 2.86, Math.cos(a) * (W / 2 + .05) - Math.sin(a) * u, 0, a) }
    // toit en trois rangs de tuiles
    k.add(frustum4(1.0, .74, .42), team.main, 0, 2.86); k.add(frustum4(.8, .5, .42), team.light, 0, 3.22); k.add(frustum4(.56, .001, .62), team.main, 0, 3.58);
    k.add(cyl(.03, .03, .9, 5), C.woodDD, 0, 4.1); k.add(new THREE.IcosahedronGeometry(.07, 0), C.gold, 0, 5.02);
    // fenêtres en arc (certaines éclairées)
    const win = (x: number, y: number, z: number, ry: number, lit: boolean) => k.at(x, y, z, ry, () => { k.add(arch(.2, .3, .04), lit ? C.window : C.dark, 0, 0, 0, 0, 0, 0, lit); k.add(k.stone(.28, .05, .08, .01), C.stoneM, 0, -.05, .01) });
    win(0, 1.65, W / 2 + .01, 0, true); win(-.36, 2.05, W / 2 + .01, 0, false); win(.36, 2.05, W / 2 + .01, 0, true);
    win(W / 2 + .01, 1.0, 0, Math.PI / 2, false); win(W / 2 + .01, 1.9, 0, Math.PI / 2, true); win(-W / 2 - .01, 1.9, 0, -Math.PI / 2, false); win(0, 1.9, -W / 2 - .01, Math.PI, true);
    k.add(arch(.36, .52, .05), C.woodD, 0, .36, W / 2 + .02); k.add(cbox(.36, .04, .02, .005), C.iron, 0, .52, W / 2 + .05);
    for (let s = 0; s < 3; s++) k.add(k.stone(.62 - s * .08, .1, .16, .01), k.pick([C.stoneM, C.stoneD]), 0, .26 + s * .03, W / 2 + .26 - s * .12);
    for (const x of [-.46, .46]) { k.add(cbox(.26, .62, .025, .006), team.main, x, 1.72, W / 2 + .03); k.add(cbox(.08, .08, .02, .02), C.gold, x, 2.1, W / 2 + .05, 0, 0, Math.PI / 4); k.add(cyl(.012, .012, .32, 4), C.woodDD, x, 2.36, W / 2 + .045, 0, 0, Math.PI / 2) }
  });
  // la cour : tonneaux, caisses, sac
  const barrel = (x: number, z: number) => k.at(x, y0, z, 0, () => { k.add(cyl(.1, .1, .24, 8), C.woodM); k.add(cyl(.11, .11, .1, 8), C.woodM, 0, .07); for (const y of [.03, .19]) k.add(cyl(.105, .105, .025, 8), C.iron, 0, y); k.add(cyl(.085, .085, .01, 8), C.woodEnd, 0, .24) });
  barrel(.62, .55); barrel(.82, .42); barrel(.7, .32);
  const crate = (x: number, y: number, z: number, s: number, r: number) => k.at(x, y, z, r, () => { k.add(cbox(s, s, s, .02), C.woodL); for (const sx of [-1, 1]) k.add(cbox(.03, s, s + .01, .006), C.woodD, sx * (s / 2 - .015)); k.add(cbox(s + .01, .03, s + .01, .006), C.woodD, 0, s - .03) });
  crate(-.72, y0, .55, .22, .3); crate(-.86, y0, .36, .18, -.2); crate(-.72, y0 + .22, .52, .14, .7);
  k.add(k.jitter(new THREE.IcosahedronGeometry(.1, 0), .03), C.cloth, -.55, y0 + .06, .72);
  k.build(g);
  flagPivot(g, b, 0, y0 + 4.98, -.28, .5, .3, team, k);
}

// =====================================================================
// Cabane de bûcheron (2 × 2 cases)
// =====================================================================
export function buildHut(g: any, b: any) {
  const k = new Kit(b.id * 6151 + 3), team = teamPal(b.team), C = P, y0 = .06;
  const inner = new THREE.Group(); inner.scale.setScalar(.9); g.add(inner);
  k.add(k.jitter(cbox(2.2, .2, 2.2), .05), C.dirt, 0, -.14, 0);
  const LX = 1.3, LZ = 1.0, r = .075, lay = .13, layers = 7, top = .16 + layers * lay, rise = .58, over = .2;
  const log = (len: number, color: number, x: number, y: number, z: number, ry: number) => k.at(x, y, z, ry, () => {
    k.add(new THREE.CylinderGeometry(r, r, len, 7), color, 0, 0, 0, 0, 0, Math.PI / 2);
    for (const s of [-1, 1]) k.add(new THREE.CylinderGeometry(r * .9, r * .9, .02, 7), C.woodEnd, s * len / 2, 0, 0, 0, 0, Math.PI / 2);
  });
  k.at(-.18, y0, -.18, 0, () => {
    for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; k.add(k.stone(.24, .12, .2, .03), k.pick([C.stoneD, C.stoneM, C.stoneDD]), Math.cos(t) * LX * .56, 0, Math.sin(t) * LZ * .58, 0, -t) }
    for (let i = 0; i < layers; i++) {
      const y = .16 + i * lay;
      for (const s of [-1, 1]) {
        log(LX + .26, k.pick([C.woodM, C.woodM, C.woodD]), 0, y, s * LZ / 2, 0);
        log(LZ + .26, k.pick([C.woodM, C.woodD, C.woodM]), s * LX / 2, y + lay / 2, 0, Math.PI / 2);
      }
    }
    // pignons, toit de bardeaux
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape(); tri.moveTo(-LZ / 2 - .04, 0); tri.lineTo(LZ / 2 + .04, 0); tri.lineTo(0, rise); tri.lineTo(-LZ / 2 - .04, 0);
      k.add(new THREE.ExtrudeGeometry(tri, { depth: .05, bevelEnabled: false }), C.woodL, s * (LX / 2 + .02), top, 0, 0, Math.PI / 2);
    }
    const slope = Math.atan2(rise, LZ / 2), run = LZ / 2 + over, len = run / Math.cos(slope);
    for (const s of [-1, 1]) k.at(0, top + rise + .02, 0, 0, () => {
      k.add(cbox(LX + .56, .09, len + .04, .02), C.shingleD, 0, -.02, s * len / 2);
      for (let row = 0; row < 4; row++) k.add(cbox(LX + .58, .06, len / 4 + .05, .015), row % 2 ? C.shingle : C.shingleL, 0, .05 + row * .012, s * (len - (row + .5) * len / 4 + .03));
    }, s * slope);
    k.add(new THREE.CylinderGeometry(.07, .07, LX + .66, 7), C.woodDD, 0, top + rise + .1, 0, 0, 0, Math.PI / 2);
    // porte, fenêtre éclairée aux volets ouverts
    k.add(cbox(.36, .62, .05, .01), C.woodL, .16, .1, LZ / 2 + .07);
    for (const x of [.06, .16, .26]) k.add(cbox(.01, .6, .01, .002), C.woodD, x, .11, LZ / 2 + .1);
    for (const y of [.22, .55]) k.add(cbox(.36, .04, .02, .005), C.woodD, .16, y, LZ / 2 + .1);
    k.add(new THREE.IcosahedronGeometry(.022, 0), C.iron, .29, .4, LZ / 2 + .11);
    k.add(cbox(.24, .2, .03, .005), C.window, -.33, .44, LZ / 2 + .07, 0, 0, 0, true);
    k.add(cbox(.3, .04, .08, .01), C.woodD, -.33, .4, LZ / 2 + .09);
    for (const s of [-1, 1]) k.add(cbox(.11, .22, .02, .005), C.woodL, -.33 + s * .2, .43, LZ / 2 + .12, 0, s * .6);
    // cheminée de pierres
    k.at(-LX / 2 - .16, 0, -.12, 0, () => {
      for (let i = 0; i < 12; i++) k.add(k.stone(i < 6 ? .34 : .26, .15, i < 6 ? .34 : .26, .03), k.pick([C.stoneM, C.stoneD, C.stoneL2]), 0, i * .145, 0, 0, k.rnd() * .3);
      k.add(k.stone(.32, .06, .32, .01), C.stoneDD, 0, 12 * .145, 0);
    });
  });
  // souche avec la hache, copeaux
  k.at(.62, y0, .6, 0, () => {
    k.add(k.jitter(cyl(.17, .21, .26, 8), .02), C.woodD); k.add(cyl(.165, .165, .012, 8), C.woodEnd, 0, .26); k.add(cyl(.09, .09, .004, 8), 0xc9945a, 0, .272);
    k.at(.02, .27, 0, .4, () => { k.add(cyl(.016, .018, .46, 5), C.woodL); k.add(cbox(.17, .1, .03, .008), C.iron, .05, -.02, 0); k.add(cbox(.03, .1, .032, .006), C.steel, .14, -.02, 0) }, 0, -.5);
  });
  for (let i = 0; i < 14; i++) k.add(cbox(.04 + k.rnd() * .03, .012, .025, .004), k.pick([C.woodEnd, C.woodL]), .62 + (k.rnd() - .5) * .7, y0 + .005, .6 + (k.rnd() - .5) * .6, 0, k.rnd() * 3);
  // tas de bûches sous un appentis
  k.at(.82, y0, -.42, 0, () => {
    [4, 3, 2].forEach((n, row) => { for (let j = 0; j < n; j++) log(.5, k.pick([C.woodM, C.woodD]), 0, .08 + row * .135, (j - (n - 1) / 2) * .16, Math.PI / 2) });
    for (const z of [-.36, .36]) k.add(cyl(.025, .025, .66, 5), C.woodD, -.2, 0, z);
    k.add(cbox(.36, .05, .9, .015), C.shingleD, -.06, .62, 0, 0, 0, -.35);
  });
  // lanterne sur poteau, mât du fanion
  k.add(cyl(.025, .03, .7, 5), C.woodD, .5, y0, .95); k.add(cbox(.18, .03, .03, .006), C.woodD, .45, y0 + .66, .95);
  k.add(cbox(.08, .1, .08, .01), C.window, .4, y0 + .54, .95, 0, 0, 0, true); k.add(cone(.07, .06, 4), C.iron, .4, y0 + .64, .95, 0, Math.PI / 4);
  k.add(cyl(.02, .02, 1.3, 5), C.woodDD, -.88, y0, .8);
  k.build(inner);
  flagPivot(inner, b, -.88, y0 + 1.28, .8, .34, .2, team, k);
  // fumée de la cheminée (animée par la scène)
  b.smoke = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.09, 0), new THREE.MeshStandardMaterial({ color: 0xe9e4dc, flatShading: true, transparent: true, opacity: .8, depthWrite: false }));
    m.userData = { t: i / 4, x: -.18 - LX / 2 - .16, y: y0 + 12 * .145 + .1, z: -.3 }; inner.add(m); b.smoke.push(m);
  }
}
/** anime la fumée d'un bâtiment (à appeler à chaque image) */
export function updSmoke(b: any, dt: number) {
  for (const m of b.smoke) { const u = m.userData; u.t = (u.t + dt * .28) % 1; const p = u.t; m.position.set(u.x + Math.sin(p * 5) * .08 + p * .2, u.y + p * 1.1, u.z); m.scale.setScalar(.5 + p * 1.4); m.material.opacity = .7 * (1 - p) }
}

// =====================================================================
// Carrière de tuffeau (2 × 2 cases, posée sur un gisement de pierre)
// =====================================================================
export function buildQuarry(g: any, b: any) {
  const k = new Kit(b.id * 4271 + 5), team = teamPal(b.team), C = P;
  k.add(k.jitter(cbox(2.0, .22, 2.0), .05), C.gravel, 0, -.16, 0);
  // front de taille en gradins, au fond et à gauche (blocs coupés nets)
  const tufs = [C.tufL, C.tuf, C.tuf, C.tufM];
  const step = (x0: number, x1: number, z0: number, z1: number, y: number, h: number) => {
    for (let x = x0; x < x1 - .02;) { const w = Math.min(x1 - x, .3 + k.rnd() * .2);
      for (let z = z0; z < z1 - .02;) { const d = Math.min(z1 - z, .28 + k.rnd() * .18);
        k.add(k.stone(w - .015, h * (.92 + k.rnd() * .12), d - .015, .018), k.pick(tufs), x + w / 2, y, z + d / 2); z += d }
      x += w }
  };
  step(-.95, .95, -.95, -.6, 0, .75); step(-.95, .95, -.6, -.32, 0, .5); step(-.95, .4, -.32, -.06, 0, .26);
  step(-.95, -.62, -.06, .55, 0, .62); step(-.62, -.36, -.06, .3, 0, .36);
  // herbe qui déborde du haut du front de taille
  for (let i = 0; i < 16; i++) { const x = -.9 + k.rnd() * 1.8, z = -.93 + k.rnd() * .2; k.add(cone(.04, .12 + k.rnd() * .08, 4), C.grass, x, .78, z, (k.rnd() - .5) * .4, 0, (k.rnd() - .5) * .4) }
  // éclats et blocs taillés prêts à partir, sur une palette
  for (let i = 0; i < 10; i++) k.add(k.rock(.04 + k.rnd() * .05), k.pick(tufs), -.2 + k.rnd() * .9, .01, -.05 + k.rnd() * .5, 0, k.rnd() * 6);
  k.at(.5, 0, .5, .15, () => {
    k.add(cbox(.62, .06, .5, .01), C.woodM);
    for (const z of [-.18, 0, .18]) k.add(cbox(.62, .015, .1, .004), C.woodD, 0, .06, z);
    for (let i = 0; i < 6; i++) k.add(k.stone(.24, .17, .2, .012), k.pick(tufs), -.15 + (i % 2) * .28, .075 + (i / 4 | 0) * .17, -.11 + ((i >> 1) % 2) * .22);
  });
  // chèvre de levage en bois : mât, flèche, corde, poulie, bloc suspendu
  k.at(-.5, 0, .6, -.5, () => {
    k.add(cyl(.045, .055, 1.5, 6), C.woodD);
    k.add(cyl(.025, .025, .85, 5), C.woodD, -.08, 0, -.32, -.42);
    k.add(cyl(.025, .025, .85, 5), C.woodD, .32, 0, .1, .2, 0, .42);
    k.at(0, 1.38, 0, 0, () => {
      k.add(new THREE.CylinderGeometry(.035, .035, .95, 6), C.woodM, .4, .22, 0, 0, 0, -1.1);
      k.add(new THREE.CylinderGeometry(.07, .07, .04, 8), C.woodL, .82, .42, 0, Math.PI / 2);
      k.add(cyl(.006, .006, .75, 3), 0xe6dcc2, .84, -.34, 0);
      k.add(k.stone(.2, .16, .16, .01), C.tufL, .84, -.5, 0);
    });
    k.add(new THREE.TorusGeometry(.09, .025, 4, 8), 0xcdbb93, .08, .03, .14, Math.PI / 2);
  });
  // brouette et pioche
  k.at(.1, 0, .82, .9, () => {
    k.add(cbox(.28, .1, .2, .02), C.woodM, 0, .12, 0);
    k.add(new THREE.CylinderGeometry(.08, .08, .04, 8), C.woodD, .18, .08, 0, Math.PI / 2);
    for (const s of [-1, 1]) k.add(cbox(.3, .025, .025, .006), C.woodD, -.2, .14, s * .08);
    for (let i = 0; i < 3; i++) k.add(k.rock(.05), C.tuf, (i - 1) * .07, .2, 0);
  });
  k.at(-.28, .36, .12, .6, () => { k.add(cyl(.014, .016, .5, 5), C.woodL, 0, -.36, 0, 0, 0, .35); k.add(cbox(.3, .04, .04, .01), C.iron, -.12, .1, 0, 0, 0, .35) });
  // mât du fanion
  k.add(cyl(.02, .02, 1.25, 5), C.woodDD, .85, .2, -.85);
  k.build(g);
  flagPivot(g, b, .85, 1.43, -.85, .34, .2, team, k);
}

// =====================================================================
// Caserne en tuffeau, toit d'ardoise (3 × 2 cases)
// =====================================================================
export function buildBarracks(g: any, b: any) {
  const k = new Kit(b.id * 3907 + 11), team = teamPal(b.team), C = P;
  const L = 2.5, D = 1.1, H = 1.0, zc = -.35, rise = .78, over = .14;
  k.add(k.jitter(cbox(3.0, .26, 2.0), .03), C.dirtL, 0, -.2, 0);                       // cour en terre battue
  k.at(0, 0, zc, 0, () => {
    k.add(k.stone(L + .16, .2, D + .16, .02), C.tufD, 0, -.04, 0);                          // soubassement
    k.add(cbox(L, H, D, .03), C.tuf, 0, .14, 0);                                           // murs de tuffeau
    // pierres apparentes et chaînes d'angle
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) { const big = i % 2; k.add(k.stone(big ? .28 : .17, .18, big ? .17 : .28, .012), k.pick([C.tufM, C.tufL, C.tufD]), sx * (L / 2 - (big ? .11 : .055)), .18 + i * .19, sz * (D / 2 - (big ? .055 : .11))) }
    for (let i = 0; i < 26; i++) { const front = k.rnd() < .6, u = (k.rnd() - .5) * (front ? L - .4 : D - .3), y = .25 + k.rnd() * .75;
      if (front) { if (Math.abs(u) < .32 || Math.abs(Math.abs(u) - .72) < .16) continue; k.add(k.stone(.18 + k.rnd() * .12, .09 + k.rnd() * .05, .04, .01), k.pick([C.tufL, C.tufM]), u, y, D / 2 + .005) }
      else { const s = k.rnd() < .5 ? -1 : 1; k.add(k.stone(.04, .09 + k.rnd() * .05, .18 + k.rnd() * .1, .01), k.pick([C.tufL, C.tufM]), s * (L / 2 + .005), y, u) } }
    k.add(k.stone(L + .08, .08, D + .08, .01), C.tufM, 0, H + .1, 0);                       // corniche
    // pignons de tuffeau et toit d'ardoise à rangs
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(0, rise); tri.lineTo(-D / 2, 0);
      k.add(new THREE.ExtrudeGeometry(tri, { depth: .08, bevelEnabled: false }), C.tuf, s * (L / 2 - .04), H + .18, 0, 0, s * Math.PI / 2);
    }
    const slope = Math.atan2(rise, D / 2), run = D / 2 + over, len = run / Math.cos(slope);
    for (const s of [-1, 1]) k.at(0, H + .2 + rise, 0, 0, () => {
      k.add(cbox(L + .3, .08, len + .04, .02), C.slateD, 0, -.02, s * len / 2);
      for (let row = 0; row < 5; row++) k.add(cbox(L + .32, .05, len / 5 + .04, .012), row % 2 ? C.slate : C.slateL, 0, .04 + row * .01, s * (len - (row + .5) * len / 5 + .02));
    }, s * slope);
    k.add(cbox(L + .36, .09, .14, .02), C.slateD, 0, H + .2 + rise - .02, 0);               // faîtage
    // lucarnes de tuffeau (fenêtres de toit typiques de Touraine)
    for (const x of [-.65, .65]) k.at(x, H + .2, D / 2 - .1, 0, () => {
      k.add(cbox(.34, .42, .3, .02), C.tufL, 0, 0, 0);
      k.add(arch(.16, .24, .03), C.window, 0, .1, .155, 0, 0, 0, true);
      const tri = new THREE.Shape(); tri.moveTo(-.2, 0); tri.lineTo(.2, 0); tri.lineTo(0, .22); tri.lineTo(-.2, 0);
      k.add(new THREE.ExtrudeGeometry(tri, { depth: .34, bevelEnabled: false }), C.slateD, 0, .42, -.17);
      k.add(cone(.03, .12, 4), C.tufM, 0, .62, .17);
    });
    // cheminée
    k.at(L / 2 - .35, H + .3, -.1, 0, () => { k.add(k.stone(.24, .9, .24, .015), C.tufM); k.add(k.stone(.3, .06, .3, .01), C.tufD, 0, .9) });
    // porte en arc, fenêtres à meneaux, bannières
    k.at(0, .14, D / 2, 0, () => {
      k.add(arch(.46, .7, .05), C.woodM, 0, 0, .03);
      for (const x of [-.11, 0, .11]) k.add(cbox(.012, .6, .012, .003), C.woodDD, x, 0, .06);
      for (const y of [.16, .46]) k.add(cbox(.46, .045, .02, .006), C.iron, 0, y, .06);
      for (let i = 0; i <= 6; i++) { const a = Math.PI - i / 6 * Math.PI, r = .29; k.add(k.stone(.12, .13, .1, .012), i % 2 ? C.tufM : C.tufL, Math.cos(a) * r, .47 + Math.sin(a) * r - .06, .02, 0, 0, a - Math.PI / 2) }
      for (const x of [-.72, .72]) {
        k.add(k.stone(.34, .44, .05, .01), C.tufL, x, .32, .01);
        k.add(cbox(.24, .32, .03, .006), x < 0 ? C.window : C.dark, x, .38, .03, 0, 0, 0, x < 0);
        k.add(cbox(.03, .32, .04, .006), C.tufM, x, .38, .05); k.add(cbox(.24, .03, .04, .006), C.tufM, x, .53, .05);
      }
      for (const x of [-.4, .4]) { k.add(cbox(.2, .48, .025, .006), team.main, x, .3, .04); k.add(cbox(.07, .07, .02, .02), C.gold, x, .6, .055, 0, 0, Math.PI / 4); k.add(cyl(.01, .01, .26, 4), C.woodDD, x, .8, .05, 0, 0, Math.PI / 2) }
    });
  });
  // cour d'entraînement : râtelier de lances, cible de tir, mannequin
  k.at(-1.05, 0, .55, .35, () => {
    for (const x of [-.2, .2]) k.add(cyl(.025, .03, .62, 5), C.woodD, x, 0, 0);
    for (const y of [.16, .5]) k.add(cbox(.48, .04, .05, .01), C.woodD, 0, y, 0);
    for (let i = 0; i < 4; i++) { const x = -.15 + i * .1; k.add(cyl(.012, .012, .8, 4), C.woodL, x, 0, .05, -.18); k.add(cone(.025, .1, 4), C.steel, x, .8 * Math.cos(.18) - .02, .05 - .8 * Math.sin(.18), -.18) }
    k.add(new THREE.CylinderGeometry(.13, .13, .03, 8), team.main, .3, .3, .07, Math.PI / 2 - .2);
    k.add(new THREE.IcosahedronGeometry(.035, 0), C.gold, .3, .3, .09);
  });
  k.at(1.08, 0, .55, -.45, () => {
    for (const [x, rz] of [[-.14, .12], [.14, -.12]]) k.add(cyl(.02, .02, .7, 5), C.woodD, x, 0, -.05, 0, 0, rz);
    k.add(cyl(.02, .02, .55, 5), C.woodD, 0, 0, -.22, .45);
    k.at(0, .48, .02, 0, () => {
      k.add(new THREE.CylinderGeometry(.24, .24, .1, 10), C.straw, 0, 0, 0, Math.PI / 2);
      for (const [r, c] of [[.19, 0xf2ece0], [.13, 0xc9402e], [.075, 0xf2ece0], [.035, C.gold]] as [number, number][]) k.add(new THREE.CylinderGeometry(r, r, .012, 10), c, 0, 0, .055 + (.24 - r) * .02, Math.PI / 2);
      k.add(cyl(.006, .006, .2, 3), C.woodL, .04, .02, .1, Math.PI / 2 - .3);
    });
  });
  k.at(.38, 0, .7, 0, () => {
    k.add(cyl(.03, .035, .75, 5), C.woodD);
    k.add(new THREE.CylinderGeometry(.025, .025, .5, 5), C.woodD, 0, .55, 0, 0, 0, Math.PI / 2);
    k.add(k.jitter(new THREE.IcosahedronGeometry(.15, 0), .03), C.cloth, 0, .48, 0); k.add(k.jitter(new THREE.IcosahedronGeometry(.09, 0), .02), C.cloth, 0, .72, 0);
    k.add(cbox(.06, .02, .02, .005), C.dark, 0, .72, .085);
  });
  for (let i = 0; i < 8; i++) k.add(cone(.04, .1 + k.rnd() * .06, 4), C.grass, (k.rnd() - .5) * 2.8, .02, .75 + k.rnd() * .2);
  k.add(cyl(.025, .025, 1.6, 5), C.woodDD, -1.35, 0, -.85);
  k.build(g);
  flagPivot(g, b, -1.35, 1.58, -.85, .5, .3, team, k);
}

// =====================================================================
// Réserve (2 × 2 cases) : cour pavée sous un auvent de bardeaux, le stock (b.pile) s'y empile
// =====================================================================
export function buildReserve(g: any, b: any) {
  const k = new Kit(b.id * 2851 + 17), team = teamPal(b.team), C = P;
  k.add(k.jitter(cbox(2.0, .22, 2.0), .04), C.dirt, 0, -.16, 0);
  // dallage de pierres
  for (let x = -.84; x < .85; x += .28) for (let z = -.84; z < .85; z += .28) k.add(k.stone(.26, .06, .26, .02), k.pick([C.stoneL2, C.stoneM, C.stoneL2, C.stoneD]), x + (k.rnd() - .5) * .02, 0, z + (k.rnd() - .5) * .02, 0, (k.rnd() - .5) * .1);
  // auvent sur poteaux au fond (le bois et la pierre sont rangés dessous)
  for (const x of [-.85, .85]) for (const z of [-.85, -.05]) { k.add(k.stone(.16, .08, .16, .01), C.stoneD, x, .05, z); k.add(cyl(.045, .05, 1.0, 6), C.woodD, x, .12, z) }
  for (const z of [-.85, -.05]) k.add(cbox(1.86, .07, .08, .015), C.woodD, 0, 1.06, z);
  k.at(0, 1.1, -.45, 0, () => {
    k.add(cbox(2.1, .08, 1.15, .02), C.shingleD, 0, 0, 0);
    for (let row = 0; row < 4; row++) k.add(cbox(2.12, .05, .32, .012), row % 2 ? C.shingle : C.shingleL, 0, .06 + row * .012, .42 - row * .26);
  }, -.18);
  for (const x of [-.85, .85]) k.add(cbox(.06, .06, .5, .01), C.woodD, x, .78, -.45, .9);   // contrefiches
  // barrière basse sur les côtés et à l'avant
  const fence = (x0: number, z0: number, x1: number, z1: number) => {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / .3), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
    for (let i = 0; i <= n; i++) k.add(cbox(.06, .36, .06, .01), C.woodM, x0 + (x1 - x0) * i / n, .04, z0 + (z1 - z0) * i / n);
    for (const y of [.16, .32]) k.add(cbox(Math.hypot(x1 - x0, z1 - z0), .04, .035, .008), C.woodL, (x0 + x1) / 2, y, (z0 + z1) / 2, 0, ry);
  };
  fence(-.93, .05, -.93, .93); fence(.93, .05, .93, .93); fence(-.93, .93, -.35, .93); fence(.35, .93, .93, .93);
  // tonneaux et sacs dans un coin
  for (const [x, z] of [[.72, .7], [.55, .74]]) k.at(x, .06, z, 0, () => { k.add(cyl(.09, .09, .22, 8), C.woodM); for (const y of [.03, .17]) k.add(cyl(.095, .095, .022, 8), C.iron, 0, y); k.add(cyl(.075, .075, .01, 8), C.woodEnd, 0, .22) });
  k.add(k.jitter(new THREE.IcosahedronGeometry(.09, 0), .03), C.cloth, -.7, .12, .72);
  k.add(cyl(.02, .02, 1.5, 5), C.woodDD, .85, 1.12, -.85);
  k.build(g);
  flagPivot(g, b, .85, 2.6, -.85, .34, .2, team, k);
  b.pile = new THREE.Group(); b.pile.position.y = .02; g.add(b.pile);
}

// =====================================================================
// Grenier (2 × 2 cases) : grange à colombages sur piliers de pierre, toit de chaume épais
// =====================================================================
export function buildGranary(g: any, b: any) {
  const k = new Kit(b.id * 1931 + 23), team = teamPal(b.team), C = P;
  k.add(k.jitter(cbox(2.0, .22, 2.0), .04), C.dirt, 0, -.16, 0);
  const W = 1.35, D = 1.15, cx = -.18, cz = -.2, fl = .34, H = .82;
  k.at(cx, 0, cz, 0, () => {
    // piliers en champignon (protègent le grain des rongeurs)
    for (const x of [-W / 2 + .1, 0, W / 2 - .1]) for (const z of [-D / 2 + .1, D / 2 - .1]) { k.add(k.jitter(cyl(.07, .1, .24, 6), .015), C.stoneM, x, 0, z); k.add(k.jitter(cyl(.15, .14, .07, 7), .015), C.stoneL2, x, .24, z) }
    // plancher et murs de planches dans une ossature sombre
    k.add(cbox(W + .1, .07, D + .1, .015), C.woodD, 0, fl - .04, 0);
    k.add(cbox(W, H, D, .02), C.woodL, 0, fl, 0);
    for (let x = -W / 2 + .12; x < W / 2 - .05; x += .16) for (const s of [-1, 1]) k.add(cbox(.012, H - .04, .012, .003), C.woodM, x, fl + .02, s * (D / 2 + .004));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(cbox(.09, H + .02, .09, .015), C.woodDD, sx * W / 2, fl, sz * D / 2);
    for (const s of [-1, 1]) { k.add(cbox(W + .06, .08, .09, .015), C.woodDD, 0, fl + H - .06, s * D / 2); k.add(cbox(.09, .08, D + .06, .015), C.woodDD, s * W / 2, fl + H - .06, 0) }
    for (const s of [-1, 1]) k.add(cbox(.06, H * 1.1, .05, .01), C.woodDD, s * .3, fl + .02, D / 2 + .01, 0, 0, s * .7);
    // porte haute, escalier de bois, poutre de levage avec un sac
    k.add(cbox(.34, .5, .04, .01), C.woodM, 0, fl + .04, D / 2 + .03);
    for (const x of [-.09, .09]) k.add(cbox(.012, .48, .012, .003), C.woodDD, x, fl + .05, D / 2 + .055);
    for (let i = 0; i < 3; i++) k.add(cbox(.38, .05, .14, .01), C.woodM, 0, fl - .08 - i * .1, D / 2 + .1 + i * .12);
    for (const s of [-1, 1]) k.add(cbox(.04, .04, .5, .01), C.woodDD, s * .2, .06, D / 2 + .3, -.62);
    // pignons et toit de chaume épais en couches
    const top = fl + H, rise = .62, over = .2;
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape(); tri.moveTo(-D / 2 - .04, 0); tri.lineTo(D / 2 + .04, 0); tri.lineTo(0, rise); tri.lineTo(-D / 2 - .04, 0);
      k.add(new THREE.ExtrudeGeometry(tri, { depth: .05, bevelEnabled: false }), C.woodL, s * (W / 2 + .02), top, 0, 0, Math.PI / 2);
    }
    k.add(cbox(.06, .5, .06, .01), C.woodDD, 0, top + .02, D / 2 + .5, Math.PI / 2 - .05);
    k.add(cyl(.005, .005, .3, 3), 0xe6dcc2, 0, top - .28, D / 2 + .7);
    k.add(k.jitter(new THREE.IcosahedronGeometry(.1, 0), .03), C.cloth, 0, top - .4, D / 2 + .7);
    const slope = Math.atan2(rise, D / 2), len = (D / 2 + over) / Math.cos(slope);
    for (const s of [-1, 1]) k.at(0, top + rise + .04, 0, 0, () => {
      k.add(k.jitter(cbox(W + .5, .14, len + .06, .04), .02), 0xb8923f, 0, -.06, s * len / 2);
      for (let row = 0; row < 3; row++) k.add(k.jitter(cbox(W + .54, .1, len / 3 + .08, .035), .025), row % 2 ? C.straw : 0xc9a24c, 0, .04 + row * .02, s * (len - (row + .5) * len / 3 + .04));
    }, s * slope);
    k.add(k.jitter(new THREE.CylinderGeometry(.11, .11, W + .6, 7), .02), 0xa8823a, 0, top + rise + .1, 0, 0, 0, Math.PI / 2);
    // petite lucarne d'aération éclairée
    k.add(cbox(.16, .12, .03, .005), C.window, .4, fl + .5, D / 2 + .02, 0, 0, 0, true);
  });
  // gerbes de blé contre le mur et mât du fanion
  for (const [x, z] of [[-.85, .55], [-.72, .7]]) k.at(x, .06, z, 0, () => { k.add(cone(.09, .34, 6), C.straw, 0, 0, 0); k.add(cyl(.095, .095, .03, 6), 0xa8823a, 0, .12) });
  k.add(cyl(.02, .02, 1.6, 5), C.woodDD, .85, .06, -.85);
  k.build(g);
  flagPivot(g, b, .85, 1.64, -.85, .34, .2, team, k);
  b.pile = new THREE.Group(); b.pile.position.set(.62, .06, .62); g.add(b.pile);
}

// =====================================================================
// Pièces communes aux ateliers
// =====================================================================
/**
 * maisonnette à colombages : murs crépis, ossature sombre, toit à deux pans en rangs (chaume, bardeaux ou ardoise)
 * centrée en (x, z), faîtage le long de x ; renvoie la hauteur du haut des murs
 */
function cottage(k: Kit, x: number, z: number, W: number, D: number, H: number, roof: 'thatch' | 'shingle' | 'slate', rise = .55) {
  const C = P, wallC = 0xe8dcc0;
  const roofs = { thatch: [0xb8923f, C.straw, 0xc9a24c, 0xa8823a], shingle: [C.shingleD, C.shingle, C.shingleL, C.woodDD], slate: [C.slateD, C.slate, C.slateL, C.slateD] }[roof];
  k.at(x, 0, z, 0, () => {
    k.add(k.stone(W + .1, .12, D + .1, .02), C.stoneM, 0, 0, 0);
    k.add(cbox(W, H, D, .02), wallC, 0, .1, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(cbox(.08, H + .02, .08, .015), C.woodDD, sx * W / 2, .1, sz * D / 2);
    for (const s of [-1, 1]) { k.add(cbox(W + .06, .07, .08, .015), C.woodDD, 0, .1 + H - .05, s * D / 2); k.add(cbox(.08, .07, D + .06, .015), C.woodDD, s * W / 2, .1 + H - .05, 0) }
    for (const s of [-1, 1]) { k.add(cbox(.05, H * 1.05, .05, .01), C.woodDD, -W / 4, .12, s * (D / 2 + .005), 0, 0, s * .55); k.add(cbox(.05, H * 1.05, .05, .01), C.woodDD, W / 4, .12, s * (D / 2 + .005), 0, 0, -s * .55) }
    const top = .1 + H, over = .16;
    for (const s of [-1, 1]) {
      const tri = new THREE.Shape(); tri.moveTo(-D / 2 - .03, 0); tri.lineTo(D / 2 + .03, 0); tri.lineTo(0, rise); tri.lineTo(-D / 2 - .03, 0);
      k.add(new THREE.ExtrudeGeometry(tri, { depth: .05, bevelEnabled: false }), roof === 'slate' ? C.tuf : C.woodL, s * (W / 2 + .02), top, 0, 0, Math.PI / 2);
    }
    const slope = Math.atan2(rise, D / 2), len = (D / 2 + over) / Math.cos(slope), thick = roof === 'thatch' ? .14 : .08;
    for (const s of [-1, 1]) k.at(0, top + rise + .03, 0, 0, () => {
      k.add(roof === 'thatch' ? k.jitter(cbox(W + .4, thick, len + .05, .04), .02) : cbox(W + .36, thick, len + .04, .02), roofs[0], 0, -.04, s * len / 2);
      for (let row = 0; row < 3; row++) k.add(roof === 'thatch' ? k.jitter(cbox(W + .44, .09, len / 3 + .07, .03), .02) : cbox(W + .38, .05, len / 3 + .05, .012), roofs[1 + row % 2], 0, .03 + row * .015, s * (len - (row + .5) * len / 3 + .03));
    }, s * slope);
    k.add(roof === 'thatch' ? k.jitter(new THREE.CylinderGeometry(.1, .1, W + .5, 7), .02) : cbox(W + .42, .08, .12, .02), roofs[3], 0, top + rise + (roof === 'thatch' ? .08 : .02), 0, 0, 0, roof === 'thatch' ? Math.PI / 2 : 0);
    // porte et fenêtre éclairée en façade (+z)
    k.add(cbox(.26, .46, .04, .01), C.woodM, -W / 2 + .3, .1, D / 2 + .02);
    k.add(cbox(.18, .16, .03, .005), C.window, W / 2 - .3, .42, D / 2 + .015, 0, 0, 0, true);
    k.add(cbox(.24, .04, .07, .01), C.woodD, W / 2 - .3, .37, D / 2 + .03);
  });
  return .1 + H;
}
/** fumée de cheminée (animée par updSmoke) */
function smoke(g: any, b: any, x: number, y: number, z: number) {
  b.smoke = b.smoke || [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.08, 0), new THREE.MeshStandardMaterial({ color: 0xe9e4dc, flatShading: true, transparent: true, opacity: .8, depthWrite: false }));
    m.userData = { t: i / 4, x, y, z }; g.add(m); b.smoke.push(m);
  }
}
const ground = (k: Kit, color: number, w = 2.0, d = 2.0) => k.add(k.jitter(cbox(w, .22, d), .04), color, 0, -.16, 0);
const barrel = (k: Kit, x: number, y: number, z: number, top = P.woodEnd) => k.at(x, y, z, 0, () => { k.add(cyl(.1, .1, .24, 8), P.woodM); k.add(cyl(.11, .11, .1, 8), P.woodM, 0, .07); for (const yy of [.03, .19]) k.add(cyl(.105, .105, .025, 8), P.iron, 0, yy); k.add(cyl(.085, .085, .012, 8), top, 0, .235) });
const pole = (k: Kit, x: number, y: number, z: number, h: number) => k.add(cyl(.02, .02, h, 5), P.woodDD, x, y, z);

// =====================================================================
// Ferme à blé (3 × 3 cases) : champ en sillons, chaumière, meules, épouvantail
// =====================================================================
export function buildFarm(g: any, b: any) {
  const k = new Kit(b.id * 1499 + 29), team = teamPal(b.team), C = P;
  ground(k, C.dirt, 3.0, 3.0);
  // sillons du champ
  for (let r = 0; r < 7; r++) k.add(k.jitter(cbox(.28, .06, 2.7), .015), r % 2 ? 0x6a4a2a : 0x7a5632, -1.35 + r * .32 + .15, 0, 0);
  // clôture basse autour du champ
  for (const z of [-1.42, 1.42]) { for (let x = -1.45; x <= .8; x += .45) k.add(cbox(.06, .32, .06, .01), C.woodM, x, 0, z); k.add(cbox(2.3, .04, .03, .008), C.woodL, -.35, .22, z) }
  for (let z = -1.42; z <= 1.43; z += .47) k.add(cbox(.06, .32, .06, .01), C.woodM, -1.47, 0, z);
  k.add(cbox(.03, .04, 2.85, .008), C.woodL, -1.47, .22, 0);
  // chaumière dans le coin, meules de foin, épouvantail aux couleurs du royaume
  cottage(k, 1.05, -.85, .8, .9, .55, 'thatch', .5);
  for (const [x, z] of [[1.0, .45], [1.22, .62], [1.05, .78]]) k.at(x, 0, z, k.rnd() * 2, () => { k.add(k.jitter(cyl(.16, .17, .2, 8), .02), C.straw); k.add(k.jitter(cone(.165, .14, 8), .02), 0xc9a24c, 0, .2) });
  k.at(.3, 0, .9, 0, () => {
    k.add(cyl(.02, .025, .75, 5), C.woodD); k.add(cbox(.03, .03, .5, .008), C.woodD, 0, .5, 0);
    k.add(cbox(.12, .2, .2, .03), team.main, 0, .38, 0); k.add(k.jitter(new THREE.IcosahedronGeometry(.08, 0), .02), C.cloth, 0, .66, 0);
    k.add(cyl(.13, .13, .02, 8), C.straw, 0, .72); k.add(cone(.07, .08, 6), C.straw, 0, .73);
    for (const s of [-1, 1]) k.add(cone(.03, .1, 4), C.straw, 0, .5, s * .27, 0, 0, s * Math.PI / 2);
  });
  pole(k, 1.35, 0, 1.3, 1.1);
  k.build(g);
  flagPivot(g, b, 1.35, 1.08, 1.3, .32, .2, team, k);
  // le blé : une touffe stylisée par pied, teintée et haussée par la scène selon la pousse (b.wheat)
  const W = new Kit(b.id + 3);
  for (let r = 0; r < 7; r++) for (let i = 0; i < 9; i++) {
    const x = -1.35 + r * .32 + .15 + (W.rnd() - .5) * .06, z = -1.2 + i * .3 + (W.rnd() - .5) * .06;
    W.add(cone(.05, .32, 5), 0xffffff, x, 0, z, (W.rnd() - .5) * .2, 0, (W.rnd() - .5) * .2);
    W.add(cone(.04, .26, 5), 0xf2f2f2, x + .05, 0, z + .04, (W.rnd() - .5) * .3, 0, (W.rnd() - .5) * .3);
  }
  const wm = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x7aa83c, flatShading: true, roughness: .9 });
  const wheat = mk(merge(W.parts), wm, 0, .06, 0); wheat.receiveShadow = false; g.add(wheat); b.wheat = wheat;
}

// =====================================================================
// Armurerie (2 × 2 cases) : réserve de pierre aux armes, râtelier, les armes rangées s'empilent devant (b.pile)
// =====================================================================
export function buildArmory(g: any, b: any) {
  const k = new Kit(b.id * 977 + 31), team = teamPal(b.team), C = P;
  ground(k, C.dirt);
  const W = 1.4, D = .9, H = .8;
  k.at(-.05, 0, -.42, 0, () => {
    k.add(k.stone(W + .14, .14, D + .14, .02), C.stoneD);
    k.add(cbox(W, H, D, .03), C.stoneL, 0, .12);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) { const big = i % 2; k.add(k.stone(big ? .26 : .16, .19, big ? .16 : .26, .012), k.pick([C.stoneM, C.stoneL2, C.stoneD]), sx * (W / 2 - (big ? .1 : .05)), .14 + i * .2, sz * (D / 2 - (big ? .05 : .1))) }
    for (let i = 0; i < 10; i++) { const u = (k.rnd() - .5) * (W - .4); if (Math.abs(u) < .28) continue; k.add(k.stone(.16 + k.rnd() * .1, .09 + k.rnd() * .05, .04, .01), k.pick([C.stoneM, C.stoneL2]), u, .25 + k.rnd() * .5, D / 2 + .005) }
    // toit de tuiles à quatre pans aux couleurs du royaume
    k.add(k.stone(W + .1, .08, D + .1, .01), C.stoneM, 0, H + .1);
    k.add(frustum4(1.05, .55, .32), team.main, 0, H + .18); k.add(frustum4(.6, .001, .36), team.light, 0, H + .48);
    // porte bardée de fer, écu aux épées croisées
    k.add(arch(.34, .5, .05), C.woodM, 0, .12, D / 2 + .02);
    for (const y of [.22, .42]) k.add(cbox(.34, .04, .02, .006), C.iron, 0, .12 + y, D / 2 + .05);
    k.at(0, .78, D / 2 + .05, 0, () => {
      k.add(new THREE.CylinderGeometry(.15, .15, .04, 8), team.main, 0, 0, 0, Math.PI / 2);
      k.add(new THREE.CylinderGeometry(.155, .155, .02, 8), C.gold, 0, 0, -.015, Math.PI / 2);
      for (const s of [-1, 1]) k.add(cbox(.025, .36, .015, .005), C.steel, 0, -.18, .03, 0, 0, s * .6);
    });
  });
  // râtelier de lances sur le côté
  k.at(.82, 0, .05, -Math.PI / 2, () => {
    for (const x of [-.22, .22]) k.add(cyl(.025, .03, .62, 5), C.woodD, x, 0, 0);
    for (const y of [.16, .5]) k.add(cbox(.5, .04, .05, .01), C.woodD, 0, y, 0);
    for (let i = 0; i < 4; i++) { const x = -.15 + i * .1; k.add(cyl(.012, .012, .8, 4), C.woodL, x, 0, .05, -.18); k.add(cone(.025, .1, 4), C.steel, x, .8 * Math.cos(.18) - .02, .05 - .8 * Math.sin(.18), -.18) }
  });
  barrel(k, -.78, .06, .72); pole(k, -.85, .06, -.9, 1.5);
  k.build(g);
  flagPivot(g, b, -.85, 1.54, -.9, .34, .2, team, k);
  b.pile = new THREE.Group(); b.pile.position.set(-.45, .06, .55); g.add(b.pile);
}

// =====================================================================
// Atelier d'arcs (2 × 2) : chaumière d'artisan, auvent, douelles qui sèchent, cible
// =====================================================================
export function buildBowyer(g: any, b: any) {
  const k = new Kit(b.id * 761 + 37), team = teamPal(b.team), C = P;
  ground(k, C.dirtL);
  cottage(k, -.15, -.38, 1.2, .9, .6, 'thatch');
  // auvent devant l'atelier, établi avec des arcs en cours
  for (const x of [-.65, .35]) k.add(cyl(.03, .035, .72, 5), C.woodD, x, 0, .3);
  k.at(-.15, .78, .1, 0, () => k.add(cbox(1.15, .05, .55, .015), C.shingleD), -.3);
  k.add(cbox(.7, .05, .22, .01), C.woodL, -.15, .34, .2); for (const x of [-.45, .15]) k.add(cbox(.05, .34, .18, .01), C.woodD, x, 0, .2);
  for (let i = 0; i < 2; i++) k.add(new THREE.TorusGeometry(.2, .014, 4, 10, Math.PI * .75), C.wood, -.3 + i * .25, .41, .2 - i * .03, Math.PI / 2, 0, i * .4);
  // râtelier de douelles d'if qui sèchent
  k.at(.7, 0, .55, -.5, () => { for (const x of [-.18, .18]) k.add(cyl(.02, .025, .6, 5), C.woodD, x, 0, 0); k.add(cbox(.44, .035, .035, .008), C.woodD, 0, .55, 0); for (let i = 0; i < 6; i++) k.add(cyl(.012, .012, .62, 4), k.pick([0xc89a5a, 0xb07a45, C.woodL]), -.15 + i * .06, 0, .06, -.1) });
  // petite cible d'essai
  k.at(.75, 0, -.55, -.9, () => { k.add(cyl(.02, .02, .45, 5), C.woodD, 0, 0, -.04, .2); k.at(0, .3, 0, 0, () => { k.add(new THREE.CylinderGeometry(.16, .16, .07, 10), C.straw, 0, 0, 0, Math.PI / 2); for (const [r, c] of [[.12, 0xf2ece0], [.08, 0xc9402e], [.035, C.gold]] as [number, number][]) k.add(new THREE.CylinderGeometry(r, r, .01, 10), c, 0, 0, .04, Math.PI / 2) }) });
  pole(k, .85, .06, .9, 1.2);
  k.build(g);
  flagPivot(g, b, .85, 1.24, .9, .3, .18, team, k);
}

// =====================================================================
// Atelier de lances (2 × 2) : atelier de bardeaux, perches de frêne, chevalet, pointes
// =====================================================================
export function buildSpearmaker(g: any, b: any) {
  const k = new Kit(b.id * 541 + 41), team = teamPal(b.team), C = P;
  ground(k, C.dirtL);
  cottage(k, -.2, -.4, 1.15, .85, .62, 'shingle');
  // perches appuyées contre le mur et faisceau de lances finies
  for (let i = 0; i < 5; i++) k.add(cyl(.016, .016, 1.1, 4), k.pick([C.woodL, 0xc89a5a]), .45 + i * .07, .02, .05, -.25, 0, .05);
  k.at(.75, 0, .55, 0, () => { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; k.at(Math.cos(a) * .06, 0, Math.sin(a) * .06, 0, () => { k.add(cyl(.014, .014, .95, 4), C.woodL); k.add(cone(.03, .1, 4), C.steel, 0, .95) }, Math.sin(a) * .12, -Math.cos(a) * .12) } k.add(cyl(.09, .09, .04, 8), C.leatherD, 0, .45) });
  // chevalet avec une perche à dégrossir, copeaux, caisse de pointes
  k.at(-.2, 0, .45, 0, () => { for (const s of [-1, 1]) for (const t of [-1, 1]) k.add(cbox(.04, .4, .04, .008), C.woodD, s * .28, 0, t * .08, t * .25); k.add(cbox(.65, .05, .08, .01), C.woodM, 0, .36, 0); k.add(new THREE.CylinderGeometry(.02, .02, .9, 5), C.woodL, 0, .42, 0, 0, 0, Math.PI / 2) });
  for (let i = 0; i < 10; i++) k.add(cbox(.04, .01, .02, .003), C.woodEnd, -.2 + (k.rnd() - .5) * .7, .06, .5 + (k.rnd() - .5) * .3, 0, k.rnd() * 3);
  k.at(-.75, .06, .6, .3, () => { k.add(cbox(.24, .16, .2, .02), C.woodL); for (let i = 0; i < 4; i++) k.add(cone(.025, .08, 4), C.steel, -.06 + i * .04, .16, 0, 0, 0, Math.PI / 2) });
  pole(k, .85, .06, -.9, 1.5);
  k.build(g);
  flagPivot(g, b, .85, 1.54, -.9, .32, .2, team, k);
}

// =====================================================================
// Atelier de flèches (2 × 2) : hutte ronde au chaume conique, tonneaux de flèches, plumes qui sèchent
// =====================================================================
export function buildFletcher(g: any, b: any) {
  const k = new Kit(b.id * 307 + 43), team = teamPal(b.team), C = P;
  ground(k, C.dirtL);
  k.at(-.3, 0, -.3, 0, () => {
    k.add(k.jitter(cyl(.62, .64, .12, 10), .02), C.stoneM);
    k.add(cyl(.55, .57, .6, 10), 0xe8dcc0, 0, .1);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; k.add(cbox(.06, .62, .06, .01), C.woodDD, Math.cos(a) * .56, .1, Math.sin(a) * .56) }
    k.add(k.jitter(cone(.82, .5, 10), .03), 0xb8923f, 0, .68); k.add(k.jitter(cone(.6, .45, 10), .03), C.straw, 0, .9); k.add(k.jitter(cone(.32, .32, 10), .02), 0xc9a24c, 0, 1.2);
    k.add(cbox(.26, .44, .05, .01), C.woodM, .35, .1, .44, 0, .65, 0);
    k.add(cbox(.16, .14, .04, .005), C.window, -.4, .4, .38, 0, -.75, 0, true);
  });
  // tonneaux pleins de flèches (plumes blanches et rouges)
  for (const [x, z] of [[.55, .3], [.75, .5]]) { barrel(k, x, .06, z, C.woodD); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; k.add(cyl(.006, .006, .22, 3), C.woodL, x + Math.cos(a) * .05, .3, z + Math.sin(a) * .05, Math.sin(a) * .2, 0, Math.cos(a) * .2); k.add(cbox(.018, .05, .018, .004), i % 2 ? C.white : 0xc9402e, x + Math.cos(a) * .07, .5, z + Math.sin(a) * .07) } }
  // corde à plumes entre deux poteaux, établi
  for (const x of [-.75, .1]) k.add(cyl(.02, .025, .62, 5), C.woodD, x, .06, .75);
  k.add(cyl(.005, .005, .85, 3), 0xe6dcc2, -.32, .64, .75, 0, 0, Math.PI / 2);
  for (let i = 0; i < 8; i++) k.add(cbox(.02, .07, .03, .005), i % 3 ? C.white : 0xc9402e, -.68 + i * .1, .55, .75);
  k.add(cbox(.5, .05, .22, .01), C.woodL, .45, .32, -.55); for (const x of [.25, .65]) k.add(cbox(.04, .32, .18, .008), C.woodD, x, 0, -.55);
  for (let i = 0; i < 4; i++) k.add(cyl(.006, .006, .3, 3), C.woodL, .32 + i * .08, .38, -.55, Math.PI / 2);
  pole(k, .85, .06, -.88, 1.3);
  k.build(g);
  flagPivot(g, b, .85, 1.34, -.88, .3, .18, team, k);
}

// =====================================================================
// Mine de fer (2 × 2, sur le gisement du centre) : butte rocheuse, galerie boisée, wagonnet de minerai
// =====================================================================
export function buildMine(g: any, b: any) {
  const k = new Kit(b.id * 211 + 47), team = teamPal(b.team), C = P;
  ground(k, 0x6b5e52);
  const rockC = [0x5a4f48, 0x6a5d55, 0x4a423d, 0x7a6c62];
  // butte de roche sombre au fond, veines de minerai rouille
  for (let i = 0; i < 16; i++) { const a = (k.rnd() - .5) * Math.PI * 1.1, r = .3 + k.rnd() * .55; k.add(k.rock(.22 + k.rnd() * .2, .25), k.pick(rockC), Math.sin(a) * r * 1.1, .05 + k.rnd() * .2, -.45 - Math.cos(a) * r * .5, 0, k.rnd() * 6) }
  k.add(k.jitter(cone(.85, .9, 8), .1), 0x5a4f48, 0, 0, -.55); k.add(k.jitter(cone(.55, .5, 7), .08), 0x6a5d55, -.35, .5, -.7);
  for (let i = 0; i < 9; i++) k.add(k.rock(.06 + k.rnd() * .05), k.pick([0xc8642c, 0xa8501e]), (k.rnd() - .5) * 1.2, .3 + k.rnd() * .5, -.4 - k.rnd() * .3);
  // entrée de galerie : deux poteaux, un linteau, le noir de la galerie, une lanterne
  k.at(0, 0, -.12, 0, () => {
    k.add(cbox(.5, .58, .3, .03), C.dark, 0, 0, -.05);
    for (const s of [-1, 1]) k.add(cbox(.08, .64, .08, .015), C.woodM, s * .27, 0, .1);
    k.add(cbox(.68, .09, .1, .02), C.woodD, 0, .62, .1);
    k.add(cbox(.06, .08, .06, .01), C.window, .27, .5, .17, 0, 0, 0, true);
  });
  // rails et wagonnet chargé de minerai
  for (const s of [-1, 1]) k.add(cbox(.025, .025, 1.0, .005), C.iron, s * .12, .06, .45);
  for (let i = 0; i < 5; i++) k.add(cbox(.34, .025, .06, .008), C.woodD, 0, .04, .02 + i * .21);
  k.at(0, .09, .55, 0, () => {
    k.add(cbox(.3, .18, .34, .02), C.woodM, 0, .04, 0); for (const y of [.08, .18]) k.add(cbox(.31, .025, .35, .005), C.iron, 0, y, 0);
    for (const sx of [-1, 1]) for (const sz of [-.1, .1]) k.add(new THREE.CylinderGeometry(.05, .05, .03, 8), C.iron, sx * .16, .03, sz, 0, 0, Math.PI / 2);
    for (let i = 0; i < 6; i++) k.add(k.rock(.06), k.pick([0xc8642c, 0x5a4f48, 0xa8501e]), (k.rnd() - .5) * .18, .24, (k.rnd() - .5) * .22);
  });
  k.at(-.7, .06, .55, .5, () => { k.add(cyl(.014, .016, .45, 5), C.woodL, 0, 0, 0, 0, 0, .35); k.add(cbox(.28, .04, .04, .01), C.iron, -.12, .42, 0, 0, 0, .35) });
  for (let i = 0; i < 6; i++) k.add(k.rock(.05 + k.rnd() * .04), k.pick([0xc8642c, 0x5a4f48]), .55 + (k.rnd() - .5) * .3, .06, .6 + (k.rnd() - .5) * .3);
  pole(k, .8, .06, -.85, 1.5);
  k.build(g);
  flagPivot(g, b, .8, 1.54, -.85, .32, .2, team, k);
}

// =====================================================================
// Forge (2 × 2) : halle ouverte sous bardeaux, foyer de pierre rougeoyant, enclume, cheminée qui fume
// =====================================================================
export function buildForge(g: any, b: any) {
  const k = new Kit(b.id * 103 + 53), team = teamPal(b.team), C = P;
  ground(k, 0x7a6a58);
  // mur de fond en pierre, poteaux, toit de bardeaux à un pan
  k.add(k.stone(1.7, .9, .22, .02), C.stoneM, 0, .06, -.72);
  for (const x of [-.8, .8]) for (const z of [-.6, .45]) k.add(cyl(.045, .05, .95, 6), C.woodD, x, .06, z);
  k.at(0, 1.05, -.1, 0, () => { k.add(cbox(1.95, .08, 1.45, .02), C.shingleD); for (let r = 0; r < 3; r++) k.add(cbox(1.97, .05, .5, .012), r % 2 ? C.shingle : C.shingleL, 0, .06 + r * .012, .5 - r * .45) }, .22);
  // foyer de pierre avec braises, cheminée
  k.at(-.45, .06, -.45, 0, () => {
    k.add(k.stone(.6, .4, .45, .02), C.stoneD);
    k.add(k.jitter(cbox(.4, .06, .3, .02), .02), 0xff7a2a, 0, .4, .02, 0, 0, 0, true);
    for (let i = 0; i < 5; i++) k.add(k.rock(.05), 0x3a2a22, (k.rnd() - .5) * .3, .45, (k.rnd() - .5) * .2);
    for (let i = 0; i < 9; i++) k.add(k.stone(i < 4 ? .42 : .32, .17, i < 4 ? .36 : .28, .02), k.pick([C.stoneM, C.stoneD, C.stoneL2]), 0, .4 + i * .16, -.12, 0, k.rnd() * .2);
    k.add(k.stone(.4, .06, .34, .01), C.stoneDD, 0, .4 + 9 * .16, -.12);
  });
  // soufflet, enclume sur sa souche, baquet de trempe, râtelier d'épées
  k.at(-.05, .06, -.5, 0, () => { k.add(cbox(.26, .08, .16, .03), C.leatherD, 0, .32, 0, 0, 0, .15); k.add(cbox(.3, .03, .16, .01), C.woodM, 0, .28, 0); k.add(cyl(.02, .02, .2, 5), C.iron, .2, .3, 0, 0, 0, Math.PI / 2) });
  k.at(.25, .06, .1, .3, () => { k.add(cyl(.13, .15, .3, 8), C.woodD); k.add(cbox(.28, .1, .12, .02), C.iron, 0, .3, 0); k.add(cone(.05, .12, 4), C.iron, .19, .35, 0, 0, 0, -Math.PI / 2); k.add(cbox(.18, .05, .1, .01), C.iron, 0, .4, 0) });
  k.at(.65, .06, .55, 0, () => { k.add(cyl(.17, .15, .22, 8), C.woodM); k.add(cyl(.175, .175, .025, 8), C.iron, 0, .15); k.add(cyl(.14, .14, .01, 8), 0x4b86ad, 0, .2) });
  k.at(.7, .06, -.55, 0, () => { k.add(cbox(.5, .05, .06, .01), C.woodD, 0, .5, 0); for (const x of [-.22, .22]) k.add(cbox(.05, .55, .05, .01), C.woodD, x, 0, 0); for (let i = 0; i < 3; i++) k.add(cbox(.03, .45, .012, .005), C.steel, -.12 + i * .12, .04, .04) });
  pole(k, -.85, .06, .85, 1.4);
  k.build(g);
  flagPivot(g, b, -.85, 1.44, .85, .32, .2, team, k);
  smoke(g, b, -.45, .06 + .4 + 9 * .16 + .12, -.57);
}
