// Page d'administration (réservée aux comptes déclarés côté serveur) : chiffres clés et joueurs inscrits,
// dans un tableau triable (clic sur un en-tête) et filtrable (pseudo ou email).
import { MAPS } from '@ffl/shared';
import * as A from '../net/account';

const $ = (id: string): any => document.getElementById(id);
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
const date = (d: string | null, time = false) => d ? new Date(d).toLocaleString('fr-FR', time ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const mmss = (s: number) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
const KIND: Record<string, string> = { ranked: 'classées', online: 'en ligne', solo: 'contre l\'IA' };

type Col = { k: string, label: string, num?: boolean, date?: boolean, fmt?: (u: any) => string };
const COLS: Col[] = [
  { k: 'pseudo', label: 'Pseudo' },
  { k: 'email', label: 'Email' },
  { k: 'createdAt', label: 'Inscription', date: true, fmt: u => date(u.createdAt, true) },
  { k: 'lastLogin', label: 'Dernière connexion', date: true, fmt: u => date(u.lastLogin, true) },
  { k: 'lastGame', label: 'Dernière partie', date: true, fmt: u => date(u.lastGame, true) },
  { k: 'games', label: 'Parties', num: true },
  { k: 'elo1', label: 'Elo 1v1', num: true, fmt: u => u.games1 ? `${u.elo1} <small>(${u.wins1}/${u.games1})</small>` : '—' },
  { k: 'elo2', label: 'Elo 2v2', num: true, fmt: u => u.games2 ? `${u.elo2} <small>(${u.wins2}/${u.games2})</small>` : '—' },
];

export function initAdmin() {
  let users: any[] = [], sortK = 'createdAt', asc = false, filter = '';
  function tiles(s: any) {
    const t = (v: any, l: string, sub = '', txt = false) => `<div class="ad-tile"><b class="${txt ? 'txt' : ''}">${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const kinds = Object.entries(s.byKind).map(([k, v]) => `${v} ${KIND[k] || k}`).join(' · ') || 'aucune';
    const maps = Object.entries(s.byMap).slice(0, 3).map(([k, v]) => `${MAPS[k]?.name || k} (${v})`).join(' · ') || '—';
    $('adTiles').innerHTML =
      t(s.users, 'joueurs inscrits', `+${s.users1} en 24 h · +${s.users7} en 7 j · +${s.users30} en 30 j`) +
      t(s.active7, 'joueurs actifs sur 7 jours', `${s.logins7} connexions sur 7 jours`) +
      t(s.matches, 'parties enregistrées', `${s.matches1} en 24 h · ${s.matches7} en 7 j`) +
      t(s.matches ? mmss(s.avgDuration) : '—', 'durée moyenne d\'une partie', kinds) +
      t(Object.keys(s.byMap).length ? (MAPS[Object.keys(s.byMap)[0]]?.name || '—') : '—', 'carte la plus jouée', maps, true);
  }
  function table() {
    const cols = COLS, f = filter.toLowerCase();
    const l = users.filter(u => !f || u.pseudo.toLowerCase().includes(f) || String(u.email).toLowerCase().includes(f));
    const val = (u: any, c: Col) => c.date ? (u[c.k] ? new Date(u[c.k]).getTime() : 0) : c.num ? (c.k === 'elo1' ? (u.games1 ? u.elo1 : -1) : c.k === 'elo2' ? (u.games2 ? u.elo2 : -1) : +u[c.k] || 0) : String(u[c.k] ?? '').toLowerCase();
    const col = cols.find(c => c.k === sortK)!;
    l.sort((a, b) => { const x = val(a, col), y = val(b, col); return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1) });
    $('adTable').tHead.innerHTML = '<tr>' + cols.map(c => `<th scope="col" class="${c.num ? 'num' : ''}" aria-sort="${c.k === sortK ? (asc ? 'ascending' : 'descending') : 'none'}"><button type="button" data-k="${c.k}">${c.label}${c.k === sortK ? (asc ? ' ▲' : ' ▼') : ''}</button></th>`).join('') + '</tr>';
    $('adTable').tBodies[0].innerHTML = l.length ? l.map(u => '<tr>' + cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.fmt ? c.fmt(u) : esc(u[c.k])}</td>`).join('') + '</tr>').join('')
      : `<tr><td colspan="${cols.length}" class="ad-empty">${users.length ? 'Aucun joueur ne correspond à la recherche.' : 'Aucun joueur inscrit pour l\'instant.'}</td></tr>`;
    $('adCount').textContent = `(${l.length}${l.length !== users.length ? ' sur ' + users.length : ''})`;
  }
  async function load() {
    const u = A.currentUser();
    if (!u) { $('adBody').hidden = true; $('adMsg').textContent = 'Connecte-toi avec un compte administrateur.'; return }
    if (!u.admin) { $('adBody').hidden = true; $('adMsg').textContent = 'Cette page est réservée aux administrateurs.'; return }
    $('adMsg').textContent = 'Chargement…';
    const r = await A.adminStats();
    if (!r.ok) { $('adBody').hidden = true; $('adMsg').textContent = r.data.error || 'Statistiques indisponibles.'; return }
    $('adMsg').textContent = `Mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`;
    users = r.data.users; tiles(r.data.stats); table(); $('adBody').hidden = false;
  }
  $('adTable').addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    const k = b.dataset.k!; if (k === sortK) asc = !asc; else { sortK = k; asc = !(COLS.find(c => c.k === k)!.num || COLS.find(c => c.k === k)!.date) }
    table();
  });
  $('adSearch').addEventListener('input', () => { filter = $('adSearch').value.trim(); table() });
  $('adRefresh').addEventListener('click', load);
  let view = '';
  addEventListener('ffl:view', (e: any) => { view = e.detail; if (view === 'admin') load() });
  addEventListener('ffl:account', () => { if (view === 'admin') load() });
}
