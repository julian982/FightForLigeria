// Le profil public d'un joueur (#joueur?p=Pseudo) : blason et cadre de saison, rangs de la saison en cours avec la place
// au classement, saisons précédentes (rang final, meilleur rang, place, cadre gagné) et dernières parties classées.
// Ouvert à tout le monde, connecté ou non. On y arrive depuis le classement, l'historique des parties ou son compte.
import { ELO, frameName, seasonInfo } from '@ffl/shared';
import * as A from '../net/account';
import { blasonSvg } from './blason';
import { badgeSvg } from './rankbadge';
import { histItem } from './account';

const $ = (id: string): any => document.getElementById(id);
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
const day = (t: number | string) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
/** lien vers le profil d'un joueur */
export const profileHref = (pseudo: string) => '#joueur?p=' + encodeURIComponent(pseudo);

/** la saison en cours en une ligne : « Saison 1 · jusqu'au 1 février 2027 (encore 94 jours) » */
export function seasonLine(s = seasonInfo()) {
  const left = Math.max(0, Math.ceil((s.end - Date.now()) / 86400_000));
  return `Saison ${s.n} · jusqu'au ${day(s.end)} (encore ${left} jour${left > 1 ? 's' : ''})`;
}

/** carte d'un rang de la saison en cours, avec la place au classement et le meilleur rang atteint */
function rankNow(label: string, l: any) {
  const dots = Array.from({ length: ELO.PLACEMENT }, (_, i) => `<i class="${i < l.games ? 'on' : ''}"></i>`).join('');
  return `<div class="pf-rank">${badgeSvg(l.elo, l.placed, 'pf-badge')}<div class="pf-rk"><span class="lbl">${label}</span><b>${l.placed ? l.rank : 'Non classé'}</b>
    <span class="small">${l.elo} Elo${l.placed ? '' : ` · provisoire : ${l.rank}`} · ${l.wins} V – ${l.games - l.wins} D</span>
    ${l.place ? `<span class="small pl-place">${l.place === 1 ? '1er' : l.place + 'e'} du classement${l.peak ? ` · meilleur : ${ELO.rank(l.peak)}` : ''}</span>` : ''}
    ${l.placed ? '' : `<span class="pf-place" aria-label="Parties de placement : ${l.games} sur ${ELO.PLACEMENT}">${dots}<em>${l.games} / ${ELO.PLACEMENT} placement</em></span>`}</div></div>`;
}
/** une saison terminée : cadre gagné, puis une ligne par mode joué */
function pastSeason(s: any, bl: any) {
  const mode = (m: string) => {
    const r = s.modes[m]; if (!r) return '';
    const placed = r.games >= ELO.PLACEMENT;
    return `<div class="ps-mode"><span class="lbl">${m}</span>${badgeSvg(r.elo, placed, 'ps-badge')}
      <div class="ps-txt"><b>${placed ? r.rank : 'Non classé'}</b><span class="small">${r.elo} Elo · ${r.wins} V – ${r.games - r.wins} D</span>
      ${placed ? `<span class="small">${r.place ? (r.place === 1 ? '1er' : r.place + 'e') + ' au classement · ' : ''}meilleur rang : ${esc(r.peakRank || r.rank)}</span>` : `<span class="small">${r.games} / ${ELO.PLACEMENT} parties de placement</span>`}</div></div>`;
  };
  const info = seasonInfo(s.season);
  return `<article class="ps">
    <div class="ps-frame">${s.reward ? blasonSvg(bl, { frame: s.reward }) : `<div class="ps-none">Pas de cadre</div>`}<span class="small">${s.reward ? esc(frameName(s.reward)) : 'Jamais placé'}</span></div>
    <div class="ps-body"><h4>Saison ${s.season}</h4><p class="help small">${day(info.start)} – ${day(info.end)}</p>${mode('1v1')}${mode('2v2')}</div>
  </article>`;
}

export function initProfile() {
  let req = 0;
  async function load() {
    const pseudo = new URLSearchParams(location.hash.split('?')[1] || '').get('p') || A.currentUser()?.pseudo || '';
    const id = ++req;
    $('plBody').hidden = true; $('plMsg').classList.remove('warn');
    if (!pseudo) { $('plMsg').textContent = 'Aucun joueur choisi. Ouvre un profil depuis le classement.'; return }
    $('plMsg').textContent = 'Chargement du profil…';
    const r = await A.profile(pseudo);
    if (id !== req) return;
    if (!r.ok) { $('plMsg').textContent = r.data.error || 'Profil indisponible.'; $('plMsg').classList.add('warn'); return }
    const p = r.data; $('plMsg').textContent = '';
    document.title = `${p.pseudo} · FightForLigeria`;
    $('plT').textContent = p.pseudo;
    $('plBlason').innerHTML = blasonSvg(p.blason, { title: 'Blason de ' + p.pseudo, frame: p.frame });
    $('plSince').textContent = `Seigneur depuis le ${day(p.createdAt)}`;
    $('plFrame').innerHTML = p.frame ? `Cadre de blason : <b>${esc(frameName(p.frame))}</b>` : 'Pas encore de cadre de saison : il se gagne en fin de saison, une fois placé.';
    $('plBtns').innerHTML = p.you ? `<a class="go ghost" href="#compte">Mon compte</a><a class="go ghost" href="#parties">Mes parties</a>` : '';
    $('plSeasonT').textContent = seasonLine(p.season);
    $('plRanks').innerHTML = rankNow('Classé 1v1', p.r1) + rankNow('Classé 2v2', p.r2);
    $('plSeasons').innerHTML = p.seasons.length ? p.seasons.map((s: any) => pastSeason(s, p.blason)).join('')
      : `<p class="help">Aucune saison terminée pour l'instant. À la fin de la saison ${p.season.n}, son résultat et son cadre de blason s'afficheront ici.</p>`;
    $('plMatches').innerHTML = p.matches.length ? p.matches.map(histItem).join('') : '<p class="help">Pas encore de partie classée.</p>';
    $('plBody').hidden = false;
  }
  // chaque changement d'adresse (même d'un profil à un autre) repasse par la vue « joueur »
  addEventListener('ffl:view', (e: any) => { if (e.detail === 'joueur') load() });
  // page ouverte directement sur un profil : la vue a été choisie avant que ce module écoute
  if ((window as any).__homeView === 'joueur') load();
}
