// Les pages du compte : connexion, inscription (avec le blason ; connecté tout de suite tant que la confirmation par
// email n'est pas en place), mot de passe oublié, profil (blason, rangs, historique des parties) et suppression.
// Le compte est facultatif : sans lui, on joue en invité avec un simple pseudo.
import { MAPS } from '@ffl/shared';
import * as A from '../net/account';
import { blasonSvg, blasonEditor } from './blason';
import { badgeSvg } from './rankbadge';

const $ = (id: string): any => document.getElementById(id);
const go = (v: string) => { if (location.hash.slice(1) !== v) location.hash = v; else (window as any).__showView?.(v) };
/** paramètres dans l'adresse après la vue : #compte?ok=verifie, #reinit?t=… */
const hashParams = () => new URLSearchParams(location.hash.split('?')[1] || '');
const say = (id: string, text: string, warn = false) => { const el = $(id); el.textContent = text; el.classList.toggle('warn', warn); el.classList.toggle('good', !warn && !!text) };
/** bloque le bouton d'envoi d'un formulaire pendant la requête */
async function busy<T>(form: HTMLElement, f: () => Promise<T>): Promise<T> {
  const b = form.querySelector('button[type=submit]') as HTMLButtonElement | null;
  if (b) b.disabled = true;
  try { return await f() } finally { if (b) b.disabled = false }
}

type Panel = 'forms' | 'pending' | 'forgot' | 'profile';
let resetToken = '';
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
const KIND: Record<string, string> = { ranked: 'Classée', online: 'En ligne', solo: 'Contre l\'IA' };
const mmss = (s: number) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
function ago(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000, rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 7) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
/** carte d'un rang (1v1 ou 2v2) : insigne, rang, Elo, victoires et défaites, placement */
export function rankCard(label: string, l: A.Ladder) {
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < l.games ? 'on' : ''}"></i>`).join('');
  return `<div class="pf-rank">${badgeSvg(l.elo, l.placed, 'pf-badge')}<div class="pf-rk"><span class="lbl">${label}</span><b>${l.placed ? l.rank : 'Non classé'}</b>
    <span class="small">${l.elo} Elo${l.placed ? '' : ` · provisoire : ${l.rank}`} · ${l.wins} V – ${l.games - l.wins} D</span>
    ${l.placed ? '' : `<span class="pf-place" aria-label="Parties de placement : ${l.games} sur 5">${dots}<em>${l.games} / 5 placement</em></span>`}</div></div>`;
}
function histItem(m: any) {
  const res = m.left ? 'Abandon' : m.won ? 'Victoire' : 'Défaite';
  const who = (l: any[]) => l.map(p => `<span class="hi-who">${p.blason ? blasonSvg(p.blason) : p.ai ? '<span class="hi-ai">IA</span>' : ''}${esc(p.ai ? 'IA' : p.pseudo)}</span>`).join('');
  const d = m.eloAfter != null && m.eloBefore != null ? m.eloAfter - m.eloBefore : null;
  return `<article class="hi ${m.won ? 'win' : 'loss'}">
    <div class="hi-res">${res}</div>
    <div class="hi-main"><b>${KIND[m.kind] || ''} ${m.mode} · ${esc(MAPS[m.map]?.name || m.map)}</b>
      <span class="hi-vs">contre ${who(m.foes)}${m.allies.length ? ` · avec ${who(m.allies)}` : ''}</span></div>
    <div class="hi-elo">${d == null ? '' : `<b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${Math.abs(d)}</b><small>${m.eloAfter} Elo</small>`}</div>
    <div class="hi-meta">${mmss(m.duration)}<br>${ago(m.at)}</div></article>`;
}

export function initAccount() {
  function panel(p: Panel) {
    const u = A.currentUser();
    if (u) p = 'profile'; else if (p === 'profile') p = 'forms';
    $('acForms').hidden = p !== 'forms'; $('acWhy').hidden = p === 'profile';
    $('acPending').hidden = p !== 'pending'; $('forgotForm').hidden = p !== 'forgot'; $('acProfile').hidden = p !== 'profile';
    if (u) renderProfile(u);
  }
  // ---- profil : blason, rangs, historique ----
  let hist: any[] | null = null, histKind = 'all', histFor = 0;
  function renderProfile(u: A.User) {
    $('pfPseudo').textContent = u.pseudo; $('pfEmail').textContent = u.email;
    $('pfSince').textContent = new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    $('pfBlason').innerHTML = blasonSvg(u.blason, { title: 'Blason de ' + u.pseudo });
    $('pfAdmin').hidden = !u.admin;
  }
  /** la page « Mes parties » : rangs 1v1 et 2v2, historique des parties */
  function renderParties() {
    const u = A.currentUser();
    $('mpLogin').hidden = !!u; $('mpBody').hidden = !u;
    if (!u) return;
    $('pfRanks').innerHTML = rankCard('Classé 1v1', u.r1) + rankCard('Classé 2v2', u.r2);
    if (histFor !== u.id) { histFor = u.id; hist = null; loadHistory() } else renderHistory();
  }
  async function loadHistory() {
    $('pfHist').innerHTML = '<p class="help">Chargement de tes parties…</p>';
    const r = await A.history();
    hist = r.ok ? r.data.matches : null;
    if (!r.ok) { $('pfHist').innerHTML = `<p class="net-msg warn">${esc(r.data.error || 'Historique indisponible.')}</p>`; return }
    renderHistory();
  }
  function renderHistory() {
    if (!hist) return;
    const l = hist.filter(m => histKind === 'all' || m.kind === histKind);
    $('pfHist').innerHTML = l.length ? l.map(histItem).join('') : `<p class="help">${hist.length ? 'Aucune partie de ce type pour l\'instant.' : 'Pas encore de partie. Celles que tu joues connecté (contre l\'IA, en ligne ou en classé) s\'afficheront ici.'}</p>`;
  }
  $('histFilter').addEventListener('click', (e: Event) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    histKind = b.dataset.k!; for (const o of $('histFilter').children) o.setAttribute('aria-pressed', String(o === b)); renderHistory();
  });
  // ---- modifier son blason ----
  let editor: ReturnType<typeof blasonEditor> | null = null;
  $('pfEditBl').addEventListener('click', () => {
    const u = A.currentUser(); if (!u) return;
    if (!editor) editor = blasonEditor($('pfEditor'), u.blason); else editor.set(u.blason);
    say('blMsg', ''); $('pfBlEdit').hidden = false; $('pfBlEdit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('pfBlCancel').addEventListener('click', () => { $('pfBlEdit').hidden = true });
  $('pfBlSave').addEventListener('click', async () => {
    if (!editor) return;
    $('pfBlSave').disabled = true;
    const r = await A.saveBlason(editor.get());
    $('pfBlSave').disabled = false;
    if (r.ok) { $('pfBlEdit').hidden = true; say('acMsg', 'Blason enregistré.') } else say('blMsg', r.data.error || 'Enregistrement impossible.', true);
  });
  function pending(email: string) { $('pdEmail').textContent = email; say('pdMsg', ''); panel('pending') }

  // ---- en haut de page : compte connecté, ou lien de connexion ----
  function renderTop() {
    const u = A.currentUser();
    $('acctChip').hidden = !u; $('loginLink').hidden = !!u; $('navParties').hidden = !u;
    if (u) { $('acctName').textContent = u.pseudo; $('acctBl').innerHTML = blasonSvg(u.blason) }
    if ((window as any).__homeView === 'compte') panel(u ? 'profile' : 'forms');
    if ((window as any).__homeView === 'parties') renderParties();
  }
  addEventListener('ffl:account', renderTop);

  // ---- connexion ----
  $('loginForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const id = $('liId').value.trim(), pw = $('liPw').value;
    if (!id || !pw) { say('liMsg', 'Entre ton pseudo (ou ton email) et ton mot de passe.', true); return }
    busy($('loginForm'), async () => {
      say('liMsg', '');
      const r = await A.login(id, pw);
      if (r.ok) { $('liPw').value = ''; say('acMsg', `Bienvenue, ${r.data.user.pseudo} !`); return }
      if (r.data.code === 'unverified' && id.includes('@')) { pending(id); say('pdMsg', r.data.error, true); return }
      say('liMsg', (r.data.error || 'Connexion impossible.') + (r.data.code === 'unverified' ? ' Pour recevoir un nouveau lien, connecte-toi avec ton email.' : ''), true);
    });
  });
  $('toForgot').addEventListener('click', () => { const id = $('liId').value.trim(); if (id.includes('@')) $('fgEmail').value = id; say('fgMsg', ''); panel('forgot'); $('fgEmail').focus() });

  // ---- inscription ----
  const regBlason = blasonEditor($('rgBlason'));
  $('regForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const pseudo = $('rgPseudo').value.trim(), email = $('rgEmail').value.trim(), pw = $('rgPw').value;
    if (pseudo.length < 3) { say('rgMsg', 'Le pseudo doit faire au moins 3 caractères.', true); $('rgPseudo').focus(); return }
    if (!$('rgEmail').checkValidity() || !email) { say('rgMsg', 'Adresse email invalide.', true); $('rgEmail').focus(); return }
    if (pw.length < 8) { say('rgMsg', 'Le mot de passe doit faire au moins 8 caractères.', true); $('rgPw').focus(); return }
    if (pw !== $('rgPw2').value) { say('rgMsg', 'Les deux mots de passe ne sont pas identiques.', true); $('rgPw2').focus(); return }
    if (!$('rgTerms').checked) { say('rgMsg', 'Tu dois accepter les conditions d\'utilisation et la politique de confidentialité.', true); return }
    busy($('regForm'), async () => {
      say('rgMsg', '');
      const r = await A.register(pseudo, email, pw, true, regBlason.get());
      if (!r.ok) { say('rgMsg', r.data.error || 'Inscription impossible.', true); return }
      $('rgPw').value = $('rgPw2').value = '';
      $('liId').value = pseudo;
      if (r.data.token) { say('acMsg', `Bienvenue, ${r.data.user.pseudo} ! Ton compte est prêt : tu peux jouer en classé.`); panel('profile'); return }
      pending(email);
    });
  });
  $('pdResend').addEventListener('click', async () => {
    $('pdResend').disabled = true;
    const r = await A.resend($('pdEmail').textContent);
    say('pdMsg', r.ok ? 'Email renvoyé. Seul le dernier lien reçu fonctionne.' : (r.data.error || 'Envoi impossible.'), !r.ok);
    setTimeout(() => $('pdResend').disabled = false, 30000);
  });
  $('pdBack').addEventListener('click', () => { say('acMsg', ''); panel('forms'); $('liPw').focus() });

  // ---- mot de passe oublié ----
  $('forgotForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    if (!$('fgEmail').value.trim() || !$('fgEmail').checkValidity()) { say('fgMsg', 'Adresse email invalide.', true); return }
    busy($('forgotForm'), async () => {
      const r = await A.forgot($('fgEmail').value.trim());
      say('fgMsg', r.ok ? 'Si un compte existe avec cet email, un lien vient d\'y être envoyé. Il est valable une heure.' : (r.data.error || 'Envoi impossible.'), !r.ok);
    });
  });
  $('fgBack').addEventListener('click', () => panel('forms'));

  // ---- profil ----
  $('pfLogout').addEventListener('click', async () => { await A.logout(); say('acMsg', 'Tu es déconnecté. Tu peux continuer à jouer en invité.') });
  $('delForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    if (!$('delPw').value) { say('delMsg', 'Entre ton mot de passe pour confirmer.', true); return }
    if (!confirm('Supprimer définitivement ton compte ? Cette action est irréversible.')) return;
    busy($('delForm'), async () => {
      const r = await A.deleteAccount($('delPw').value);
      $('delPw').value = '';
      if (r.ok) { say('delMsg', ''); say('acMsg', 'Ton compte a été supprimé.') }
      else say('delMsg', r.data.error || 'Suppression impossible.', true);
    });
  });

  // ---- nouveau mot de passe (lien reçu par email) ----
  $('resetForm').addEventListener('submit', (e: Event) => {
    e.preventDefault();
    const pw = $('riPw').value;
    if (pw.length < 8) { say('riMsg', 'Le mot de passe doit faire au moins 8 caractères.', true); return }
    if (pw !== $('riPw2').value) { say('riMsg', 'Les deux mots de passe ne sont pas identiques.', true); return }
    busy($('resetForm'), async () => {
      const r = await A.resetPassword(resetToken, pw);
      if (!r.ok) { say('riMsg', r.data.error || 'Changement impossible.', true); return }
      $('riPw').value = $('riPw2').value = '';
      go('compte'); say('acMsg', 'Mot de passe changé. Connecte-toi avec le nouveau.');
    });
  });

  // ---- arrivée sur une page ----
  function onView(v: string) {
    if (v === 'parties') { histFor = 0; A.refreshMe(); renderParties() } // relu à chaque visite : une partie vient peut-être de finir
    if (v === 'compte') {
      const p = hashParams();
      say('acMsg', '');
      if (p.get('ok') === 'verifie') say('acMsg', 'Ton adresse email est confirmée : tu peux te connecter.');
      else if (p.get('erreur') === 'lien') say('acMsg', 'Ce lien de confirmation n\'est plus valable (déjà utilisé, expiré ou remplacé par un plus récent). Connecte-toi : si ton compte n\'est pas confirmé, tu pourras recevoir un nouveau lien.', true);
      else if (p.get('erreur') === 'indisponible') say('acMsg', 'Les comptes sont momentanément indisponibles. Réessaie dans quelques minutes.', true);
      // l'adresse garde le message mais plus le paramètre (pour qu'un rechargement ne le réaffiche pas)
      if (p.toString()) history.replaceState(null, '', '#compte');
      panel(A.currentUser() ? 'profile' : 'forms');
    }
    if (v === 'reinit') {
      const t = hashParams().get('t');
      if (t) { resetToken = t; history.replaceState(null, '', '#reinit') } // le jeton ne reste pas dans l'historique
      say('riMsg', resetToken ? '' : 'Lien incomplet : redemande un nouveau mot de passe depuis « Mon compte ».', !resetToken);
    }
  }
  addEventListener('ffl:view', (e: any) => onView(e.detail));
  renderTop();
  onView((window as any).__homeView);
  A.restoreSession();
}
