// La gabarre : un bateau de Loire qui traverse la carte de temps en temps, sur le fleuve au sud.
// Le premier seigneur qui la touche d'une flèche fait tomber une partie de la cargaison : une récompense,
// une seule fois par partie. Elle fait partie de la simulation pour que tous les joueurs d'une partie
// en ligne la voient au même endroit (le serveur décide, les navigateurs affichent).
import { W, H } from './config';
import { MAP, walkWater } from './maps';
import { G, hooks } from './state';

/** récompense du premier tir qui touche la gabarre */
export const BOAT_LOOT = { bois: 10, pierre: 5 };
const SPEED = 16, LEN = 48, WIDE = 16;

/** milieu du fleuve à l'abscisse x (là où passe la gabarre) */
export const riverY = (x: number) => (MAP.south(x) + H) / 2;
export function newBoat() { return { on: false, x: 0, y: 0, dir: 1, t: 25 + Math.random() * 20, looted: false } }

/** fait avancer la gabarre, ou la fait partir quand c'est l'heure */
export function updBoat(dt: number) {
  const b = G.boat; if (!b) return;
  if (!b.on) {
    b.t -= dt; if (b.t > 0) return;
    // le fleuve doit être assez large sur toute la traversée
    for (let x = 60; x < W; x += 120) if (!walkWater(x, riverY(x)) || H - MAP.south(x) < 70) { b.t = 120; return }
    b.dir = Math.random() < .5 ? 1 : -1; b.x = b.dir > 0 ? -60 : W + 60; b.y = riverY(b.x); b.on = true;
    return;
  }
  b.x += b.dir * SPEED * dt; b.y = riverY(b.x);
  if (b.x < -80 || b.x > W + 80) { b.on = false; b.t = 90 + Math.random() * 90 }
}

/** une flèche touche-t-elle la coque ? (repère du bateau : le long du fleuve, et en travers) */
export function boatHit(a: any) {
  const b = G.boat; if (!b || !b.on) return false;
  const ny = riverY(b.x + b.dir * 20), ang = Math.atan2(ny - b.y, b.dir * 20), c = Math.cos(ang), s = Math.sin(ang);
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.abs(dx * c + dy * s) < LEN && Math.abs(-dx * s + dy * c) < WIDE;
}

/** un seigneur a touché la gabarre : la première fois, la cargaison tombe et il ramasse la récompense */
export function lootBoat(team: number) {
  const b = G.boat; if (!b || b.looted) return false;
  b.looted = true;
  const tm = G.teams[team], hasRes = G.buildings.some(o => o.team === team && o.type === 'reserve' && !o.dead);
  // sans réserve, le butin attend dans les charrettes comme le stock de départ
  for (const k in BOAT_LOOT) (hasRes ? tm.res : tm.stash)[k] += BOAT_LOOT[k];
  G.fx.push({ k: 'loot', x: b.x, y: b.y, dir: b.dir, t: 0, life: 2.4 });
  if (G.st) G.st[team].boat = 1;
  hooks.notify(team, 'Gabarre touchée ! Le marinier lâche sa cargaison : +10 bois, +5 pierre' + (hasRes ? '' : ' (pose ta réserve pour les récupérer)'), '');
  for (const o of G.teams) if (o.id !== team) hooks.notify(o.id, 'La gabarre a été pillée par un autre seigneur', '');
  return true;
}
