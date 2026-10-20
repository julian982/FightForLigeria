// Les personnages en low poly stylisé (même style que les bâtiments) : têtes larges, volumes trapus,
// couleurs du royaume sur les tabards, capes, capuches et boucliers. Face vers +x, comme le reste du jeu.
// Chaque type est fusionné en une seule géométrie (couleurs par sommet), une par équipe.
import * as THREE from 'three';
import { Kit, cbox, cyl, cone, teamPal } from './stylized';

const C = {
  skin: 0xe9b98d, skinD: 0xc99670, hairBr: 0x5b3a1e, hairDk: 0x2f2118, hairRx: 0x8a4a1e,
  linen: 0xd9c49a, linenD: 0xbfa77a, trousers: 0x6b5236, leather: 0x7a5230, leatherD: 0x553820,
  boot: 0x3e2a1c, steel: 0xb9c0c8, steelD: 0x8a929b, gold: 0xf0c050, straw: 0xd9b765,
  wood: 0x8f5d35, woodL: 0xb7814f, gambeson: 0xe0d2ae, gambesonD: 0xc4b28a, dark: 0x1c1410, white: 0xf2ece0, red: 0xc9402e, lip: 0x8a4a3a,
};
type Look = { boot: number, legs: number, torso: number, belt: number, arms: number, brow?: number, face?: boolean, skin?: number, skinD?: number, skirt?: number };

/** construction « articulée » (archer, seigneur) : le corps sans les bras ni l'arc, qui sont des pièces à part animées */
let RIG = false;
/** le corps commun : jambes, torse, bras, tête (et visage, sauf sous un heaume) */
function body(k: Kit, t: Look) {
  const skin = t.skin ?? C.skin, skinD = t.skinD ?? C.skinD;
  if (t.skirt !== undefined) { for (const z of [-.06, .06]) k.add(cbox(.1, .06, .08, .02), t.boot, .03, 0, z); k.add(cyl(.15, .2, .27, 8), t.skirt, 0, .03) }
  else for (const z of [-.065, .065]) { k.add(cbox(.12, .1, .1, .025), t.boot, .015, 0, z); k.add(cbox(.09, .17, .09, .02), t.legs, 0, .08, z) }
  k.add(cbox(.2, .25, .3, .05), t.torso, 0, .23);
  k.add(cbox(.215, .045, .315, .012), t.belt, 0, .28);
  k.add(cbox(.02, .035, .045, .006), C.gold, .11, .285, 0);
  if (!RIG) for (const s of [-1, 1]) { k.add(cbox(.09, .2, .085, .025), t.arms, 0, .3, s * .19); k.add(cbox(.075, .075, .075, .02), skin, .005, .245, s * .19) }
  k.add(cbox(.25, .26, .25, .075), skin, 0, .47);
  if (t.face === false) return;
  for (const s of [-1, 1]) {
    k.add(cbox(.03, .055, .04, .008), C.dark, .12, .575, s * .055); k.add(cbox(.012, .016, .014, .003), C.white, .136, .595, s * .055 + .008);
    k.add(cbox(.02, .016, .055, .005), t.brow || C.hairBr, .125, .64, s * .06);
    k.add(cbox(.04, .06, .03, .01), skinD, 0, .55, s * .13);
  }
  k.add(cbox(.05, .055, .05, .016), skinD, .125, .53, 0);
  k.add(cbox(.012, .014, .06, .004), C.lip, .122, .5, 0);
}
function hair(k: Kit, color: number, style: 'short' | 'long') {
  k.add(cbox(.27, style === 'long' ? .08 : .07, .27, .02), color, -.01, .7);
  if (style === 'short') k.add(cbox(.08, .16, .27, .02), color, -.1, .56); else k.add(cbox(.1, .26, .28, .03), color, -.1, .45);
}
function beard(k: Kit, color: number, size = 1) { k.add(cbox(.06, .1 * size, .22, .02), color, .115, .46 - .04 * size, 0); k.add(cbox(.02, .025, .1, .006), color, .13, .53, 0) }
function bow(k: Kit, R: number) {
  if (RIG) return;
  const a = Math.PI * .78;
  k.add(new THREE.TorusGeometry(R, .016, 4, 12, a), C.wood, .07 - R * Math.cos(a / 2), .3, -.24, 0, 0, -a / 2);
  k.add(cbox(.006, 2 * R * Math.sin(a / 2), .006, .002), C.white, .07, .3 - R * Math.sin(a / 2), -.24);
}
function quiver(k: Kit, fletch: number[]) {
  k.add(cyl(.05, .045, .3, 6), C.leatherD, -.15, .22, .06, .3);
  for (let i = 0; i < 3; i++) k.add(cbox(.02, .07, .02, .005), fletch[i], -.15 + (i - 1) * .02, .52, .1 + (i - 1) * .015, .3);
}

/** la lance, debout, la pointe vers le haut (base en 0) */
function spear(k: Kit) { k.add(cyl(.016, .016, 1.35, 5), C.woodL); k.add(cyl(.022, .022, .04, 6), C.steelD, 0, 1.31); k.add(cone(.038, .16, 4), C.steel, 0, 1.35) }
/** le bouclier rond (face selon l'axe y de son repère) */
function shield(k: Kit, T: ReturnType<typeof teamPal>) {
  k.add(new THREE.CylinderGeometry(.17, .17, .035, 10), T.main); k.add(new THREE.CylinderGeometry(.175, .175, .02, 10), C.steelD, 0, -.01);
  k.add(new THREE.CylinderGeometry(.05, .05, .06, 8), C.steel, 0, -.03);
  for (let i = 0; i < 2; i++) k.add(cbox(.02, .038, .3, .004), T.light, 0, -.018, 0, 0, i * Math.PI / 2 + Math.PI / 4);
}
const BUILD: Record<string, (k: Kit, T: ReturnType<typeof teamPal>) => void> = {
  worker(k, T) {
    body(k, { boot: C.boot, legs: C.trousers, torso: C.linen, belt: 0xa98b5e, arms: C.linenD });
    hair(k, C.hairBr, 'short'); beard(k, C.hairBr, .8);
    k.add(cbox(.03, .07, .2, .01), T.main, .1, .43, 0);
    k.add(cyl(.24, .24, .03, 10), C.straw, 0, .7); k.add(cyl(.12, .14, .1, 8), C.straw, 0, .72); k.add(cyl(.145, .145, .025, 8), T.main, 0, .73);
    k.add(cbox(.04, .06, .05, .01), C.leather, -.02, .27, .13);
  },
  archer(k, T) {
    body(k, { boot: C.boot, legs: C.trousers, torso: C.leather, belt: C.leatherD, arms: C.leatherD, brow: C.hairRx });
    hair(k, C.hairRx, 'short');
    k.add(cbox(.03, .28, .17, .008), T.main, .105, .18, 0); k.add(cbox(.06, .06, .02, .02), C.gold, .122, .37, 0, 0, 0, Math.PI / 4);
    k.add(cbox(.28, .2, .29, .05), T.dark, -.02, .62); k.add(cbox(.1, .22, .29, .03), T.dark, -.11, .45);
    k.add(cone(.08, .16, 4), T.dark, -.12, .74, 0, 0, Math.PI / 4, -.6);
    k.add(cbox(.15, .05, .3, .015), T.dark, -.01, .4);
    quiver(k, [C.red, C.white, C.red]); bow(k, .34);
    if (!RIG) k.add(cbox(.03, .06, .03, .006), C.leatherD, .08, .28, -.24);
  },
  lancier(k, T) {
    body(k, { boot: C.boot, legs: C.trousers, torso: C.gambeson, belt: C.leather, arms: C.gambesonD, brow: C.hairDk });
    for (let i = 0; i < 4; i++) k.add(cbox(.205, .008, .305, .002), C.gambesonD, 0, .32 + i * .045);
    hair(k, C.hairDk, 'short'); beard(k, C.hairDk, .5);
    k.add(cbox(.03, .3, .18, .008), T.main, .105, .14, 0); k.add(cbox(.06, .06, .02, .02), C.gold, .122, .36, 0, 0, 0, Math.PI / 4);
    k.add(cyl(.24, .24, .025, 10), C.steelD, 0, .69); k.add(cyl(.13, .155, .1, 8), C.steel, 0, .71); k.add(cyl(.04, .13, .05, 8), C.steel, 0, .81);
    // la lance : manche, bague et pointe dans le même repère incliné
    if (RIG) return; // articulé : lance et bouclier sont des pièces à part (voir rigGeo)
    k.at(.02, .02, .19, 0, () => spear(k), 0, -.05);
    k.at(.08, .3, -.24, 0, () => shield(k, T), Math.PI / 2);
  },
  spadassin(k, T) {
    body(k, { boot: C.steelD, legs: C.steelD, torso: C.steel, belt: C.leatherD, arms: C.steel, face: false });
    for (const s of [-1, 1]) { k.add(cbox(.16, .08, .14, .04), C.steelD, 0, .44, s * .19); k.add(cbox(.085, .08, .085, .02), C.steelD, .005, .24, s * .19) }
    k.add(cbox(.03, .32, .19, .008), T.main, .108, .13, 0);
    k.add(cbox(.032, .2, .035, .006), C.gold, .124, .2, 0); k.add(cbox(.032, .035, .12, .006), C.gold, .124, .34, 0);
    k.add(cbox(.28, .3, .28, .05), C.steel, 0, .46);
    k.add(cbox(.02, .022, .2, .006), C.dark, .14, .62, 0); k.add(cbox(.02, .1, .02, .005), C.dark, .14, .52, 0);
    k.add(cbox(.3, .03, .3, .01), C.steelD, 0, .74);
    k.add(cone(.045, .13, 5), T.main, -.04, .76, 0, 0, 0, -.45);
    k.at(.02, .26, .2, 0, () => {
      k.add(cbox(.045, .5, .016, .006), C.white, 0, .06, 0); k.add(cbox(.05, .035, .17, .008), C.gold, 0, .04, 0);
      k.add(cbox(.03, .09, .03, .006), C.leatherD, 0, -.05, 0); k.add(new THREE.IcosahedronGeometry(.024, 0), C.gold, 0, -.07, 0);
    }, 0, -.55);
    const kite = new THREE.Shape(); kite.moveTo(-.15, .14); kite.lineTo(.15, .14); kite.lineTo(.14, -.04); kite.lineTo(0, -.24); kite.lineTo(-.14, -.04); kite.lineTo(-.15, .14);
    k.add(new THREE.ExtrudeGeometry(kite, { depth: .03, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 1 }), T.main, .1, .38, -.27, 0, Math.PI / 2, 0);
    k.add(cbox(.035, .3, .03, .006), C.gold, .14, .18, -.25); k.add(cbox(.035, .03, .2, .006), C.gold, .14, .4, -.25);
  },
  lord(k, T) {
    body(k, { boot: C.leatherD, legs: T.dark, torso: T.main, belt: C.gold, arms: T.dark });
    hair(k, C.hairBr, 'long'); beard(k, C.hairBr, 1.1);
    k.add(cyl(.15, .15, .06, 8), C.gold, 0, .7);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.add(cone(.03, .07, 4), C.gold, Math.cos(a) * .14, .76, Math.sin(a) * .14) }
    k.add(new THREE.IcosahedronGeometry(.025, 0), C.red, .15, .73, 0);
    k.add(cbox(.04, .48, .38, .015), T.dark, -.12, .03, 0, 0, 0, -.06);
    k.add(cbox(.22, .06, .34, .03), C.white, -.01, .45);
    k.add(cbox(.025, .14, .1, .01), C.gold, .105, .3, 0);
    quiver(k, [C.white, C.white, C.white]); bow(k, .38);
    if (!RIG) for (const y of [.28, .36]) k.add(cbox(.03, .025, .03, .006), C.gold, .08, y, -.24);
  },
};
/** taille de chaque personnage dans le jeu (le seigneur domine, l'ouvrier est plus petit) */
export const PEOPLE_SCALE: Record<string, number> = { lord: 1.3, worker: .85, archer: 1, lancier: 1, spadassin: 1.12 };

/** géométrie fusionnée d'un personnage pour une équipe */
export function personGeo(type: string, team: number) {
  const k = new Kit(1), T = teamPal(team), s = PEOPLE_SCALE[type] || 1;
  (BUILD[type] || BUILD.archer)(k, T);
  const g = new THREE.Group(); k.build(g);
  const geo = (g.children[0] as any).geometry; geo.scale(s, s, s); return geo;
}

// ---------------------------------------------------------------------
// Ouvriers tous différents : mêmes traits que leur portrait (peau, cheveux, barbe, coiffe, homme ou femme)
// ---------------------------------------------------------------------
const SKINS = [0xf1cfa8, 0xe0b48a, 0xc08a5e, 0x8d5f3c];
const HAIRS = [0x3a2516, 0x5b3a1e, 0x1f1712, 0x8a4a1e, 0xc9a25a, 0xb9b3a8];
const TUNICS = [0xd9c49a, 0xb59a6a, 0x9a8a6a, 0xc7b38a];
const DRESSES = [0xa9523b, 0x6e7d4a, 0x5b6f8a, 0xb88a4a];
const HOODS = [0x6b4a2c, 0x4f5b34, 0x7a3a2a];
type Face = { skin: number, hair: number, hairStyle: number, hat: number, beard: number };
/** clé de cache : deux ouvriers aux mêmes traits partagent la même géométrie */
export const workerKey = (female: boolean, f: Face, id: number) => [female ? 'f' : 'm', f.skin, f.hair, f.hairStyle, f.hat, f.beard, id % 4].join('');
export function workerGeo(female: boolean, f: Face, id: number, team: number) {
  const k = new Kit(id + 1), T = teamPal(team), skin = SKINS[f.skin], skinD = new THREE.Color(skin).multiplyScalar(.84).getHex(), hc = HAIRS[f.hair];
  if (female) body(k, { boot: C.boot, legs: C.trousers, torso: DRESSES[id % 4], belt: 0xa98b5e, arms: DRESSES[id % 4], brow: hc, skin, skinD, skirt: DRESSES[id % 4] });
  else body(k, { boot: C.boot, legs: C.trousers, torso: TUNICS[id % 4], belt: 0xa98b5e, arms: new THREE.Color(TUNICS[id % 4]).multiplyScalar(.88).getHex(), brow: hc, skin, skinD });
  if (female) { k.add(cbox(.03, .24, .17, .008), 0xf2ece0, .105, .06, 0); k.add(cbox(.025, .03, .18, .006), 0xf2ece0, .11, .28, 0) }   // tablier
  // cheveux
  if (f.hat !== 4) {
    if (female || f.hairStyle === 2) hair(k, hc, 'long'); else hair(k, hc, 'short');
    if (female) k.add(new THREE.IcosahedronGeometry(.06, 0), hc, -.15, .66, 0);   // chignon
  }
  if (!female && f.beard === 1) beard(k, hc, .7);
  if (!female && f.beard === 2) beard(k, hc, 1.15);
  if (!female && f.beard === 3) k.add(cbox(.025, .03, .12, .008), hc, .13, .52, 0);
  // couvre-chefs
  if (f.hat === 1) { k.add(cyl(.24, .24, .03, 10), C.straw, 0, .7); k.add(cyl(.12, .14, .1, 8), C.straw, 0, .72); k.add(cyl(.145, .145, .025, 8), T.main, 0, .73) }
  if (f.hat === 2) { const h = HOODS[id % 3]; k.add(cbox(.28, .2, .29, .05), h, -.02, .62); k.add(cbox(.1, .22, .29, .03), h, -.11, .45); k.add(cbox(.15, .05, .3, .015), h, -.01, .4) }
  if (f.hat === 3) { k.add(cyl(.15, .15, .06, 8), 0x6b4a2c, 0, .69); k.add(cyl(.1, .14, .07, 8), 0x7a5634, 0, .75) }
  if (f.hat === 4) { k.add(cbox(.28, .14, .28, .05), 0xf2ece0, -.01, .63); k.add(cbox(.12, .2, .28, .03), 0xf2ece0, -.1, .48); k.add(cbox(.02, .04, .27, .006), 0xd8ccb4, .13, .66, 0) }
  // foulard aux couleurs du royaume (tous les ouvriers le portent : c'est ce qui les distingue d'un camp à l'autre)
  k.add(cbox(.03, .07, .2, .01), T.main, .1, .41, 0);
  if (!female) k.add(cbox(.04, .06, .05, .01), C.leather, -.02, .27, .13);
  const g = new THREE.Group(); k.build(g);
  const geo = (g.children[0] as any).geometry; const s = PEOPLE_SCALE.worker * (female ? .95 : 1); geo.scale(s, s, s); return geo;
}

// ---------------------------------------------------------------------
// Archer et seigneur articulés : le bras d'arc, l'arc, la corde, le bras qui tire et la flèche encochée sont des pièces
// séparées que render/sync.ts anime (bander, viser, relâcher). Repères : épaules en (0, .5, ±.19) ; la main est au bout
// du bras, à .22 sous l'épaule ; (les formes du kit sont posées par leur base : d'où les décalages de moitié) l'arc est dans le repère de la main, son ventre devant la main (+x), la corde derrière.
// ---------------------------------------------------------------------
export const RIG_TYPES = new Set(['archer', 'lord', 'lancier']);
/** la lance est tenue à .26 de sa base (la main du lancier) */
export const SPEAR_GRIP = .26;
export const SHOULDER = { y: .5, z: .19 }, ARM_LEN = .22;
const BOW_R: Record<string, number> = { archer: .34, lord: .38 }, BOW_A = Math.PI * .78;
/** extrémités de la corde (repère de la main) */
export function bowTips(type: string) { const R = BOW_R[type] || .34; return { x: -R + R * Math.cos(BOW_A / 2), h: R * Math.sin(BOW_A / 2), z: -.03 } }
const one = (fn: (k: Kit) => void) => { const k = new Kit(1); fn(k); const g = new THREE.Group(); k.build(g); return (g.children[0] as any).geometry };
const rigCache: Record<string, any> = {};
/** à appeler quand les couleurs des équipes changent */
export function clearRigCache() { for (const k in rigCache) delete rigCache[k] }
export function rigGeo(type: string, team: number) {
  const key = type + team; if (rigCache[key]) return rigCache[key];
  const T = teamPal(team), s = PEOPLE_SCALE[type] || 1, armC = type === 'lord' ? T.dark : type === 'lancier' ? C.gambesonD : C.leatherD;
  RIG = true; const base = one(k => (BUILD[type] || BUILD.archer)(k, T)); RIG = false; base.scale(s, s, s);
  if (type === 'lancier') {
    // bras (épaule en 0), lance dans le repère de la main (prise à SPEAR_GRIP de la base), bouclier dans la main gauche
    const armG = () => one(k => { k.add(cbox(.09, .2, .085, .025), armC, 0, -.2, 0); k.add(cbox(.075, .075, .075, .02), C.skin, .005, -.255, 0) });
    return rigCache[key] = { base, armSpear: armG(), armShield: armG(), spear: one(k => k.at(0, -SPEAR_GRIP, 0, 0, () => spear(k))),
      shield: one(k => k.at(.06, .02, -.05, 0, () => shield(k, T), Math.PI / 2)), scale: s };
  }
  const arm = (bracer: boolean) => one(k => {
    k.add(cbox(.09, .2, .085, .025), armC, 0, -.2, 0); k.add(cbox(.075, .075, .075, .02), C.skin, .005, -.255, 0);
    if (bracer) k.add(cbox(.095, .06, .09, .012), type === 'lord' ? C.gold : C.leather, 0, -.17, 0);
  });
  const R = BOW_R[type] || .34, tips = bowTips(type);
  const bowG = one(k => {
    k.add(new THREE.TorusGeometry(R, .016, 4, 12, BOW_A), C.wood, -R, 0, tips.z, 0, 0, -BOW_A / 2);
    k.add(cbox(.035, .07, .035, .008), type === 'lord' ? C.gold : C.leatherD, 0, -.035, tips.z); // la poignée
  });
  const string = one(k => k.add(cbox(.007, 1, .007, .002), C.white, 0, -.5, 0)); // centrée : une unité de long
  const arrow = one(k => {
    k.add(cyl(.009, .009, .42, 4), C.woodL, -.04, 0, 0, 0, 0, -Math.PI / 2);
    k.add(cone(.022, .06, 4), C.steel, .38, 0, 0, 0, 0, -Math.PI / 2);
    for (const r of [0, Math.PI / 2]) k.add(cbox(.07, .03, .004, .001), type === 'lord' ? C.white : C.red, .04, 0, 0, r);
  });
  return rigCache[key] = { base, armBow: arm(true), armDraw: arm(false), bow: bowG, string, arrow, scale: s };
}
