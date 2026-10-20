// Animation du tir à l'arc (archers et seigneurs) : le bras lève l'arc devant soi, l'autre main tire la corde jusqu'à
// la joue avec une flèche encochée, puis relâche (la corde claque, l'arc reste levé un instant, puis redescend).
// - le seigneur bande pendant toute la charge (barre d'espace), la corde se tend avec la puissance ;
// - un archer au combat bande pendant les 0,6 s qui précèdent chaque tir (rythme de son rechargement).
// Tout est déduit de ce que le jeu affiche déjà (flèches qui partent, charge du seigneur) : marche aussi en ligne.
import * as THREE from 'three';
import { G, UT, CHARGE_T } from '@ffl/shared';
import { SHOULDER, ARM_LEN, bowTips } from './people';

const DOWN = new THREE.Vector3(0, -1, 0);
const IDLE_L = new THREE.Vector3(.28, -1, .05).normalize(), AIM_L = new THREE.Vector3(1, .05, .14).normalize();
const IDLE_R = new THREE.Vector3(.12, -1, -.05).normalize();
// orientation de l'arc dans le repère du personnage : au repos incliné vers l'avant, en visée bien droit
const BOW_IDLE = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -.55)), BOW_AIM = new THREE.Quaternion().setFromEuler(new THREE.Euler(.12, 0, 0));
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), v = new THREE.Vector3(), w = new THREE.Vector3(), nock = new THREE.Vector3();
const PULL: Record<string, number> = { archer: .25, lord: .29 };

let lastG: any = null;
const seen = new Set<number>();
/** à chaque image, avant d'animer : repère les flèches qui viennent de partir (et qui les a tirées) */
export function scanShots(now: number) {
  if (G !== lastG) { lastG = G; seen.clear(); for (const a of G.arrows) seen.add(a.id); return }
  const alive = new Set<number>();
  for (const a of G.arrows) {
    alive.add(a.id); if (seen.has(a.id)) continue; seen.add(a.id);
    const u = a.lord ? G.teams[a.team]?.lord : a.by ? G.units.find((x: any) => x.id === a.by) : null;
    if (u && u.rig) u.rig.shot = now;
  }
  for (const id of seen) if (!alive.has(id)) seen.delete(id);
}

/** pose de l'arc d'un archer ou d'un seigneur (`now` en secondes, horloge de l'affichage) */
export function animBow(u: any, dt: number, now: number) {
  const r = u.rig; if (!r) return;
  let aim = 0, draw = 0;
  const since = r.shot == null ? 1e9 : now - r.shot;
  if (u.type === 'lord') {
    const c = G.ctrl && G.ctrl[u.team];
    if (c && c.charging && !u.dead) { aim = 1; draw = Math.min(1, Math.max(.08, (G.t - c.start) / CHARGE_T)) }
    else if (since < .55) aim = 1;                         // le temps de voir partir la flèche
  } else {
    const cd = UT.archer.cd;
    if (since < cd + .5) {                                  // au combat : rythme du rechargement
      aim = 1;
      if (since > cd - .6) draw = Math.min(1, (since - (cd - .6)) / .55);
    }
  }
  if (u.dead) aim = draw = 0;
  // lissage : le bras monte et descend sans à-coup, la corde claque d'un coup au lâcher
  const k = Math.min(1, dt * (aim > r.aim ? 9 : 4));
  r.aim += (aim - r.aim) * k;
  r.draw = draw < r.draw ? draw : r.draw + (draw - r.draw) * Math.min(1, dt * 14);

  // bras d'arc : de pendant à tendu devant soi
  v.copy(IDLE_L).lerp(AIM_L, r.aim).normalize();
  r.armL.quaternion.setFromUnitVectors(DOWN, v);
  // l'arc garde son orientation propre (droit en visée), quel que soit l'angle du bras
  qA.copy(BOW_IDLE).slerp(BOW_AIM, r.aim);
  r.hand.quaternion.copy(r.armL.quaternion).invert().multiply(qA);

  // la corde : deux brins des extrémités de l'arc jusqu'au point d'encoche, tiré vers l'arrière
  const t = bowTips(u.type), pull = r.draw * (PULL[u.type] || .17);
  nock.set(t.x - pull, 0, t.z);
  seg(r.sTop, t.x, t.h, t.z, nock); seg(r.sBot, t.x, -t.h, t.z, nock);
  // la flèche encochée : visible pendant que l'arc est bandé
  r.arrow.visible = r.draw > .04 && r.aim > .6;
  if (r.arrow.visible) r.arrow.position.copy(nock);

  // bras qui tire : vers le point d'encoche quand on bande, sinon le long du corps
  const nockWorld = w.copy(nock).applyQuaternion(r.hand.quaternion).add(v.set(0, -ARM_LEN, 0)).applyQuaternion(r.armL.quaternion).add(v.set(0, SHOULDER.y, -SHOULDER.z));
  const toNock = nockWorld.sub(v.set(0, SHOULDER.y, SHOULDER.z)).normalize();
  const reach = Math.min(1, r.aim * (.35 + .65 * Math.min(1, r.draw * 3)));
  v.copy(IDLE_R).lerp(toNock, reach).normalize();
  r.armR.quaternion.setFromUnitVectors(DOWN, v);
  // le personnage s'incline un peu en arrière en bandant (le corps est tourné par sync.ts)
  return r.draw;
}
/** place un brin de corde (boîte d'une unité de haut) entre (x, y, z) et le point d'encoche */
function seg(m: any, x: number, y: number, z: number, n: THREE.Vector3) {
  const dx = n.x - x, dy = n.y - y, len = Math.hypot(dx, dy);
  m.position.set((x + n.x) / 2, (y + n.y) / 2, z);
  m.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
  m.scale.set(1, Math.max(.001, len), 1);
}
/** le flash rouge d'un coup reçu s'applique aussi aux pièces articulées */
export function rigMaterial(u: any, mat: any) { if (u.rig) for (const m of u.rig.meshes) m.material = mat }
