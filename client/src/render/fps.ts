// Vue seigneur (touche V) : caméra à la première personne, uniquement pour tirer à l'arc.
import * as THREE from 'three';
import { CHARGE_T, G, S, gh } from '@ffl/shared';
import { octx, scene } from './engine';
import { $, ME, ui, view } from '../state';

export const SKY = 0xbcd4e6;
export const fpsCam = new THREE.PerspectiveCamera(70, 1, .05, 220);
export const look = new THREE.Vector3();

/** passe en vue seigneur : on regarde dans la direction où il vise */
export function enterFps() {
  const L = G && G.teams[ME].lord; if (!ui.running || !L || L.dead) return;
  ui.fps = true; ui.placing = null; ui.box = null;
  view.fpsYaw = L.face; view.fpsPitch = -.22;
  scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 22, 70);
  $('play').classList.add('fps');
  const c: any = $('game'); try { c.requestPointerLock && c.requestPointerLock() } catch (e) {}
}
export function exitFps() {
  if (!ui.fps) return;
  ui.fps = false; scene.background = null; scene.fog = null;
  $('play').classList.remove('fps');
  const L = G && G.teams[ME].lord; if (L && L.obj) L.obj.visible = true;
  if (document.pointerLockElement) try { document.exitPointerLock() } catch (e) {}
}
/** souris en vue seigneur : gauche/droite tourne, haut/bas regarde */
export function fpsLook(dx: number, dy: number) {
  view.fpsYaw += dx * .0028;
  view.fpsPitch = Math.max(-.6, Math.min(.45, view.fpsPitch - dy * .0028));
}
export function updateFps() {
  const L = G.teams[ME].lord;
  if (L.dead || !ui.running) { exitFps(); return }
  if (L.obj) L.obj.visible = false;
  fpsCam.aspect = view.VW / view.VH; fpsCam.updateProjectionMatrix();
  const x = L.x * S, z = L.y * S, y = gh(L.x, L.y) + 1.05, cy = Math.cos(view.fpsYaw), sy = Math.sin(view.fpsYaw), cp = Math.cos(view.fpsPitch);
  fpsCam.position.set(x + cy * .12, y, z + sy * .12);
  look.set(x + cy * cp * 10, y + Math.sin(view.fpsPitch) * 10, z + sy * cp * 10);
  fpsCam.lookAt(look);
}
/** viseur au centre de l'écran, avec la charge de l'arc autour */
export function drawFpsOverlay() {
  const L = G.teams[ME].lord, cx = view.VW / 2, cy = view.VH / 2, c = G.ctrl[ME];
  octx.save();
  octx.strokeStyle = 'rgba(255,241,201,.9)'; octx.lineWidth = 2;
  octx.beginPath(); octx.moveTo(cx - 12, cy); octx.lineTo(cx - 4, cy); octx.moveTo(cx + 4, cy); octx.lineTo(cx + 12, cy);
  octx.moveTo(cx, cy - 12); octx.lineTo(cx, cy - 4); octx.moveTo(cx, cy + 4); octx.lineTo(cx, cy + 12); octx.stroke();
  if (c.charging) {
    const ch = Math.min(1, (G.t - c.start) / CHARGE_T);
    octx.strokeStyle = ch >= 1 ? '#ffe08a' : '#e3b54e'; octx.lineWidth = 3;
    octx.beginPath(); octx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + ch * Math.PI * 2); octx.stroke();
  }
  octx.font = '700 14px "Alegreya Sans", sans-serif'; octx.textAlign = 'center'; octx.lineWidth = 3; octx.strokeStyle = 'rgba(0,0,0,.6)'; octx.fillStyle = '#efe7d6';
  const s = `${G.teams[ME].res.fleche} flèches · ZQSD : marcher · Espace ou clic : tirer · V : quitter`;
  octx.strokeText(s, cx, view.VH - 28); octx.fillText(s, cx, view.VH - 28);
  octx.restore();
}
// Échap libère la souris : on quitte aussi la vue seigneur
export let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hadLock = true;
  else if (hadLock) { hadLock = false; exitFps() }
});
