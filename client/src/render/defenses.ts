// Les défenses en low poly stylisé, comme les autres bâtiments : murs (palissade de rondins ou tuffeau taillé) avec chemin
// de ronde et créneaux légers, portes, escaliers de bois et tours. Un segment de mur se raccorde à ses voisins : les
// créneaux ne bordent que les côtés libres, et deux segments en diagonale sont reliés par un pan de mur.
// Les hauteurs du chemin de ronde suivent TOP_H (shared/src/config.ts) : c'est là que se tiennent les soldats montés.
import * as THREE from 'three';
import { DEF, G, TOP_H } from '@ffl/shared';
import { Kit, P, cbox, cyl, cone, arch, teamPal } from './stylized';

// voisins d'un segment : bits N, E, S, O puis diagonales NE, SE, SO, NO
const N = 1, E = 2, S = 4, Wb = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS: [number, number, number][] = [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, Wb], [1, -1, NE], [1, 1, SE], [-1, 1, SW], [-1, -1, NW]];
const linkable = (b: any) => { const d = DEF[b.type].def; return d === 'mur' || d === 'porte' || d === 'tour' };
/** quels voisins d'une défense sont aussi des murs, portes ou tours du même joueur */
export function defMask(b: any) {
  if (!DEF[b.type].def || DEF[b.type].w > 1) return 0;
  let m = 0;
  for (const o of G.buildings) {
    if (o === b || o.dead || o.team !== b.team || !DEF[o.type].def || !linkable(o)) continue;
    for (const [dx, dy, bit] of DIRS) { const x = b.tx + dx, y = b.ty + dy; if (x >= o.tx && x < o.tx + DEF[o.type].w && y >= o.ty && y < o.ty + DEF[o.type].h) m |= bit }
  }
  return m;
}

/** merlons le long d'un bord libre (repère du segment : bord à z = -0.5, le long de x) */
function merlons(k: Kit, wood: boolean, y: number, len = 1, x0 = 0) {
  if (wood) for (let x = -len / 2 + .07; x < len / 2 - .02; x += .135) { k.add(cyl(.045, .05, .2, 5), k.pick([P.woodM, P.woodD, P.woodL]), x0 + x, y, -.46); k.add(cone(.05, .09, 5), P.woodD, x0 + x, y + .2, -.46) }
  else for (const x of len > .6 ? [-.25, .25] : [0]) { k.add(k.stone(.24, .22, .13, .015), k.pick([P.tufL, P.tuf]), x0 + x * len, y, -.435) }
}
/** un pan de mur (corps + parements) sur la case, de hauteur H, avec les côtés libres parementés */
function wallBody(k: Kit, wood: boolean, H: number, mask: number) {
  if (wood) {
    // levée de terre et charpente, habillée de rondins verticaux sur les faces libres, plancher de chemin de ronde
    k.add(cbox(.96, H - .06, .96, .03), P.woodD, 0, 0, 0);
    for (const [bit, ry] of [[N, 0], [E, -Math.PI / 2], [S, Math.PI], [Wb, Math.PI / 2]] as [number, number][]) {
      if (mask & bit) continue;
      k.at(0, 0, 0, ry, () => { for (let x = -.44; x <= .45; x += .11) { const h = H - .04 + (k.rnd() - .5) * .05; k.add(cyl(.058, .062, h, 6), k.pick([P.woodM, P.woodL, P.woodM, P.woodD]), x, 0, -.47) }
        k.add(cbox(1.0, .05, .04, .01), P.woodDD, 0, H * .3, -.53); k.add(cbox(1.0, .05, .04, .01), P.woodDD, 0, H * .72, -.53) });
    }
    for (let z = -.42; z <= .43; z += .14) k.add(cbox(.98, .05, .13, .01), k.pick([P.woodL, P.woodM]), 0, H - .05, z);
  } else {
    // tuffeau : assises de pierres décalées sur les faces libres, dalles du chemin de ronde
    k.add(cbox(.98, H - .04, .98, .02), P.tufM, 0, 0, 0);
    for (const [bit, ry] of [[N, 0], [E, -Math.PI / 2], [S, Math.PI], [Wb, Math.PI / 2]] as [number, number][]) {
      if (mask & bit) continue;
      k.at(0, 0, 0, ry, () => { const rowH = .2;
        for (let r = 0; r * rowH < H - .08; r++) { let x = -.5, first = r % 2 ? .13 : 0;
          while (x < .49) { let len = first || .22 + k.rnd() * .14; first = 0; if (x + len > .5) len = .5 - x; if (len > .05) k.add(k.stone(len - .015, rowH - .015, .06, .012), k.pick([P.tufL, P.tufL, P.tuf, P.tufM]), x + len / 2, r * rowH, -.48); x += len } } });
    }
    k.add(cbox(1.0, .05, 1.0, .01), P.tufD, 0, H - .05, 0);
    for (let i = 0; i < 4; i++) k.add(k.stone(.46, .025, .46, .01), k.pick([P.tuf, P.tufM]), i % 2 ? .24 : -.24, H - .005, i < 2 ? -.24 : .24);
    k.add(k.stone(1.04, .09, 1.04, .015), P.stoneD, 0, -.02, 0); // soubassement
  }
}
/** les créneaux du chemin de ronde, sur chaque côté sans voisin */
function battlements(k: Kit, wood: boolean, H: number, mask: number) {
  for (const [bit, ry] of [[N, 0], [E, -Math.PI / 2], [S, Math.PI], [Wb, Math.PI / 2]] as [number, number][]) if (!(mask & bit)) k.at(0, 0, 0, ry, () => merlons(k, wood, H));
}
/** pans de liaison vers les voisins en diagonale (quand les deux cases entre eux sont vides) */
function diagonals(k: Kit, wood: boolean, H: number, mask: number) {
  for (const [bit, a, b2, ang] of [[NE, N, E, -Math.PI / 4], [SE, S, E, Math.PI / 4], [SW, S, Wb, 3 * Math.PI / 4], [NW, N, Wb, -3 * Math.PI / 4]] as [number, number, number, number][]) {
    if (!(mask & bit) || (mask & a) || (mask & b2)) continue;
    k.at(Math.cos(ang) * .5, 0, Math.sin(ang) * .5, -ang, () => {
      k.add(cbox(.62, H - .05, .58, .02), wood ? P.woodM : P.tuf, 0, 0, 0);
      k.add(cbox(.64, .05, .6, .01), wood ? P.woodL : P.tufD, 0, H - .06, 0);
      for (const s of [-1, 1]) k.at(0, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, () => merlons(k, wood, H, .55));
    });
  }
}

export function buildWall(g: any, b: any) {
  const k = new Kit(b.id * 911 + 7), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], mask = b.mask ?? defMask(b);
  wallBody(k, wood, H, mask); battlements(k, wood, H, mask); diagonals(k, wood, H, mask);
  k.build(g);
}
export function buildGate(g: any, b: any) {
  const k = new Kit(b.id * 577 + 3), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], mask = b.mask ?? defMask(b), team = teamPal(b.team);
  // le passage traverse le mur : nord-sud si le mur court d'est en ouest, sinon est-ouest
  const ns = !!(mask & (E | Wb)) || !(mask & (N | S));
  k.at(0, 0, 0, ns ? 0 : Math.PI / 2, () => {
    const side = (x: number) => { if (wood) { for (let i = 0; i < 2; i++) k.add(cyl(.07, .075, H + .18, 6), P.woodM, x + (i - .5) * .1, 0, -.4); k.add(cbox(.24, H, .9, .02), P.woodD, x, 0, 0); k.add(cyl(.07, .075, H + .18, 6), P.woodM, x, 0, .4) }
      else k.add(k.stone(.24, H, 1.0, .02), P.tuf, x, 0, 0) };
    side(-.38); side(.38);
    // linteau et chemin de ronde au-dessus du passage
    k.add(cbox(1.0, H * .3, 1.0, .02), wood ? P.woodD : P.tufM, 0, H * .7, 0);
    k.add(cbox(1.0, .05, 1.0, .01), wood ? P.woodL : P.tufD, 0, H - .05, 0);
    for (const s of [-1, 1]) k.at(0, 0, 0, s > 0 ? 0 : Math.PI, () => {
      // vantaux fermés, cerclés de fer, écu aux couleurs du royaume
      if (wood) { for (let x = -.24; x <= .25; x += .1) k.add(cbox(.09, H * .68, .05, .01), k.pick([P.woodL, P.woodM]), x, 0, -.36) }
      else k.add(arch(.52, H * .72, .05), P.woodM, 0, 0, -.36);
      for (const y of [.18, .45]) k.add(cbox(.54, .04, .02, .005), P.iron, 0, y, -.39);
      k.add(new THREE.CylinderGeometry(.08, .08, .02, 8), team.main, 0, H * .82, -.505, Math.PI / 2);
      merlons(k, wood, H);
    });
  });
  k.build(g);
}
export function buildStair(g: any, b: any) {
  const k = new Kit(b.id * 313 + 5), H = TOP_H.escalier, n = 6, dir = b.dir ?? 0;
  // marches de bois qui montent vers le mur (repère : montée vers -z), sur deux limons et des poteaux
  k.at(0, 0, 0, -dir * Math.PI / 2, () => {
    for (let i = 0; i < n; i++) { const h = H * (i + 1) / n, z = .5 - (i + .5) / n; k.add(cbox(.74, .06, 1 / n + .01, .01), k.pick([P.woodL, P.woodM]), 0, h - .06, z); k.add(cbox(.7, h - .06, .04, .005), P.woodD, 0, 0, z + .5 / n - .02) }
    for (const x of [-.4, .4]) { const len = Math.hypot(1, H); k.add(cbox(.06, .1, len, .01), P.woodDD, x, H / 2 - .05, 0, Math.atan2(H, 1)); k.add(cyl(.035, .035, H + .25, 5), P.woodD, x, 0, -.45); k.add(cbox(.04, .04, len, .005), P.woodM, x, H / 2 + .28, 0, Math.atan2(H, 1)) }
  });
  k.build(g);
}
export function buildTower(g: any, b: any) {
  const k = new Kit(b.id * 733 + 11), wood = DEF[b.type].mat === 'bois', H = TOP_H[b.type], team = teamPal(b.team);
  if (wood) {
    // tour de guet : quatre poteaux, croisillons, plateforme à garde-corps de pieux, petite échelle de service
    for (const [x, z] of [[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]]) { k.add(cyl(.1, .12, H + .05, 7), P.woodM, x, 0, z); k.add(k.stone(.32, .1, .32, .02), P.stoneD, x, 0, z) }
    for (const [ry, z] of [[0, -.72], [0, .72], [Math.PI / 2, -.72], [Math.PI / 2, .72]] as [number, number][]) k.at(0, 0, 0, ry, () => {
      for (const y of [.15, H * .55]) { k.add(cbox(1.5, .06, .06, .01), P.woodD, 0, y, z); k.add(cbox(1.6, .07, .07, .01), P.woodDD, 0, y + .32, z, 0, 0, .38 * (y > .2 ? 1 : -1)) } });
    k.add(cbox(1.8, .12, 1.8, .02), P.woodD, 0, H - .12, 0);
    for (let x = -.8; x <= .81; x += .2) for (let z = -.8; z <= .81; z += .2) if (Math.abs(x) > .7 || Math.abs(z) > .7) { k.add(cyl(.05, .055, .32, 5), k.pick([P.woodM, P.woodL]), x, H, z); k.add(cone(.055, .1, 5), P.woodD, x, H + .32, z) }
    for (let x = -.72; x <= .73; x += .12) k.add(cbox(.11, .03, 1.5, .005), k.pick([P.woodL, P.woodM]), x, H - .01, 0);
  } else {
    // tour ronde de tuffeau : assises de pierre, meurtrières, couronne de merlons
    const R = .86, rows = Math.round(H / .2);
    for (let r = 0; r < rows; r++) { const off = (r % 2) * .2, n = 12; for (let i = 0; i < n; i++) { const a = (i + off) / n * Math.PI * 2; k.add(k.stone(.42, .19, .2, .015), k.pick([P.tufL, P.tufL, P.tuf, P.tufM]), Math.cos(a) * R, r * .2, Math.sin(a) * R, 0, -a + Math.PI / 2) } }
    k.add(cyl(R - .05, R + .02, H, 12), P.tufM, 0, 0, 0);
    k.add(k.stone(2.0, .12, 2.0, .02), P.stoneD, 0, -.04, 0);
    k.add(cyl(R + .1, R + .1, .1, 12), P.tufD, 0, H - .08, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (i % 2) k.add(k.stone(.28, .26, .16, .015), k.pick([P.tufL, P.tuf]), Math.cos(a) * (R + .04), H, Math.sin(a) * (R + .04), 0, -a + Math.PI / 2) }
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) k.add(cbox(.06, .3, .05, .01), P.dark, Math.cos(a) * (R + .02), H * .55, Math.sin(a) * (R + .02), 0, -a + Math.PI / 2);
    k.add(arch(.34, .5, .06), P.woodM, 0, 0, R + .02);
  }
  k.build(g);
  // bannière du royaume au sommet
  const pole = new THREE.Group(); pole.position.set(wood ? .7 : .55, H, wood ? -.7 : -.55);
  const f = new Kit(b.id * 7 + 1); f.add(cyl(.02, .025, .9, 5), P.woodDD, 0, 0, 0); f.build(pole); g.add(pole);
  const piv = new THREE.Group(); piv.position.set(0, .86, 0); pole.add(piv);
  const fk = new Kit(b.id * 13 + 2); fk.add(cbox(.4, .24, .025, .006), team.main, .22, -.24, 0); fk.add(cbox(.08, .08, .02, .02), P.gold, .22, -.12, .014, 0, 0, Math.PI / 4); fk.build(piv);
  b.flags.push(piv);
}
