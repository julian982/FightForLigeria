// Le son : l'ambiance nature (3 boucles de 3 minutes, une tirée au hasard à chaque partie) et les bruitages (arc, travail des ouvriers, dépôts), avec volumes réglables
// et coupure. Réglages gardés dans le navigateur.
import amb1Url from './assets/sounds/ambiance-1.mp3?url';
import amb2Url from './assets/sounds/ambiance-2.mp3?url';
import amb3Url from './assets/sounds/ambiance-3.mp3?url';
import choixUrl from './assets/sounds/ui-choix.mp3?url';
import poseUrl from './assets/sounds/ui-pose.mp3?url';
import bandUrl from './assets/sounds/arc-bander.mp3?url';
import tirUrl from './assets/sounds/arc-tir.mp3?url';
import chairUrl from './assets/sounds/impact-chair.mp3?url';
import boisUrl from './assets/sounds/impact-bois.mp3?url';
import solUrl from './assets/sounds/impact-sol.mp3?url';
import coupeUrl from './assets/sounds/coupe-bois.mp3?url';
import tailleUrl from './assets/sounds/taille-pierre.mp3?url';
import picUrl from './assets/sounds/pic-fer.mp3?url';
import enclumeUrl from './assets/sounds/enclume.mp3?url';
import atelierUrl from './assets/sounds/atelier.mp3?url';
import fauxUrl from './assets/sounds/faux.mp3?url';
import dBoisUrl from './assets/sounds/depot-bois.mp3?url';
import dPierreUrl from './assets/sounds/depot-pierre.mp3?url';
import dFerUrl from './assets/sounds/depot-fer.mp3?url';
import dBleUrl from './assets/sounds/depot-ble.mp3?url';
import dArmesUrl from './assets/sounds/depot-armes.mp3?url';

const KEY = 'ffl.audio';
export const audio = { ambiance: .35, sfx: .7, muted: false };
try { Object.assign(audio, JSON.parse(localStorage.getItem(KEY) || '{}')) } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(audio)) } catch (e) {} }

let ctx: AudioContext | null = null, master: GainNode, sfxGain: GainNode, ambGain: GainNode, ambSrc: AudioBufferSourceNode | null = null, ambBuf: AudioBuffer | null = null;
let wanted = false;
function ensure() {
  if (!ctx) {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxTarget(); sfxGain.connect(master);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
  return true;
}
function ramp(g: GainNode, v: number, sec: number) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + sec) }
// l'ambiance reste un fond discret : même à 100 %, elle ne couvre pas les bruitages
const ambTarget = () => audio.muted ? 0 : audio.ambiance * .275;
const sfxTarget = () => audio.muted ? 0 : audio.sfx;
/** les trois boucles d'ambiance : chaque partie en joue une au hasard (chacune est raccordée en fondu, sans coupure) */
const AMB_URLS = [amb1Url, amb2Url, amb3Url];
const ambBufs = new Map<string, Promise<AudioBuffer>>();
function loadAmb(url: string) {
  if (!ambBufs.has(url)) ambBufs.set(url, fetch(url).then(r => r.arrayBuffer()).then(b => new Promise<AudioBuffer>((ok, ko) => ctx!.decodeAudioData(b, ok, ko))));
  return ambBufs.get(url)!;
}
let ambGen = 0;
/** lance une ambiance en fondu (à appeler après un clic : les navigateurs l'exigent) */
export async function startAmbiance() {
  wanted = true; const gen = ++ambGen;
  try {
    if (!ensure()) return;
    if (ambSrc) { ramp(ambGain, ambTarget(), 1); return }
    const buf = await loadAmb(AMB_URLS[(Math.random() * AMB_URLS.length) | 0]);
    if (!wanted || gen !== ambGen || ambSrc) return;
    ambBuf = buf;
    ambSrc = ctx!.createBufferSource(); ambSrc.buffer = buf; ambSrc.loop = true; ambSrc.connect(ambGain);
    ambSrc.start(0, Math.random() * buf.duration); // départ à un moment différent de la boucle
    ramp(ambGain, ambTarget(), 2.5);
  } catch (e) { /* pas de son : le jeu continue */ }
}
/** coupe l'ambiance en fondu (retour au menu) */
export function stopAmbiance() {
  wanted = false; if (!ctx || !ambSrc) return;
  ramp(ambGain, 0, 1.2); const s = ambSrc; ambSrc = null; setTimeout(() => { try { s.stop() } catch (e) {} }, 1300);
}
export function setAmbianceVolume(v: number) { audio.ambiance = Math.max(0, Math.min(1, v)); save(); if (ctx && ambSrc) ramp(ambGain, ambTarget(), .15) }
export function setMuted(m: boolean) { audio.muted = m; save(); if (ctx && ambSrc) ramp(ambGain, ambTarget(), .3); if (ctx) ramp(sfxGain, sfxTarget(), .1) }
export function setSfxVolume(v: number) { audio.sfx = Math.max(0, Math.min(1, v)); save(); if (ctx) ramp(sfxGain, sfxTarget(), .1) }
// onglet caché : on met le son en pause
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (wanted) ctx.resume() });
/** pour les tests */
export function audioState() { return { sfx: { ...sfxCount }, sfxLoaded: Object.keys(sfxBuf).length, ctx: ctx ? ctx.state : null, playing: !!ambSrc, loaded: !!ambBuf, gain: ambGain ? +ambGain.gain.value.toFixed(2) : 0, dur: ambBuf ? Math.round(ambBuf.duration) : 0 } }

// ---- bruitages ----
const SFX_URL: Record<string, string> = { bander: bandUrl, tir: tirUrl, chair: chairUrl, bois: boisUrl, sol: solUrl,
  coupe: coupeUrl, taille: tailleUrl, pic: picUrl, enclume: enclumeUrl, atelier: atelierUrl, faux: fauxUrl,
  'd-bois': dBoisUrl, 'd-pierre': dPierreUrl, 'd-fer': dFerUrl, 'd-ble': dBleUrl, 'd-armes': dArmesUrl,
  // interface : choisir un bâtiment à construire, le poser
  choix: choixUrl, pose: poseUrl };
const sfxBuf: Record<string, AudioBuffer> = {};
/** nombre de bruitages joués, par nom (pour les tests) */
const sfxCount: Record<string, number> = {};
let sfxLoading: Promise<void> | null = null;
/** charge les bruitages (petits fichiers, une seule fois) */
export function loadSfx() {
  if (!ensure()) return Promise.resolve();
  if (!sfxLoading) sfxLoading = Promise.all(Object.entries(SFX_URL).map(([k, u]) => fetch(u).then(r => r.arrayBuffer())
    .then(b => new Promise<void>(ok => ctx.decodeAudioData(b, buf => { sfxBuf[k] = buf; ok() }, () => ok()))).catch(() => {}))).then(() => {});
  return sfxLoading;
}
export interface Voice { stop(fadeSec?: number): void }
/** joue un bruitage. vol : 0 à 1, pan : -1 (gauche) à 1 (droite), rate : vitesse (et hauteur) de lecture */
export function playSfx(name: string, vol = 1, pan = 0, rate = 1): Voice | null {
  if (!ctx || audio.muted || audio.sfx <= 0 || vol <= .01 || ctx.state !== 'running') return null;
  const buf = sfxBuf[name]; if (!buf) return null;
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; let out: AudioNode = g;
  if (pan && (ctx as any).createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p }
  src.connect(g); out.connect(sfxGain); src.start(); sfxCount[name] = (sfxCount[name] || 0) + 1;
  return { stop(fadeSec = .06) { try { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fadeSec); src.stop(t + fadeSec + .02) } catch (e) {} } };
}
