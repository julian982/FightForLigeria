// La discussion pendant la partie (en bas à gauche, Entrée pour écrire) et sur l'écran de fin.
// Les messages viennent du salon (ui/online.ts) : la même discussion continue avant, pendant et après la partie.
import { G } from '@ffl/shared';
import { TEAMC } from '../render/engine';
import { $, keys, ui } from '../state';
import * as N from '../net/online';
import { getChat } from './online';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
/** un message reste affiché 12 s pendant la partie, puis s'efface (il revient quand on ouvre la discussion) */
const SHOW_MS = 12000;
const line = (m: any) => m.sys ? `<p class="sys">${esc(m.text)}</p>` : m.warn ? `<p class="warn">${esc(m.text)}</p>`
  : `<p><b style="color:color-mix(in srgb, ${(TEAMC[m.team] || TEAMC[0]).m} 55%, white)">${esc(m.who)}</b>${esc(m.text)}</p>`;
const isOnline = () => !!(G && G.online);
let open = false, lastKey = '';

function render() {
  const on = isOnline(), box = $('gChat');
  box.hidden = !on || $('play').hidden || !$('end').hidden;
  if (!box.hidden) {
    box.style.bottom = ($('hudBot').offsetHeight + 10) + 'px';
    const now = Date.now(), list = getChat().slice(open ? -40 : -8), log = $('gChatLog');
    // on ne redessine que si la discussion a changé ; sinon on fait seulement s'effacer les vieux messages
    const key = (open ? 'o' : 'c') + list.map(m => (m.at || 0) + m.text).join('|');
    if (key !== lastKey) { lastKey = key; log.innerHTML = list.map(line).join(''); log.scrollTop = log.scrollHeight }
    log.querySelectorAll('p').forEach((p: any, i: number) => p.classList.toggle('old', !open && now - (list[i].at || 0) > SHOW_MS));
  }
  // écran de fin : la discussion à côté du bilan (parties en ligne seulement)
  $('eChat').hidden = !on; $('end').querySelector('.end-card').classList.toggle('with-chat', on);
  if (on) { const l = $('eChatLog'), atEnd = l.scrollHeight - l.scrollTop - l.clientHeight < 40; l.innerHTML = getChat().slice(-60).map(line).join(''); if (atEnd) l.scrollTop = l.scrollHeight }
}
function setOpen(v: boolean) {
  open = v; $('gChat').classList.toggle('open', v); $('gChatForm').hidden = !v;
  if (v) { for (const k in keys) keys[k] = false; $('gChatIn').focus() } else { $('gChatIn').value = ''; $('gChatIn').blur() }
  render();
}
export function initGameChat() {
  addEventListener('ffl:chat', render);
  // les messages s'effacent tout seuls : on rafraîchit l'affichage de temps en temps
  setInterval(() => { if (isOnline() && !$('play').hidden) render() }, 1000);
  // Entrée ouvre la discussion pendant la partie
  addEventListener('keydown', (e: any) => {
    if (e.key !== 'Enter' || open || !isOnline() || !ui.running || $('play').hidden) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault(); setOpen(true);
  }, true);
  $('gChatIn').addEventListener('keydown', (e: any) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (e.key === 'Enter') { e.preventDefault(); const t = e.target.value.trim(); if (t) N.sendChat(t); setOpen(false) }
    e.stopPropagation();
  });
  $('gChatForm').addEventListener('submit', (e: Event) => e.preventDefault());
  $('gChatIn').addEventListener('blur', () => { if (open) setTimeout(() => { if (document.activeElement !== $('gChatIn')) setOpen(false) }, 0) });
  $('eChatForm').addEventListener('submit', (e: Event) => { e.preventDefault(); const t = $('eChatIn').value.trim(); if (t) N.sendChat(t); $('eChatIn').value = '' });
}
/** à appeler au début et à la fin d'une partie pour mettre l'affichage à jour */
export const refreshGameChat = () => { if (open && $('play').hidden) setOpen(false); render() };
