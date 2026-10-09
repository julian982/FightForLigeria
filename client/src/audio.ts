// Le son : pour l'instant l'ambiance nature (boucle), avec volume réglable et coupure. Réglages gardés dans le navigateur.
import natureUrl from './assets/sounds/ambiance-nature.mp3?url';

const KEY = 'ffl.audio';
export const audio = { ambiance: .5, muted: false };
try { Object.assign(audio, JSON.parse(localStorage.getItem(KEY) || '{}')) } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(audio)) } catch (e) {} }

let ctx: AudioContext | null = null, master: GainNode, ambGain: GainNode, ambSrc: AudioBufferSourceNode | null = null, ambBuf: AudioBuffer | null = null, loading: Promise<void> | null = null;
let wanted = false;
function ensure() {
  if (!ctx) {
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
  return true;
}
function ramp(g: GainNode, v: number, sec: number) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + sec) }
const ambTarget = () => audio.muted ? 0 : audio.ambiance * .8;
function loadAmb() {
  if (ambBuf) return Promise.resolve();
  if (!loading) loading = fetch(natureUrl).then(r => r.arrayBuffer()).then(b => new Promise<void>((ok, ko) => ctx.decodeAudioData(b, buf => { ambBuf = buf; ok() }, ko)));
  return loading;
}
/** lance l'ambiance en fondu (à appeler après un clic : les navigateurs l'exigent) */
export async function startAmbiance() {
  wanted = true;
  try {
    if (!ensure()) return; await loadAmb(); if (!wanted) return;
    if (!ambSrc) { ambSrc = ctx.createBufferSource(); ambSrc.buffer = ambBuf; ambSrc.loop = true; ambSrc.connect(ambGain); ambSrc.start(0, Math.random() * ambBuf.duration) }
    ramp(ambGain, ambTarget(), 2.5);
  } catch (e) { /* pas de son : le jeu continue */ }
}
/** coupe l'ambiance en fondu (retour au menu) */
export function stopAmbiance() {
  wanted = false; if (!ctx || !ambSrc) return;
  ramp(ambGain, 0, 1.2); const s = ambSrc; ambSrc = null; setTimeout(() => { try { s.stop() } catch (e) {} }, 1300);
}
export function setAmbianceVolume(v: number) { audio.ambiance = Math.max(0, Math.min(1, v)); save(); if (ctx && ambSrc) ramp(ambGain, ambTarget(), .15) }
export function setMuted(m: boolean) { audio.muted = m; save(); if (ctx && ambSrc) ramp(ambGain, ambTarget(), .3) }
// onglet caché : on met le son en pause
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (wanted) ctx.resume() });
/** pour les tests */
export function audioState() { return { ctx: ctx ? ctx.state : null, playing: !!ambSrc, loaded: !!ambBuf, gain: ambGain ? +ambGain.gain.value.toFixed(2) : 0, dur: ambBuf ? Math.round(ambBuf.duration) : 0 } }
