// Bruitages déclenchés par ce qui se passe dans la partie (en solo comme en ligne) :
// - l'arc : un seigneur bande son arc, une flèche part, touche (chair, bois) ou se plante au sol ;
// - le travail des ouvriers (hache, pic, enclume, atelier, faux) et leurs dépôts (bois, pierre, fer, blé, armes).
// Le volume baisse avec la distance au centre de l'écran (et monte quand on zoome), le son est placé à gauche ou à droite.
import { G, S } from '@ffl/shared';
import { playSfx, type Voice } from './audio';
import { camT } from './render/engine';
import { toScreen } from './render/sync';
import { ME, ui, view } from './state';

let lastG: any = null;
const seenArrows = new Set<number>();
const charging: (Voice | null | false)[] = [];
let lastArcher = 0, lastSmallHit = 0, lastFrame = 0;
/** bruit de chaque métier : son, intervalle entre deux coups (s), volume, hauteur */
const WORK: Record<string, [string, number, number, number]> = {
  bucheron: ['coupe', .95, .75, 1], carriere: ['taille', 1.15, .6, 1], mine: ['pic', 1.3, .6, 1], forge: ['enclume', 1.1, .4, 1],
  // les ateliers d'arcs, de lances et de flèches ne font aucun bruit (ni travail ni dépôt)
  ferme: ['faux', 2.6, .4, 1],
};
/** un chantier : coups de marteau sur la pierre et le bois */
const BUILDING: [string, number, number, number] = ['taille', .8, .4, 1.15];
/** bruit du dépôt selon ce que l'ouvrier rapporte */
const DROP: Record<string, string> = { bois: 'd-bois', pierre: 'd-pierre', fer: 'd-fer', ble: 'd-ble', epee: 'd-armes' };
const workT = new Map<number, number>(), carried = new Map<number, string | null>();
let workBudget = 0;
/** volume d'un bruit du village : on l'entend surtout de près, et plus fort quand on zoome */
function near(x: number, y: number) {
  const d = Math.hypot(x - camT.x / S, y - camT.z / S), zoom = .5 + .5 * Math.max(0, Math.min(1, (view.ppu - 40) / 32));
  const vol = Math.max(0, Math.min(1, 1 - (d - 120) / 620)) ** 2 * zoom;
  let pan = 0; try { pan = (toScreen(x, y, .5).x / Math.max(1, view.VW) * 2 - 1) * .7 } catch (e) {}
  return { vol, pan };
}

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
    workT.clear(); carried.clear(); for (const w of G.workers) carried.set(w.id, w.carry && !w.carry.input ? w.carry.type : null);
  }
  const dt = Math.min(.1, lastFrame ? (now - lastFrame) / 1000 : 0); lastFrame = now;
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
    // un de ses chantiers est terminé
    if (f.k === 'built' && !f.snd) { f.snd = 1; if (on && f.team === ME) playSfx('pose', .55); continue }
    if (f.snd || (f.k !== 'hit' && f.k !== 'stuck')) continue;
    f.snd = 1; if (!on) continue;
    const kind = f.k === 'hit' ? f.m : f.h !== undefined ? 'bois' : 'sol';
    const p = where(f.x, f.y);
    if (f.lord) playSfx(kind, p.vol * .85, p.pan, jitter(.92, 1.08));
    else if (now - lastSmallHit > 60) { lastSmallHit = now; playSfx(kind, p.vol * .35, p.pan, jitter(1, 1.15)) }
  }
  // ---- les ouvriers au travail, et leurs dépôts ----
  workBudget = Math.min(8, workBudget + dt * 8); // au plus ~8 bruits de travail par seconde
  const alive2 = new Set<number>();
  for (const w of G.workers) {
    if (w.dead) continue; alive2.add(w.id);
    const cur = w.carry && !w.carry.input ? w.carry.type : null, prev = carried.get(w.id);
    if (on && prev && !cur && DROP[prev]) { const p = near(w.x, w.y); if (p.vol > .02) playSfx(DROP[prev], p.vol * .7, p.pan, jitter(.92, 1.08)) }
    carried.set(w.id, cur);
    const job = w.b && (w.b.build < 1 ? BUILDING : WORK[w.b.type]);
    if (!on || !job || !w.working) { workT.delete(w.id); continue }
    let t = workT.has(w.id) ? workT.get(w.id)! - dt : Math.random() * job[1];
    if (t <= 0) {
      t = job[1] * jitter(.85, 1.15);
      const p = near(w.x, w.y);
      if (p.vol > .02 && workBudget >= 1) { workBudget--; playSfx(job[0], p.vol * job[2], p.pan, job[3] * jitter(.93, 1.07)) }
    }
    workT.set(w.id, t);
  }
  for (const id of carried.keys()) if (!alive2.has(id)) { carried.delete(id); workT.delete(id) }
}
