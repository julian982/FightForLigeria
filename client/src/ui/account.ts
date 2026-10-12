// Les pages du compte : connexion, inscription (confirmation par email obligatoire), mot de passe oublié,
// profil et suppression. Le compte est facultatif : sans lui, on joue en invité avec un simple pseudo.
import * as A from '../net/account';

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

export function initAccount() {
  function panel(p: Panel) {
    const u = A.currentUser();
    if (u) p = 'profile'; else if (p === 'profile') p = 'forms';
    $('acForms').hidden = p !== 'forms'; $('acWhy').hidden = p === 'profile';
    $('acPending').hidden = p !== 'pending'; $('forgotForm').hidden = p !== 'forgot'; $('acProfile').hidden = p !== 'profile';
    if (u) {
      $('pfPseudo').textContent = u.pseudo; $('pfEmail').textContent = u.email;
      $('pfSince').textContent = new Date(u.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  }
  function pending(email: string) { $('pdEmail').textContent = email; say('pdMsg', ''); panel('pending') }

  // ---- en haut de page : compte connecté, ou lien de connexion ----
  function renderTop() {
    const u = A.currentUser();
    $('acctChip').hidden = !u; $('loginLink').hidden = !!u;
    if (u) $('acctName').textContent = u.pseudo;
    if ((window as any).__homeView === 'compte') panel(u ? 'profile' : 'forms');
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
      const r = await A.register(pseudo, email, pw, true);
      if (!r.ok) { say('rgMsg', r.data.error || 'Inscription impossible.', true); return }
      $('rgPw').value = $('rgPw2').value = '';
      $('liId').value = pseudo;
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
