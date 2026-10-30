// La partie classée côté navigateur : classement en direct, file d'attente, et l'animation de fin de partie classée
// (Elo qui monte ou descend, rang actuel, promotion ou rétrogradation).
import { ELO, MAPS } from '@ffl/shared';
import * as A from '../net/account';
import * as Q from '../net/ranked';
import { setRankedHandlers } from '../net/online';
import { blasonSvg } from './blason';
import { badgeSvg } from './rankbadge';
import { seasonLine, profileHref } from './profile';

const $ = (id: string): any => document.getElementById(id);
const all = (q: string): any[] => Array.from(document.querySelectorAll(q));
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
const fmt = (t: number) => Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
const ladderOf = (u: A.User | null, mode: string) => u ? (mode === '2v2' ? u.r2 : u.r1) : null;
const rankLine = (l: A.Ladder) => l.placed ? `${l.rank} · ${l.elo} Elo` : `Non classé · ${l.elo} Elo · placement ${l.games} / ${ELO.PLACEMENT}`;

export function initRanked() {
  let view = '';
  // ================= classement =================
  let boardMode = '1v1';
  try { if (localStorage.getItem('ffl.rankMode') === '2v2') boardMode = '2v2' } catch (e) {}
  let boardReq = 0;
  async function renderBoard() {
    const mode = boardMode, req = ++boardReq, u = A.currentUser(), l = ladderOf(u, mode);
    $('seasonLine').textContent = seasonLine();
    // ton rang
    if (l) {
      $('meBadge').innerHTML = badgeSvg(l.elo, l.placed).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      $('meRk').textContent = l.placed ? l.rank : 'Non classé';
      $('meSub').textContent = l.placed ? `${l.elo} Elo · ${l.wins} V – ${l.games - l.wins} D` : `${l.games} / ${ELO.PLACEMENT} parties de placement · ${l.elo} Elo`;
      $('mePlace').hidden = l.placed;
      $('mePlace').innerHTML = Array.from({ length: ELO.PLACEMENT }, (_, i) => `<i class="${i < l.games ? 'on' : ''}"></i>`).join('');
      $('mePlace').setAttribute('aria-label', `Parties de placement jouées : ${Math.min(l.games, 5)} sur 5`);
      $('meText').innerHTML = l.placed ? `Tu as joué <b>${l.games}</b> parties classées en ${mode}. Chaque partie fait bouger ton Elo : regarde le simulateur plus bas pour savoir combien tu risques.`
        : `Encore <b>${ELO.PLACEMENT - l.games}</b> partie${ELO.PLACEMENT - l.games > 1 ? 's' : ''} de placement en ${mode} avant d'apparaître dans le classement. Pendant le placement, ton Elo bouge deux fois plus vite.`;
      $('meBtns').innerHTML = `<a class="go" href="#file">Jouer en classé</a><a class="go ghost" href="${profileHref(u!.pseudo)}">Mon profil</a>`;
    } else {
      $('meBadge').innerHTML = badgeSvg(ELO.START, false).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      $('meRk').textContent = 'Non classé'; $('meSub').textContent = '0 / 5 parties de placement'; $('mePlace').hidden = false;
      $('mePlace').innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
      $('meBtns').innerHTML = `<a class="go" href="#compte">Créer un compte pour jouer en classé</a>`;
    }
    // le tableau
    const empty = $('boardEmpty'), board = empty.parentElement;
    for (const r of Array.from(board.querySelectorAll('.board-row:not(.h)'))) (r as HTMLElement).remove();
    empty.hidden = false; empty.textContent = 'Chargement du classement…';
    const r = await A.leaderboard(mode);
    if (req !== boardReq) return;
    if (!r.ok) { empty.textContent = r.data.error || 'Classement indisponible pour le moment.'; return }
    const ps: any[] = r.data.players;
    if (!ps.length) { empty.textContent = `Personne n'est encore placé en ${mode}. Les seigneurs apparaissent ici après leurs ${ELO.PLACEMENT} parties de placement : à toi de jouer !`; return }
    empty.hidden = true;
    board.insertAdjacentHTML('beforeend', ps.map(p => `<div class="board-row${p.you ? ' you' : ''}"><span class="b-place">${p.place}</span>
      <a class="b-who" href="${profileHref(p.pseudo)}">${blasonSvg(p.blason, { frame: p.frame })}<b>${esc(p.pseudo)}</b></a><span class="b-rank">${badgeSvg(p.elo, true)}${p.rank}</span><span class="b-elo">${p.elo}</span></div>`).join(''));
    if (r.data.me && r.data.me.place && r.data.me.place > ps.length)
      board.insertAdjacentHTML('beforeend', `<div class="board-row you"><span class="b-place">${r.data.me.place}</span><a class="b-who" href="${profileHref(u!.pseudo)}">${blasonSvg(u!.blason, { frame: u!.frame })}<b>${esc(u!.pseudo)}</b></a><span class="b-rank">${badgeSvg(r.data.me.elo, true)}${r.data.me.rank}</span><span class="b-elo">${r.data.me.elo}</span></div>`);
  }
  addEventListener('ffl:rankmode', (e: any) => { boardMode = e.detail; if (view === 'classement') renderBoard() });

  // ================= file classée =================
  let qMode: '1v1' | '2v2' = '1v1', searching = false, matched = false, waited = 0, clock: any = null;
  const WIN_ROWS = [100, 250, 500, null];
  function renderQueueIdle() {
    const u = A.currentUser();
    $('qLogin').hidden = !!u; $('qCard').hidden = !u;
    for (const b of all('.qtab')) b.setAttribute('aria-selected', String(b.dataset.q === qMode));
    if (!u) return;
    const l = ladderOf(u, qMode)!;
    $('qBl').innerHTML = blasonSvg(u.blason);
    $('qModeLbl').textContent = `File ${qMode} · ${u.pseudo}`;
    $('qRank').innerHTML = `${badgeSvg(l.elo, l.placed, 'q-badge')}<span>${rankLine(l)}</span>`;
    if (!searching && !matched) {
      $('qStatus').textContent = 'Prêt à chercher un adversaire.'; $('qTimer').textContent = '0:00'; $('qWindow').textContent = '±100 Elo';
      $('qBar').style.width = '0%'; $('qCount').textContent = '';
      for (const tr of $('qRules').children) tr.classList.remove('on');
    }
    $('qStart').hidden = searching || matched; $('qCancel').hidden = !searching;
    for (const b of all('.qtab')) b.disabled = searching || matched;
  }
  function qStatus(m: { waited: number, window: number | null, players: number }) {
    if (!searching) return;
    waited = m.waited;
    $('qTimer').textContent = fmt(waited);
    $('qWindow').textContent = m.window == null ? "N'importe qui" : `±${m.window} Elo`;
    $('qBar').style.width = Math.min(100, waited / 60 * 100) + '%';
    const wi = WIN_ROWS.indexOf(m.window);
    for (const tr of $('qRules').children) tr.classList.toggle('on', +tr.dataset.w === wi);
    const others = Math.max(0, m.players - 1);
    $('qCount').textContent = others ? `${others} autre${others > 1 ? 's' : ''} seigneur${others > 1 ? 's' : ''} dans la file ${qMode}` : `Tu es seul dans la file ${qMode} pour l'instant`;
    $('qStatus').textContent = qMode === '2v2' ? `Recherche de trois seigneurs de ton niveau…` : `Recherche d'un adversaire de ton niveau…`;
  }
  function stopSearch(msg = '', warn = false) {
    searching = false; clearInterval(clock); clock = null;
    Q.leaveQueue(); say(msg, warn); renderQueueIdle();
  }
  function say(text: string, warn = false) { const el = $('qMsg'); el.textContent = text; el.classList.toggle('warn', warn) }
  async function startSearch() {
    if (searching || matched || !A.currentUser()) return;
    searching = true; waited = 0; say(''); renderQueueIdle();
    $('qStatus').textContent = 'Connexion à la file…';
    // l'horloge avance d'elle-même entre deux nouvelles du serveur
    clock = setInterval(() => { if (searching) { waited++; $('qTimer').textContent = fmt(waited) } }, 1000);
    const ok = await Q.enterQueue(qMode, {
      status: qStatus,
      match(m) {
        searching = false; matched = true; clearInterval(clock); clock = null; renderQueueIdle();
        $('qStatus').textContent = `Partie trouvée ! ${MAPS[m.map]?.name || ''} · ${m.mode}`; $('qCount').textContent = 'Connexion à la partie…';
        playChime();
      },
      joined(ok) {
        if (!ok) { matched = false; say('Impossible de rejoindre la partie. Relance la recherche.', true); renderQueueIdle(); return }
        $('qCount').textContent = qMode === '2v2' ? 'En attente des autres seigneurs…' : 'En attente de ton adversaire…';
      },
      error(msg) { matched = false; stopSearch(msg, true) },
    });
    if (!ok) { searching = false; clearInterval(clock); renderQueueIdle() }
  }
  $('qStart').addEventListener('click', startSearch);
  $('qCancel').addEventListener('click', () => stopSearch('Recherche annulée.'));
  for (const b of all('.qtab')) b.addEventListener('click', () => { if (searching || matched) return; qMode = b.dataset.q; try { localStorage.setItem('ffl.qMode', qMode) } catch (e) {} renderQueueIdle() });
  try { if (localStorage.getItem('ffl.qMode') === '2v2') qMode = '2v2' } catch (e) {}
  // partie annulée avant de commencer (quelqu'un n'est pas venu)
  setRankedHandlers({ cancel(msg) { matched = false; (window as any).__showView?.('file'); if (location.hash !== '#file') history.replaceState(null, '', '#file'); say(msg, true); renderQueueIdle() } });
  // la partie commence : on n'est plus « en attente » dans la file
  addEventListener('ffl:rankedStart', () => { matched = false; renderQueueIdle() });
  /** « Rejouer en classé » depuis l'écran de fin */
  (window as any).__requeue = () => { location.hash = 'file'; setTimeout(startSearch, 50) };

  // ================= navigation =================
  addEventListener('ffl:view', (e: any) => {
    view = e.detail;
    if (view === 'classement') { A.refreshMe(); renderBoard() }
    if (view === 'file') { A.refreshMe(); renderQueueIdle() }
    else if (searching) stopSearch();
  });
  addEventListener('ffl:account', () => {
    if (view === 'file') { if (!A.currentUser() && searching) stopSearch(); renderQueueIdle() }
    if (view === 'classement') renderBoard();
  });
}

/** petit carillon quand une partie est trouvée (WebAudio, aucun fichier) */
function playChime() {
  try {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)(), t = ac.currentTime;
    for (const [i, f] of [523.25, 659.25, 783.99].entries()) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * .12); g.gain.linearRampToValueAtTime(.12, t + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.001, t + i * .12 + .6);
      o.connect(g).connect(ac.destination); o.start(t + i * .12); o.stop(t + i * .12 + .65);
    }
    setTimeout(() => ac.close(), 1500);
  } catch (e) {}
}

// ================= fin de partie classée : l'Elo qui bouge =================
export type EloResult = { mode: string, before: number, after: number, delta: number, games: number, wins: number, placed: boolean, rank: string, tier: number,
  rankBefore: string, tierBefore: number, placedBefore: boolean, won: boolean, halved: boolean };
let anim = 0;
export function showEloResult(e: EloResult) {
  const u = A.currentUser(), ov = $('eloOv'), id = ++anim;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('eloKind').textContent = `Partie classée ${e.mode}`;
  $('eloTitle').textContent = e.won ? 'Victoire' : 'Défaite';
  ov.classList.toggle('won', e.won); ov.classList.toggle('lost', !e.won);
  $('eloDelta').textContent = ''; $('eloDelta').className = 'elo-delta';
  $('eloMsg').textContent = '';
  const tierOf = (v: number) => ELO.tier(v);
  // pendant le placement, on montre le rang provisoire (insigne estompé) : c'est celui qu'on aura si l'Elo ne bouge plus
  const setRank = (v: number, placed: boolean) => {
    $('eloBadge').innerHTML = badgeSvg(v, true, placed ? '' : 'prov');
    $('eloRank').textContent = placed ? ELO.rank(v) : `${ELO.rank(v)} · provisoire`;
    const t = tierOf(v); $('eloLo').textContent = t === 0 ? '' : '← ' + ELO.rank(Math.max(0, ELO.tierLo(t) - 1)); $('eloHi').textContent = t >= 17 ? '' : ELO.rank(ELO.tierHi(t)) + ' →';
  };
  const setBar = (v: number) => { const t = tierOf(v), lo = ELO.tierLo(t), hi = ELO.tierHi(t); $('eloBar').style.width = Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)) + '%' };
  $('eloNum').textContent = String(e.before); setRank(e.before, e.placedBefore); setBar(e.before);
  if (u) $('eloBadge').insertAdjacentHTML('afterbegin', `<span class="elo-bl">${blasonSvg(u.blason)}</span>`);
  ov.hidden = false; $('eloOk').focus();

  const finalMsg = () => {
    const msgs: string[] = [];
    if (e.placed && !e.placedBefore) msgs.push(`Placement terminé : te voilà ${e.rank} !`);
    else if (e.placed && e.tier > e.tierBefore) msgs.push(`Promotion : ${e.rank} !`);
    else if (e.placed && e.tier < e.tierBefore) msgs.push(`Rétrogradation en ${e.rank}.`);
    else if (!e.placed) msgs.push(`Placement ${e.games} / ${ELO.PLACEMENT} : encore ${ELO.PLACEMENT - e.games} partie${ELO.PLACEMENT - e.games > 1 ? 's' : ''} avant d'être classé.`);
    else msgs.push(`Tu restes ${e.rank}.`);
    if (e.halved) msgs.push('Gains et pertes divisés par deux : vous vous êtes déjà affrontés trois fois aujourd\'hui.');
    return msgs.join(' ');
  };
  const done = () => {
    if (id !== anim) return;
    $('eloNum').textContent = String(e.after); setRank(e.after, e.placed); setBar(e.after);
    if (u) $('eloBadge').insertAdjacentHTML('afterbegin', `<span class="elo-bl">${blasonSvg(u.blason)}</span>`);
    const up = e.tier > e.tierBefore || (e.placed && !e.placedBefore), down = e.tier < e.tierBefore;
    $('eloBadge').classList.toggle('promo', up); $('eloBadge').classList.toggle('demo', down);
    $('eloMsg').textContent = finalMsg();
  };
  $('eloBadge').classList.remove('promo', 'demo');
  // le gain (ou la perte) apparaît, puis le compteur défile jusqu'au nouvel Elo
  const showDelta = () => { $('eloDelta').textContent = (e.delta >= 0 ? '+' : '−') + Math.abs(e.delta); $('eloDelta').className = 'elo-delta pop ' + (e.delta >= 0 ? 'up' : 'down') };
  if (reduce) { showDelta(); done(); return }
  setTimeout(() => {
    if (id !== anim) return;
    showDelta();
    const t0 = performance.now(), D = 1400;
    let shownTier = tierOf(e.before), shownPlaced = e.placedBefore;
    const step = (now: number) => {
      if (id !== anim) return;
      const k = Math.min(1, (now - t0) / D), ease = 1 - Math.pow(1 - k, 3), v = Math.round(e.before + (e.after - e.before) * ease);
      $('eloNum').textContent = String(v); setBar(v);
      // on franchit un palier : l'insigne change en cours de route
      if (tierOf(v) !== shownTier) { shownTier = tierOf(v); setRank(v, shownPlaced); if (u) $('eloBadge').insertAdjacentHTML('afterbegin', `<span class="elo-bl">${blasonSvg(u.blason)}</span>`) }
      if (k < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  }, 700);
}
export function hideEloResult() { anim++; $('eloOv').hidden = true }
