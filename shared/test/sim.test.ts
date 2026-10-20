import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMap, newGame, MAPS, H1, cleanBlason, randomBlason, BLASON_DEFAULT, queueWindow, update, setHooks, G, trees, MAP_IDS, walkWater, rawWater,
  placeBuilding, recruit, startCharge, releaseCharge, steer, orderMove, spawnUnit, hit, findSpot, addBuilding,
  START_ARROWS, RESPAWN, UT, ELO, armySize, rangeOf, demolish, START_RES, STONES, IRONS, shotClear, findPath, buildNav, KEEPS, PLAYERS, H, isFoe, onPath, MAP, fireArrow, orderAttack, applyCommand, makeSnapshot, B_TYPES, forfeit, canPlace, GW, GH, identityOf, jobOf, riverY, W,
} from '../src/index';

const DT = 1 / 60;
function run(sec: number, stop?: () => boolean) { for (let i = 0; i < sec / DT; i++) { update(DT); if (stop && stop()) return } }
let notes: [number, string][] = [], ended: number | null = null;
beforeEach(() => {
  notes = []; ended = null;
  setHooks({ notify: (t, m) => notes.push([t, m]), end: w => { ended = w } });
});
/** pose un bâtiment pour l'équipe 0 à l'endroit que choisirait l'IA */
function build(type: string) { const s = findSpot(0, type); expect(s, 'emplacement pour ' + type).toBeTruthy(); return placeBuilding(0, type, s!.tx, s!.ty) }

describe('cartes', () => {
  it.each(MAP_IDS)('%s : arbres générés, donjons au sec', id => {
    loadMap(id); newGame();
    expect(trees.length).toBeGreaterThan(200);
    for (const tm of G.teams) expect(rawWater(tm.keep.x, tm.keep.y)).toBe(false);
  });
});

describe('partie complète contre l\'IA', () => {
  it('l\'IA développe son économie, recrute et attaque', () => {
    loadMap('amboise'); newGame();
    run(330);
    const mine = G.buildings.filter(b => b.team === 1 && b.type !== 'keep');
    expect(mine.length).toBeGreaterThanOrEqual(8);
    expect(G.st[1].prod.bois).toBeGreaterThan(50);
    expect(G.st[1].recruits).toBeGreaterThan(0);
    expect(notes.some(([t, m]) => t === 0 && /attaque/.test(m))).toBe(true);
    for (const e of [...G.units, ...G.workers]) {
      expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
      expect(walkWater(e.x, e.y)).toBe(false);
    }
  });
  it('tuer le seigneur ennemi donne la victoire', () => {
    loadMap('amboise'); newGame();
    hit(G.teams[1].lord, 9999, false);
    update(DT);
    expect(G.over).toBe(true); expect(G.winner).toBe(0); expect(ended).toBe(0);
  });
});

describe('arc du seigneur', () => {
  it('part avec 8 flèches, en consomme une par tir, prévient à la dernière', () => {
    loadMap('amboise'); newGame();
    const res = G.teams[0].res;
    expect(res.fleche).toBe(START_ARROWS);
    for (let i = 0; i < START_ARROWS; i++) {
      G.teams[0].lord.cd = 0;
      expect(startCharge(0)).toBeNull();
      run(.5); releaseCharge(0);
    }
    expect(res.fleche).toBe(0);
    expect(G.st[0].shot).toBe(START_ARROWS);
    expect(notes.some(([t, m]) => t === 0 && /Dernière flèche/.test(m))).toBe(true);
    G.teams[0].lord.cd = 0;
    expect(startCharge(0)).toMatch(/Plus de flèches/);
  });
  it('le seigneur suit la direction demandée', () => {
    loadMap('amboise'); newGame();
    const L = G.teams[0].lord, x0 = L.x;
    steer(0, 1, 0, null); run(1);
    expect(L.x - x0).toBeGreaterThan(100);
  });
});

describe('économie et stockage', () => {
  it('sans réserve le bois n\'arrive pas ; avec, il s\'accumule', () => {
    loadMap('amboise'); newGame();
    G.teams[0].res.bois = 20;
    expect(build('bucheron')).toBeNull();
    const w = G.workers.find(w => w.team === 0);
    run(20);
    expect(w.noStore).toBe('reserve');
    expect(G.st[0].prod.bois).toBe(0);
    expect(build('reserve')).toBeNull();
    run(40);
    expect(G.st[0].prod.bois).toBeGreaterThan(0);
  });
  it('un grenier détruit fait perdre tout le blé', () => {
    loadMap('amboise'); newGame();
    expect(build('grenier')).toBeNull();
    const gr = G.buildings.find(b => b.team === 0 && b.type === 'grenier');
    expect(G.teams[0].res.ble).toBeGreaterThan(0);
    hit(gr, 9999, false);
    expect(G.teams[0].res.ble).toBe(0);
  });
  it('un ouvrier tué est remplacé après le délai', () => {
    loadMap('amboise'); newGame();
    build('reserve'); build('bucheron');
    const b = G.buildings.find(b => b.team === 0 && b.type === 'bucheron');
    hit(b.worker, 999, false); update(DT);
    expect(b.respawn).toBeGreaterThan(RESPAWN - 1);
    run(RESPAWN - 1); expect(b.worker.dead).toBe(true);
    run(1.5); expect(b.worker.dead).toBe(false);
  });
});

describe('bûcheron', () => {
  it('sans arbre à côté, il va au plus proche, même loin', () => {
    loadMap('amboise'); newGame();
    build('reserve'); expect(build('bucheron')).toBeNull();
    const b = G.buildings.find(b => b.team === 0 && b.type === 'bucheron');
    for (const t of trees) if (Math.hypot(t.x - b.x, t.y - b.y) < 600) t.wood = 0;
    update(DT); run(5);
    const w = b.worker;
    expect(w.tree).toBeTruthy();
    expect(Math.hypot(w.tree.x - b.x, w.tree.y - b.y)).toBeGreaterThan(600);
    expect(w.idle).toBe(false);
  });
});

describe('stock de départ', () => {
  it('n\'apparaît qu\'avec la réserve et le grenier', () => {
    loadMap('amboise'); newGame();
    const tm = G.teams[0];
    expect(tm.res.bois).toBe(0); expect(tm.res.ble).toBe(0); expect(tm.starving).toBeFalsy();
    expect(build('reserve')).toBeNull();
    expect(tm.res.bois).toBe(START_RES.bois); expect(tm.res.pierre).toBe(START_RES.pierre); expect(tm.res.ble).toBe(0);
    expect(build('grenier')).toBeNull();
    expect(tm.res.ble).toBe(START_RES.ble);
    // démolir la réserve remet le bois en attente, il revient avec la suivante
    const r = G.buildings.find(b => b.team === 0 && b.type === 'reserve');
    expect(demolish(0, r)).toBeNull(); expect(tm.res.bois).toBe(0);
    update(DT); expect(build('reserve')).toBeNull(); expect(tm.res.bois).toBe(START_RES.bois);
  });
});

describe('démolition', () => {
  it('rend la moitié du coût, sauf si le bâtiment est abîmé', () => {
    loadMap('amboise'); newGame();
    G.teams[0].res.bois = 100; G.teams[0].res.pierre = 100;
    expect(build('arcs')).toBeNull();
    const b = G.buildings.find(b => b.team === 0 && b.type === 'arcs');
    const bois = G.teams[0].res.bois, pierre = G.teams[0].res.pierre;
    b.hp -= 1;
    expect(demolish(0, b)).toMatch(/endommagé/);
    b.hp = b.maxhp;
    expect(demolish(0, b)).toBeNull();
    expect(G.teams[0].res.bois).toBe(bois + 7); expect(G.teams[0].res.pierre).toBe(pierre + 4);
    update(DT);
    expect(G.buildings.includes(b)).toBe(false);
    expect(G.st[0].lostB).toBe(0);
    expect(demolish(0, G.teams[0].keep)).toMatch(/donjon/);
  });
});

describe('famine', () => {
  it('vitesse −50 % et vie −25 % sans blé', () => {
    loadMap('amboise'); newGame();
    G.teams[0].res.arc = 0;
    addBuilding(0, 'caserne', 12, 10);
    G.teams[0].res.lance = 1;
    expect(recruit(0, 'lancier')).toBeNull();
    const u = G.units.find(u => u.team === 0 && u.type === 'lancier');
    expect(u.maxhp).toBe(UT.lancier.hp);
    G.teams[0].res.ble = 0; G.teams[0].stash.ble = 0; update(DT);
    expect(u.starve).toBe(true);
    expect(u.maxhp).toBe(Math.round(UT.lancier.hp * .75));
    expect(notes.some(([t, m]) => t === 0 && /Famine/.test(m))).toBe(true);
  });
});

describe('équilibrage', () => {
  function duel(n: number) {
    loadMap('amboise'); newGame();
    G.teams[1].lord.x = 2300; G.teams[0].lord.x = 100; // seigneurs hors du combat
    const at = { x: 1200, y: 600 };
    const s = spawnUnit(0, 'spadassin', at);
    for (let i = 0; i < n; i++) spawnUnit(1, 'lancier', { x: at.x + 40, y: at.y + i * 12 - n * 6 });
    run(60, () => s.dead || armySize(1) === 0);
    return !s.dead;
  }
  it('un spadassin bat trois lanciers', () => {
    let wins = 0; for (let i = 0; i < 5; i++) if (duel(3)) wins++;
    expect(wins).toBeGreaterThanOrEqual(4);
  });
});

describe('archers de l\'IA', () => {
  it('tirent de plus loin que ceux du joueur', () => {
    loadMap('amboise'); newGame();
    const a0 = spawnUnit(0, 'archer', { x: 1000, y: 600 }), a1 = spawnUnit(1, 'archer', { x: 1400, y: 600 });
    expect(rangeOf(a1).range).toBeGreaterThan(rangeOf(a0).range * 1.3);
  });
});

describe('gisements', () => {
  it('les flèches passent au-dessus de la pierre et du fer', () => {
    loadMap('amboise'); newGame();
    const st = STONES[0];
    expect(shotClear(st.x - 150, st.y, st.x + 150, st.y, null)).toBe(true);
    const IRON = IRONS[0]; expect(shotClear(IRON.x - 150, IRON.y, IRON.x + 150, IRON.y, null)).toBe(true);
    fireArrow(0, st.x - 120, st.y, 0, 1);
    const a = G.arrows[G.arrows.length - 1];
    run(.4);
    expect(a.x).toBeGreaterThan(st.x + st.r);
  });
});

describe('soldats du joueur en position', () => {
  function setup() { loadMap('amboise'); newGame(); G.ai[1].next = 1e9; G.teams[1].lord.x = 2700; G.teams[0].lord.x = 100 }
  it('un archer ne poursuit pas : il tire seulement ce qui est à portée', () => {
    setup();
    const a = spawnUnit(0, 'archer', { x: 1000, y: 600 }); const x0 = a.x, y0 = a.y;
    const far = spawnUnit(1, 'lancier', { x: 1420, y: 600 }); far.speed = 0; // hors de portée (346 px)
    run(3);
    expect(Math.hypot(a.x - x0, a.y - y0)).toBeLessThan(10);
    expect(far.hp).toBe(far.maxhp);
    far.x = 1180; far.guard = { x: 1180, y: far.y }; run(4);
    expect(far.hp).toBeLessThan(far.maxhp);
    expect(Math.hypot(a.x - x0, a.y - y0)).toBeLessThan(10);
  });
  it('un lancier attend au contact, mais va frapper sur ordre', () => {
    setup();
    const l = spawnUnit(0, 'lancier', { x: 1000, y: 600 }); const x0 = l.x;
    const e = spawnUnit(1, 'archer', { x: 1080, y: 600 }); e.speed = 0; e.cd = 99;
    run(2);
    expect(Math.abs(l.x - x0)).toBeLessThan(10);
    orderAttack(0, [l], e); run(4);
    expect(e.dead || e.hp < e.maxhp).toBe(true);
  });
});

describe('Confluence du Cher', () => {
  it('on traverse la rivière par les ponts', () => {
    loadMap('cher'); newGame();
    G.teams[1].lord.x = 2300;
    const u = spawnUnit(0, 'lancier', { x: 700, y: 400 });
    orderMove(0, [u], 1700, 400);
    let wet = false;
    run(40, () => { if (walkWater(u.x, u.y)) wet = true; return !u.order });
    expect(wet).toBe(false);
    expect(u.x).toBeGreaterThan(1600);
  });
});

describe('Elo', () => {
  it('gains et rangs', () => {
    expect(ELO.delta(1000, 1000, true, 0)).toBe(40);
    expect(ELO.delta(1000, 1000, false, 10)).toBe(-20);
    expect(ELO.delta(1000, 1000, true, 50)).toBe(14);
    expect(ELO.rank(1000)).toBe('Bois I');
    expect(ELO.rank(850)).toBe('Bois III');
    expect(ELO.rank(2600)).toBe('Rubis I');
  });
});

describe('protocole réseau', () => {
  it('applique les commandes et produit des instantanés cohérents', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    expect(applyCommand(0, { c: 'place', type: 'reserve', tx: 10, ty: 16 })).toBeNull();
    expect(applyCommand(0, { c: 'place', type: 'reserve', tx: 14, ty: 16 })).toMatch(/déjà/);
    expect(applyCommand(1, { c: 'place', type: 'keep', tx: 30, ty: 16 })).toBeNull(); // interdit, ignoré
    expect(G.buildings.filter(b => b.type === 'keep').length).toBe(2);
    // commandes mal formées : ignorées sans planter
    for (const bad of [null, {}, { c: 'nope' }, { c: 'move', ids: 'x' }, { c: 'steer', dx: 'a', dy: 1e9 }, { c: 'attack', ids: [1], k: 'u', id: 999 }]) expect(() => applyCommand(0, bad)).not.toThrow();
    applyCommand(1, { c: 'steer', dx: -1, dy: 0 });
    const x0 = G.teams[1].lord.x; run(1);
    expect(G.teams[1].lord.x).toBeLessThan(x0 - 80);
    // on ne commande pas les soldats de l'autre
    const foe = spawnUnit(1, 'lancier', { x: 2000, y: 700 });
    applyCommand(0, { c: 'move', ids: [foe.id], x: 100, y: 100 });
    expect(foe.order).toBeNull();
    const s = makeSnapshot([]);
    expect(s.b.some(b => b[1] === 0 && B_TYPES[b[2]] === 'reserve')).toBe(true);
    expect(s.u.find(u => u[0] === G.teams[1].lord.id)).toBeTruthy();
    expect(s.tm[0].res.bois).toBe(START_RES.bois);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    // les effets ne partent qu'une fois
    hit(G.teams[1].lord, 5, true);
    expect(makeSnapshot([]).fx.length).toBeGreaterThan(0);
    expect(makeSnapshot([]).fx.length).toBe(0);
  });
  it('l\'abandon donne la victoire à l\'autre', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    forfeit(0);
    expect(G.over).toBe(true); expect(G.winner).toBe(1);
  });
});

describe('2v2', () => {
  it('chaque carte existe en 2v2, deux fois plus haute, avec quatre châteaux', () => {
    for (const id of MAP_IDS) {
      loadMap(id, '2v2'); newGame({ ai: [false, false, false, false] });
      expect(H).toBe(2 * H1); expect(PLAYERS).toBe(4);
      expect(G.teams.length).toBe(4);
      expect(G.teams.map(t => t.side)).toEqual([0, 1, 0, 1]);
      // deux châteaux par camp, l'un au-dessus de l'autre ; un gisement de fer par rangée
      const k = G.teams.map(t => t.keep);
      expect(k[0].x).toBeLessThan(1000); expect(k[2].x).toBe(k[0].x); expect(k[2].y - k[0].y).toBe(H1);
      expect(k[1].x).toBeGreaterThan(W - 1000); expect(k[3].y - k[1].y).toBe(H1);
      expect(IRONS.length).toBe(2); expect(STONES.length).toBe(4);
      // la Loire est tout au sud : pas d'eau entre les deux rangées, sauf le Cher
      expect(rawWater(300, H1 - 100)).toBe(false); expect(rawWater(300, H - 10)).toBe(true);
      // des arbres dans les deux moitiés, et un chemin dans chaque rangée
      expect(trees.some(t => t.y < H1)).toBe(true); expect(trees.some(t => t.y > H1)).toBe(true);
      expect(MAP.paths.length).toBe(2); expect(onPath(W / 2, MAP.paths[1](W / 2), 5)).toBe(true);
      // on peut marcher d'un château à n'importe quel autre
      buildNav();
      for (const j of [1, 2, 3]) expect(findPath(k[0].x + 110, k[0].y, k[j].x - 110 * (j % 2 ? 1 : -1), k[j].y)).not.toBeNull();
    }
    // revenir en 1v1 remet la carte à sa taille
    loadMap('amboise'); newGame();
    expect(H).toBe(H1); expect(G.teams.length).toBe(2);
  });
  it('les alliés ne se blessent pas, les ennemis oui', () => {
    loadMap('amboise', '2v2'); newGame({ ai: [false, false, false, false] });
    expect(isFoe(0, 2)).toBe(false); expect(isFoe(0, 1)).toBe(true); expect(isFoe(2, 3)).toBe(true);
    const ally = spawnUnit(2, 'lancier', { x: 1000, y: 1700 }), foe = spawnUnit(3, 'lancier', { x: 1000, y: 1900 });
    fireArrow(0, 1000, 1640, Math.PI / 2, 1); // la flèche traverse l'allié et touche l'ennemi
    run(.6);
    expect(ally.hp).toBe(ally.maxhp); expect(foe.hp).toBeLessThan(foe.maxhp);
    expect(G.st[0].hit).toBe(1);
    // on ne peut pas ordonner d'attaquer un allié
    const mine = spawnUnit(0, 'archer', { x: 900, y: 1700 });
    orderAttack(0, [mine], ally); expect(mine.order).toBeNull();
    orderAttack(0, [mine], foe); expect(mine.order.type).toBe('attack');
  });
  it('un camp perd quand ses deux seigneurs sont abattus', () => {
    loadMap('cher', '2v2'); newGame({ ai: [false, false, false, false] });
    setHooks({ end: w => { ended = w }, notify: (t, m) => notes.push([t, m]) });
    const s1 = spawnUnit(1, 'lancier', { x: 2400, y: 700 });
    hit(G.teams[1].lord, 1000, false, 0); run(.1);
    expect(G.teams[1].out).toBe(true); expect(G.over).toBe(null);
    expect(s1.dead || !G.units.includes(s1)).toBe(true); // ses soldats se rendent
    expect(notes.some(([t, m]) => t === 3 && /allié est tombé/.test(m))).toBe(true);
    expect(notes.some(([t, m]) => t === 0 && /ennemi est tombé/.test(m))).toBe(true);
    // un joueur éliminé ne commande plus rien
    expect(applyCommand(1, { c: 'place', type: 'reserve', tx: 60, ty: 16 })).toBeNull();
    expect(G.buildings.some(b => b.team === 1 && b.type === 'reserve')).toBe(false);
    hit(G.teams[3].lord, 1000, false, 2); run(.1);
    expect(G.over).toBe(true); expect(G.winner).toBe(0); expect(ended).toBe(0);
  });
  it('abandons en 2v2 : le camp perd au dernier départ', () => {
    loadMap('amboise', '2v2'); newGame({ ai: [false, false, false, false] });
    forfeit(0); expect(G.over).toBe(null); expect(G.teams[0].out).toBe(true);
    forfeit(2); expect(G.over).toBe(true); expect(G.winner).toBe(1);
  });
  it('l\'IA peut jouer n\'importe quel joueur et vise l\'ennemi, jamais son allié', () => {
    loadMap('chinon', '2v2'); newGame({ ai: [false, true, true, true] });
    for (const a of G.ai) a.next = 60; // vagues plus tôt pour le test
    G.teams[0].res.fleche = 0;
    const notesFor: number[] = []; setHooks({ notify: (t, m) => { if (/lance une attaque/.test(m)) notesFor.push(t) } });
    run(200);
    for (const p of [1, 2, 3]) expect(G.buildings.filter(b => b.team === p).length).toBeGreaterThan(3);
    // les vagues de l'IA alliée (joueur 2) visent le camp d'en face, jamais le joueur 0 (vérifié sur les ordres ci-dessous)
    expect(notesFor.every(t => t >= 0 && t < 4)).toBe(true);
    for (const u of G.units) if (u.team === 2 && u.order && u.order.ai) expect(Math.abs(u.order.x - G.teams[0].lord.x) + Math.abs(u.order.y - G.teams[0].lord.y)).toBeGreaterThan(200);
    const s = makeSnapshot([]); expect(s.tm.length).toBe(4); expect(s.ctrl.length).toBe(4);
  });
});

describe('construction dans sa moitié de carte', () => {
  /** une case libre (canPlace OK) dans la zone donnée, ou null */
  function freeSpot(team: number, type: string, x0: number, x1: number, y0: number, y1: number) {
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) if (!canPlace(team, type, tx, ty)) return { tx, ty };
    return null;
  }
  it.each(['1v1', '2v2'] as const)('%s : partout dans sa moitié, jamais dans celle d\'en face', mode => {
    loadMap('amboise', mode); newGame();
    for (let p = 0; p < PLAYERS; p++) {
      const left = (p & 1) === 0, mid = GW / 2;
      // loin du donjon mais dans sa moitié (près de la ligne du milieu) : autorisé
      const near = left ? freeSpot(p, 'fleches', mid - 6, mid - 2, 0, GH) : freeSpot(p, 'fleches', mid, mid + 4, 0, GH);
      expect(near, 'emplacement près du milieu pour le joueur ' + p).toBeTruthy();
      // à cheval sur la ligne du milieu, ou chez l'adversaire : refusé
      expect(canPlace(p, 'fleches', mid - 1, near!.ty)).toBe('Hors de ta moitié de carte');
      const other = left ? freeSpot(1, 'fleches', mid, GW - 2, 0, GH) : freeSpot(0, 'fleches', 1, mid - 2, 0, GH);
      expect(canPlace(p, 'fleches', other!.tx, other!.ty)).toBe('Hors de ta moitié de carte');
    }
    // la mine reste au centre, sur le gisement de fer
    const I = IRONS[0];
    expect(canPlace(0, 'mine', Math.round(I.x / 40 - 1), Math.round(I.y / 40 - 1))).not.toBe('Hors de ta moitié de carte');
  });
});

describe('identité des ouvriers', () => {
  it('nom stable pour une partie, différent d\'une partie à l\'autre', () => {
    const a = identityOf(7, 123), b = identityOf(7, 123), c = identityOf(7, 999);
    expect(a).toEqual(b);
    expect(a.first + a.last + a.age).not.toBe(c.first + c.last + c.age);
    const names = new Set(Array.from({ length: 40 }, (_, i) => { const d = identityOf(i, 42); return d.first + ' ' + d.last }));
    expect(names.size).toBeGreaterThan(35);
    for (let i = 0; i < 200; i++) { const d = identityOf(i, 5); expect(d.age).toBeGreaterThanOrEqual(16); expect(d.age).toBeLessThan(57); if (d.female) expect(d.face.beard).toBe(0) }
    expect(jobOf('bucheron', true)).toBe('Bûcheronne');
  });
  it('la graine de la partie part avec l\'instantané réseau', () => {
    loadMap('amboise'); newGame();
    expect(makeSnapshot([]).sd).toBe(G.seed);
  });
});

describe('armurerie et ateliers', () => {
  it('l\'ouvrier prend le bois à la réserve, fabrique, puis range l\'arc à l\'armurerie', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    expect(build('reserve')).toBeNull();
    const tm = G.teams[0]; tm.res.bois = 60; tm.res.pierre = 20;
    expect(build('arcs')).toBeNull();
    const w = G.workers.find(w => w.team === 0 && w.b.type === 'arcs');
    const res = G.buildings.find(b => b.team === 0 && b.type === 'reserve');
    run(1);
    expect(w.state).toBe('toFetch');
    // il va à la réserve et y prend 3 bois, qu'il porte jusqu'à l'atelier
    const bois0 = tm.res.bois; let near = false;
    run(30, () => { if (Math.hypot(w.x - res.x, w.y - res.y) < 70) near = true; return w.state === 'toWork' && w.carry?.input });
    expect(near).toBe(true);
    expect(tm.res.bois).toBe(bois0 - 3); expect(w.carry.type).toBe('bois');
    // sans armurerie, l'arc fabriqué attend
    run(60, () => w.noStore === 'armurerie');
    expect(w.noStore).toBe('armurerie'); expect(tm.res.arc).toBe(0);
    const sp = findSpot(0, 'armurerie')!;
    expect(placeBuilding(0, 'armurerie', sp.tx, sp.ty)).toBeNull();
    expect(canPlace(0, 'armurerie', sp.tx, sp.ty)).toBe('Tu as déjà une armurerie');
    run(40, () => tm.res.arc > 0);
    expect(tm.res.arc).toBe(1);
  });
  it('sans assez de bois à la réserve, l\'ouvrier attend devant', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    expect(build('reserve')).toBeNull();
    const tm = G.teams[0]; tm.res.bois = 50; tm.res.pierre = 20;
    expect(build('forge')).toBeNull(); // fer 2 + bois 3
    const w = G.workers.find(w => w.team === 0 && w.b.type === 'forge');
    tm.res.fer = 0; const bois0 = tm.res.bois;
    run(30);
    expect(w.state).toBe('toFetch'); expect(w.need).toBe(true); expect(tm.res.bois).toBe(bois0);
    tm.res.fer = 2; run(2);
    expect(w.need).toBe(false); expect(tm.res.fer).toBe(0); expect(tm.res.bois).toBe(bois0 - 3);
  });
  it('une armurerie détruite fait perdre les armes ; démolie, elles attendent la suivante', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    const tm = G.teams[0];
    expect(build('armurerie')).toBe('Il manque 5 bois'); // elle coûte 5 bois
    tm.res.bois = 5; expect(build('armurerie')).toBeNull(); expect(tm.res.bois).toBe(0);
    tm.res.arc = 2; tm.res.epee = 1; tm.res.fleche = 5;
    let a = G.buildings.find(b => b.team === 0 && b.type === 'armurerie');
    expect(demolish(0, a)).toBeNull();
    expect(tm.res.arc).toBe(0); expect(tm.stash.arc).toBe(2);
    expect(tm.res.bois).toBe(2); // démolie : la moitié du coût revient
    tm.res.bois = 5; expect(build('armurerie')).toBeNull();
    expect(tm.res.arc).toBe(2); expect(tm.res.epee).toBe(1);
    a = G.buildings.find(b => b.team === 0 && b.type === 'armurerie' && !b.dead);
    hit(a, 9999, false);
    expect(tm.res.arc).toBe(0); expect(tm.res.epee).toBe(0);
    expect(tm.res.fleche).toBe(5); // les flèches du seigneur restent au donjon
  });
});

describe('duel de seigneurs', () => {
  it('une flèche de seigneur fait un peu moins de dégâts à un autre seigneur', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    const L1 = G.teams[1].lord, w = G.workers[0];
    L1.x = 1300; L1.y = 700;
    fireArrow(0, 1200, 700, 0, 1); run(.4);
    expect(L1.maxhp - L1.hp).toBe(Math.round(60 * .75));
    // contre un soldat, plein dégât
    // (en terrain dégagé : un arbre arrêterait la flèche)
    L1.x = 2000; L1.y = 300;
    const s = spawnUnit(1, 'lancier', { x: 1300, y: 700 }); s.x = 1300; s.y = 700;
    fireArrow(0, 1200, 700, 0, 1); run(.4);
    expect(s.maxhp - s.hp).toBe(60);
  });
});

describe('événements pour les bruitages', () => {
  it('une flèche qui touche signale l\'impact (chair, bois) ; dans le vide elle se plante au sol', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    const u = spawnUnit(1, 'lancier', { x: 1300, y: 700 }); u.x = 1300; u.y = 700; u.speed = 0;
    const body = () => G.fx.some(f => f.k === 'hit' && f.m === 'chair' && f.lord);
    fireArrow(0, 1200, 700, 0, 1); run(.5, body);
    expect(body()).toBe(true);
    const stuck = () => G.fx.some(f => f.k === 'stuck');
    fireArrow(0, 1200, 300, Math.PI, .2); run(2, stuck); // vers la gauche, faible : finit dans l'herbe ou un arbre
    expect(stuck()).toBe(true);
  });
});

describe('gabarre', () => {
  /** fait venir la gabarre et la place à l'abscisse x */
  function boatAt(x: number) { const b = G.boat; b.t = 0; update(DT); expect(b.on).toBe(true); b.x = x; b.y = riverY(x); return b }
  it('passe sur la Loire, et la première flèche de seigneur qui la touche rapporte 10 bois et 5 pierre, une seule fois', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    expect(build('reserve')).toBeNull();
    const tm0 = G.teams[0], tm1 = G.teams[1], bois = tm0.res.bois, pierre = tm0.res.pierre;
    const b = boatAt(1440); b.dir = 1;
    fireArrow(0, b.x, b.y - 60, Math.PI / 2, 1); run(.3, () => b.looted);
    expect(b.looted).toBe(true);
    expect(tm0.res.bois).toBe(bois + 10); expect(tm0.res.pierre).toBe(pierre + 5);
    expect(G.fx.some(f => f.k === 'loot')).toBe(true);
    expect(notes.some(([t, m]) => t === 0 && /Gabarre touchée/.test(m))).toBe(true);
    expect(notes.some(([t]) => t === 1)).toBe(true);
    // une deuxième flèche, même d'un autre joueur, ne rapporte plus rien
    const b1 = tm1.res.bois + tm1.stash.bois;
    fireArrow(1, b.x, b.y - 60, Math.PI / 2, 1); run(.3);
    expect(tm1.res.bois + tm1.stash.bois).toBe(b1);
    expect(makeSnapshot([]).bt).toEqual([1, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, 1, 1]);
  });
  it('sans réserve, le butin attend dans les charrettes ; une flèche qui la manque ne rapporte rien', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    const tm = G.teams[0], stash = tm.stash.bois;
    const b = boatAt(900);
    fireArrow(0, b.x + 200, b.y - 60, Math.PI / 2, 1); run(.6);
    expect(b.looted).toBe(false);
    fireArrow(0, b.x, b.y - 60, Math.PI / 2, 1); run(.3, () => b.looted);
    expect(b.looted).toBe(true); expect(tm.stash.bois).toBe(stash + 10); expect(tm.res.bois).toBe(0);
  });
  it('traverse la carte puis repart plus tard', () => {
    loadMap('amboise'); newGame({ ai: [false, false] });
    const b = boatAt(W - 20); b.dir = 1;
    run(10); expect(b.on).toBe(false); expect(b.t).toBeGreaterThan(60);
  });
});

describe('gisements de pierre', () => {
  it.each(MAP_IDS.flatMap(id => [[id, '1v1'], [id, '2v2']]) as [string, '1v1' | '2v2'][])('%s %s : à l\'écart du donjon, au sec, dans sa moitié, la carrière se pose', (id, mode) => {
    loadMap(id, mode); newGame({ ai: Array(mode === '2v2' ? 4 : 2).fill(false) });
    for (let p = 0; p < PLAYERS; p++) {
      const k = G.teams[p].keep, s = STONES[p];
      expect(Math.hypot(s.x - k.x, s.y - k.y)).toBeGreaterThan(500);
      expect((p & 1) === 0 ? s.x < W / 2 : s.x > W / 2).toBe(true);
      for (let a = 0; a < 6.28; a += .5) expect(rawWater(s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r)).toBe(false);
      G.teams[p].res.bois = 50;
      const sp = findSpot(p, 'carriere'); expect(sp, 'carrière pour le joueur ' + p).toBeTruthy();
    }
  });
});

describe('tutoriel', () => {
  it('la carte du tutoriel n\'est pas proposée en partie normale', () => {
    expect(MAPS.jardin.tuto).toBe(true);
    expect(MAP_IDS).not.toContain('jardin');
  });
  it('une partie tutoriel n\'a pas d\'adversaire et ne se termine jamais', () => {
    loadMap('jardin'); newGame({ tuto: true });
    expect(G.tuto).toBe(true);
    expect(G.units.every((u: any) => u.team === 0)).toBe(true);
    expect(G.buildings.every((b: any) => b.team === 0)).toBe(true);
    for (let i = 0; i < 60 * 60; i++) update(1 / 60);
    expect(G.over).toBeFalsy();
    // on peut tout poser, la réserve puis le bûcheron
    const r = findSpot(0, 'reserve'); expect(r).toBeTruthy();
    addBuilding(0, 'reserve', r!.x, r!.y);
    const b = findSpot(0, 'bucheron'); expect(b).toBeTruthy();
    for (let i = 0; i < 60 * 30; i++) update(1 / 60);
    expect(G.over).toBeFalsy();
  });
});

describe('blason et Elo', () => {
  it('un blason invalide est nettoyé, un blason valide gardé', () => {
    expect(cleanBlason({ s: 'losange', f: 'gueules', t: 'or', d: 'parti', c: 'tour', k: 'argent' })).toEqual({ s: 'losange', f: 'gueules', t: 'or', d: 'parti', c: 'tour', k: 'argent' });
    expect(cleanBlason('{"s":"<script>","f":"gueules"}')).toEqual({ ...BLASON_DEFAULT, f: 'gueules' });
    expect(cleanBlason(null)).toEqual(BLASON_DEFAULT);
    for (let i = 0; i < 50; i++) { const b = randomBlason(); expect(cleanBlason(b)).toEqual(b) }
  });
  it('paliers d\'Elo et fenêtre de la file', () => {
    expect(ELO.rank(1000)).toBe('Bois I'); expect(ELO.rank(1199)).toBe('Pierre III'); expect(ELO.rank(1200)).toBe('Pierre II');
    expect(ELO.tierLo(ELO.tier(1250))).toBe(1200); expect(ELO.tierHi(ELO.tier(1250))).toBe(1300);
    expect(queueWindow(5)).toBe(100); expect(queueWindow(45)).toBe(500); expect(queueWindow(90)).toBe(Infinity);
  });
});
