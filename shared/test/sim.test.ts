import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadMap, newGame, update, setHooks, G, trees, MAP_IDS, walkWater, rawWater,
  placeBuilding, recruit, startCharge, releaseCharge, steer, orderMove, spawnUnit, hit, findSpot, addBuilding,
  START_ARROWS, RESPAWN, UT, ELO, armySize, rangeOf, demolish, START_RES, STONES, IRON, shotClear, fireArrow, orderAttack, applyCommand, makeSnapshot, B_TYPES, forfeit,
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
    expect(shotClear(IRON.x - 150, IRON.y, IRON.x + 150, IRON.y, null)).toBe(true);
    fireArrow(0, st.x - 120, st.y, 0, 1);
    const a = G.arrows[G.arrows.length - 1];
    run(.4);
    expect(a.x).toBeGreaterThan(st.x + st.r);
  });
});

describe('soldats du joueur en position', () => {
  function setup() { loadMap('amboise'); newGame(); G.ai.next = 1e9; G.teams[1].lord.x = 2700; G.teams[0].lord.x = 100 }
  it('un archer ne poursuit pas : il tire seulement ce qui est à portée', () => {
    setup();
    const a = spawnUnit(0, 'archer', { x: 1000, y: 600 }); const x0 = a.x, y0 = a.y;
    const far = spawnUnit(1, 'lancier', { x: 1300, y: 600 }); far.speed = 0;
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
