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
type Look = { boot: number, legs: number, torso: number, belt: number, arms: number, brow?: number, face?: boolean };

/** le corps commun : jambes, torse, bras, tête (et visage, sauf sous un heaume) */
function body(k: Kit, t: Look) {
  for (const z of [-.065, .065]) { k.add(cbox(.12, .1, .1, .025), t.boot, .015, 0, z); k.add(cbox(.09, .17, .09, .02), t.legs, 0, .08, z) }
  k.add(cbox(.2, .25, .3, .05), t.torso, 0, .23);
  k.add(cbox(.215, .045, .315, .012), t.belt, 0, .28);
  k.add(cbox(.02, .035, .045, .006), C.gold, .11, .285, 0);
  for (const s of [-1, 1]) { k.add(cbox(.09, .2, .085, .025), t.arms, 0, .3, s * .19); k.add(cbox(.075, .075, .075, .02), C.skin, .005, .245, s * .19) }
  k.add(cbox(.25, .26, .25, .075), C.skin, 0, .47);
  if (t.face === false) return;
  for (const s of [-1, 1]) {
    k.add(cbox(.03, .055, .04, .008), C.dark, .12, .575, s * .055); k.add(cbox(.012, .016, .014, .003), C.white, .136, .595, s * .055 + .008);
    k.add(cbox(.02, .016, .055, .005), t.brow || C.hairBr, .125, .64, s * .06);
    k.add(cbox(.04, .06, .03, .01), C.skinD, 0, .55, s * .13);
  }
  k.add(cbox(.05, .055, .05, .016), C.skinD, .125, .53, 0);
  k.add(cbox(.012, .014, .06, .004), C.lip, .122, .5, 0);
}
function hair(k: Kit, color: number, style: 'short' | 'long') {
  k.add(cbox(.27, style === 'long' ? .08 : .07, .27, .02), color, -.01, .7);
  if (style === 'short') k.add(cbox(.08, .16, .27, .02), color, -.1, .56); else k.add(cbox(.1, .26, .28, .03), color, -.1, .45);
}
function beard(k: Kit, color: number, size = 1) { k.add(cbox(.06, .1 * size, .22, .02), color, .115, .46 - .04 * size, 0); k.add(cbox(.02, .025, .1, .006), color, .13, .53, 0) }
function bow(k: Kit, R: number) {
  const a = Math.PI * .78;
  k.add(new THREE.TorusGeometry(R, .016, 4, 12, a), C.wood, .07 - R * Math.cos(a / 2), .3, -.24, 0, 0, -a / 2);
  k.add(cbox(.006, 2 * R * Math.sin(a / 2), .006, .002), C.white, .07, .3 - R * Math.sin(a / 2), -.24);
}
function quiver(k: Kit, fletch: number[]) {
  k.add(cyl(.05, .045, .3, 6), C.leatherD, -.15, .22, .06, .3);
  for (let i = 0; i < 3; i++) k.add(cbox(.02, .07, .02, .005), fletch[i], -.15 + (i - 1) * .02, .52, .1 + (i - 1) * .015, .3);
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
    k.add(cbox(.03, .06, .03, .006), C.leatherD, .08, .28, -.24);
  },
  lancier(k, T) {
    body(k, { boot: C.boot, legs: C.trousers, torso: C.gambeson, belt: C.leather, arms: C.gambesonD, brow: C.hairDk });
    for (let i = 0; i < 4; i++) k.add(cbox(.205, .008, .305, .002), C.gambesonD, 0, .32 + i * .045);
    hair(k, C.hairDk, 'short'); beard(k, C.hairDk, .5);
    k.add(cbox(.03, .3, .18, .008), T.main, .105, .14, 0); k.add(cbox(.06, .06, .02, .02), C.gold, .122, .36, 0, 0, 0, Math.PI / 4);
    k.add(cyl(.24, .24, .025, 10), C.steelD, 0, .69); k.add(cyl(.13, .155, .1, 8), C.steel, 0, .71); k.add(cyl(.04, .13, .05, 8), C.steel, 0, .81);
    // la lance : manche, bague et pointe dans le même repère incliné
    k.at(.02, .02, .19, 0, () => { k.add(cyl(.016, .016, 1.35, 5), C.woodL); k.add(cyl(.022, .022, .04, 6), C.steelD, 0, 1.31); k.add(cone(.038, .16, 4), C.steel, 0, 1.35) }, 0, -.05);
    k.at(.08, .3, -.24, 0, () => {
      k.add(new THREE.CylinderGeometry(.17, .17, .035, 10), T.main); k.add(new THREE.CylinderGeometry(.175, .175, .02, 10), C.steelD, 0, -.01);
      k.add(new THREE.CylinderGeometry(.05, .05, .06, 8), C.steel, 0, -.03);
      for (let i = 0; i < 2; i++) k.add(cbox(.02, .038, .3, .004), T.light, 0, -.018, 0, 0, i * Math.PI / 2 + Math.PI / 4);
    }, Math.PI / 2);
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
    for (const y of [.28, .36]) k.add(cbox(.03, .025, .03, .006), C.gold, .08, y, -.24);
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
