// Les gabarres : deux bateaux de Loire qui traversent la carte en même temps, de temps en temps, sur le fleuve au sud.
// Pour l'équilibre, l'une part du bord gauche et l'autre du bord droit (chacune sur sa voie du fleuve) : chaque camp
// voit arriver une gabarre de son côté. Le premier seigneur qui touche une gabarre d'une flèche fait tomber sa
// cargaison : une récompense, une seule fois par gabarre et par partie. Elles font partie de la simulation pour que
// tous les joueurs d'une partie en ligne les voient au même endroit (le serveur décide, les navigateurs affichent).
import { W, H } from './config';
import { MAP, walkWater } from './maps';
import { G, hooks } from './state';

/** récompense du premier tir qui touche une gabarre */
export const BOAT_LOOT = { bois: 10, pierre: 5 };
const SPEED = 16, LEN = 48, WIDE = 16;

/** milieu du fleuve à l'abscisse x */
export const riverY = (x: number) => (MAP.south(x) + H) / 2;
/** voie de chaque gabarre : celle qui va vers l'est passe un peu au nord, l'autre un peu au sud (elles se croisent sans se toucher) */
const LANE = 11;
export const laneY = (x: number, dir: number) => riverY(x) - dir * LANE;
const boat = (dir: number) => ({ on: false, x: 0, y: 0, dir, looted: false });
/** la flotte : deux gabarres (l'une part de l'ouest, l'autre de l'est) et le temps avant leur prochain départ, ensemble */
export function newBoats() { return { t: 25 + Math.random() * 20, list: [boat(1), boat(-1)] } }

/** fait avancer les gabarres, ou les fait partir ensemble quand c'est l'heure */
export function updBoat(dt: number) {
  const f = G.boats; if (!f) return;
  if (!f.list.some(b => b.on)) {
    f.t -= dt; if (f.t > 0) return;
    // le fleuve doit être assez large sur toute la traversée
    for (let x = 60; x < W; x += 120) if (!walkWater(x, riverY(x)) || H - MAP.south(x) < 70) { f.t = 120; return }
    for (const b of f.list) { b.x = b.dir > 0 ? -60 : W + 60; b.y = laneY(b.x, b.dir); b.on = true }
    return;
  }
  for (const b of f.list) {
    if (!b.on) continue;
    b.x += b.dir * SPEED * dt; b.y = laneY(b.x, b.dir);
    if (b.x < -80 || b.x > W + 80) b.on = false;
  }
  // les deux sont sorties : prochain passage plus tard
  if (!f.list.some(b => b.on)) f.t = 90 + Math.random() * 90;
}

/** la gabarre touchée par une flèche (null si aucune) */
export function boatHit(a: any) {
  for (const b of G.boats ? G.boats.list : []) if (b.on && hull(b, a)) return b;
  return null;
}
/** la flèche est-elle dans la coque ? (repère du bateau : le long du fleuve, et en travers) */
function hull(b: any, a: any) {
  const ny = laneY(b.x + b.dir * 20, b.dir), ang = Math.atan2(ny - b.y, b.dir * 20), c = Math.cos(ang), s = Math.sin(ang);
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.abs(dx * c + dy * s) < LEN && Math.abs(-dx * s + dy * c) < WIDE;
}

/** un seigneur a touché une gabarre : la première fois, sa cargaison tombe et il ramasse la récompense */
export function lootBoat(b: any, team: number) {
  if (!b || b.looted) return false;
  b.looted = true;
  const tm = G.teams[team], hasRes = G.buildings.some(o => o.team === team && o.type === 'reserve' && !o.dead);
  // sans réserve, le butin attend dans les charrettes comme le stock de départ
  for (const k in BOAT_LOOT) (hasRes ? tm.res : tm.stash)[k] += BOAT_LOOT[k];
  G.fx.push({ k: 'loot', x: b.x, y: b.y, dir: b.dir, t: 0, life: 2.4 });
  if (G.st) G.st[team].boat = (G.st[team].boat || 0) + 1;
  hooks.notify(team, 'Gabarre touchée ! Le marinier lâche sa cargaison : +10 bois, +5 pierre' + (hasRes ? '' : ' (pose ta réserve pour les récupérer)'), '');
  for (const o of G.teams) if (o.id !== team) hooks.notify(o.id, 'Une gabarre a été pillée par un autre seigneur', '');
  return true;
}
