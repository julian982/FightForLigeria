// Une partie en ligne tourne dans son propre fil d'exécution : la simulation de shared/ y est isolée des autres parties.
import { parentPort, workerData } from 'node:worker_threads';
import { loadMap, newGame, update, setHooks, G, applyCommand, makeSnapshot, forfeit } from '@ffl/shared';

const STEP = 1 / 60, SNAP_EVERY = 50; // simulation à 60 Hz, instantané toutes les 50 ms
const SPEED = workerData.speed > 1 ? 1.5 : 1; // vitesse « rapide » : le temps du jeu avance 1,5 fois plus vite
const post = (m: any) => parentPort!.postMessage(m);
const fell: number[] = [];
let ended = false;

loadMap(workerData.map, workerData.mode === '2v2' ? '2v2' : '1v1');
setHooks({
  removed: e => { if (e.wood !== undefined && !e.kind && e.id != null) fell.push(e.id) },
  notify: (team, msg, kind) => post({ type: 'note', team, msg, kind }),
  end: winner => { ended = true; sendSnap(); post({ type: 'end', winner, st: G.st, t: G.t }) },
});
// les places tenues par l'IA dans le salon sont jouées par l'IA de shared/
newGame({ rich: !!workerData.rich, ai: Array.isArray(workerData.ai) ? workerData.ai.map(Boolean) : [] });

function sendSnap() { post({ type: 'snap', snap: makeSnapshot(fell.splice(0)) }) }

parentPort!.on('message', (m: any) => {
  if (m.type === 'cmd') { const err = applyCommand(m.team, m.cmd); if (err) post({ type: 'note', team: m.team, msg: err, kind: 'warn' }) }
  else if (m.type === 'forfeit') forfeit(m.team);
});

let last = performance.now(), acc = 0, snapT = 0;
const timer = setInterval(() => {
  const now = performance.now(), dt = Math.min(.25, (now - last) / 1000); last = now;
  acc += dt; snapT += dt * 1000;
  while (acc >= STEP && !ended) { update(STEP * SPEED); acc -= STEP }
  if (ended) { clearInterval(timer); return }
  if (snapT >= SNAP_EVERY) { snapT = 0; sendSnap() }
}, 8);
post({ type: 'ready' });
