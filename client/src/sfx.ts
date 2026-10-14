// Bruitages de l'arc, déclenchés par ce qui se passe dans la partie (en solo comme en ligne) :
// un seigneur bande son arc, une flèche part, une flèche touche (chair, bois) ou se plante au sol.
// Le volume baisse avec la distance au centre de l'écran, et le son est placé à gauche ou à droite.
import { G, S } from '@ffl/shared';
import { playSfx, type Voice } from './audio';
import { camT } from './render/engine';
import { toScreen } from './render/sync';
import { ME, ui, view } from './state';

let lastG: any = null;
const seenArrows = new Set<number>();
const charging: (Voice | null | false)[] = [];
let lastArcher = 0, lastSmallHit = 0;

/** volume (0 à 1) et placement gauche-droite d'un son au point (x, y) de la carte */
function where(x: number, y: number) {
  const d = Math.hypot(x - camT.x / S, y - camT.z / S);
  const vol = Math.max(0, Math.min(1, 1 - (d - 260) / 1100)) ** 1.6;
  let pan = 0; try { pan = (toScreen(x, y, .5).x / Math.max(1, view.VW) * 2 - 1) * .7 } catch (e) {}
  return { vol, pan };
}
const jitter = (a: number, b: number) => a + Math.random() * (b - a);

/** à appeler à chaque image */
export function updateSfx() {
  if (!G) return;
  const now = performance.now();
  // nouvelle partie : ce qui existe déjà ne fait pas de bruit
  if (G !== lastG) {
    lastG = G; seenArrows.clear(); for (const a of G.arrows) seenArrows.add(a.id);
    for (const f of G.fx) f.snd = 1;
    for (const v of charging) if (v) v.stop(); charging.length = 0;
  }
  const on = ui.running;
  // ---- un seigneur bande son arc ----
  G.teams.forEach((tm: any, i: number) => {
    const L = tm.lord, c = G.ctrl[i], is = on && !!c && c.charging && L && !L.dead;
    if (is && !charging[i]) {
      const p = where(L.x, L.y), mine = i === ME;
      charging[i] = playSfx('bander', (mine ? Math.max(.8, p.vol) : p.vol) * .75, mine ? 0 : p.pan, jitter(.97, 1.03)) || false;
      if (charging[i] === false && !is) charging[i] = null;
    } else if (!is && charging[i] !== undefined && charging[i] !== null) {
      const v = charging[i]; if (v) v.stop(.08); charging[i] = null;
    }
  });
  // ---- une flèche part ----
  const alive = new Set<number>();
  for (const a of G.arrows) {
    alive.add(a.id); if (seenArrows.has(a.id)) continue; seenArrows.add(a.id);
    if (!on) continue;
    const p = where(a.x, a.y);
    if (a.lord) playSfx('tir', p.vol * .9, p.pan, jitter(.94, 1.06));
    // les archers : arc plus petit (plus aigu), plus discret, et pas plus d'un tir entendu toutes les 70 ms
    else if (now - lastArcher > 70) { lastArcher = now; playSfx('tir', p.vol * .3, p.pan, jitter(1.15, 1.3)) }
  }
  for (const id of seenArrows) if (!alive.has(id)) seenArrows.delete(id);
  // ---- une flèche touche ou se plante ----
  for (const f of G.fx) {
    if (f.snd || (f.k !== 'hit' && f.k !== 'stuck')) continue;
    f.snd = 1; if (!on) continue;
    const kind = f.k === 'hit' ? f.m : f.h !== undefined ? 'bois' : 'sol';
    const p = where(f.x, f.y);
    if (f.lord) playSfx(kind, p.vol * .85, p.pan, jitter(.92, 1.08));
    else if (now - lastSmallHit > 60) { lastSmallHit = now; playSfx(kind, p.vol * .35, p.pan, jitter(1, 1.15)) }
  }
}
