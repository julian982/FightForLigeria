// Les comptes joueurs (facultatifs) : inscription avec confirmation de l'adresse email, connexion par jeton de session,
// mot de passe oublié, suppression du compte. Chaque fonction renvoie { status, body } : api.ts en fait des réponses HTTP.
//
// Sécurité :
// - mots de passe hachés avec scrypt (sel aléatoire, comparaison à temps constant) ;
// - jetons (session, liens d'email) aléatoires de 256 bits ; seule leur empreinte SHA-256 est stockée ;
// - limites de tentatives par adresse IP et par compte ;
// - « mot de passe oublié » et « renvoyer l'email » répondent toujours pareil, pour ne pas révéler quels emails ont un compte.
import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { q, dbReady } from './db';
import { sendMail, layout } from './mail';
import { cleanPseudo } from './clean';

export const TERMS_VERSION = '2026-10';
const SESSION_DAYS = 30, VERIFY_HOURS = 48, RESET_MINUTES = 60, UNVERIFIED_DAYS = 7;
/** adresse publique du serveur (liens des emails) et de la page du jeu (où l'on revient après avoir cliqué) */
const API_URL = (process.env.API_PUBLIC_URL || 'http://localhost:2567').replace(/\/$/, '');
const GAME_URL = (process.env.GAME_URL || 'http://localhost:5173/').replace(/#.*$/, '');

type Res = { status: number, body?: any, redirect?: string };
const ok = (body: any = { ok: true }, status = 200): Res => ({ status, body });
const err = (status: number, error: string, code?: string): Res => ({ status, body: { error, code } });
const unavailable = () => err(503, 'Les comptes sont momentanément indisponibles. Tu peux continuer à jouer en invité.', 'unavailable');

// ---------------- outils ----------------
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scryptAsync = (pw: string, salt: Buffer, len: number) => new Promise<Buffer>((res, rej) => scrypt(pw, salt, len, SCRYPT, (e, k) => e ? rej(e) : res(k)));
export async function hashPassword(pw: string) {
  const salt = randomBytes(16), key = await scryptAsync(pw, salt, 32);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function checkPassword(pw: string, stored: string) {
  const [alg, N, r, p, salt, key] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(key, 'base64');
  const got = await new Promise<Buffer>((res, rej) => scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p, maxmem: SCRYPT.maxmem }, (e, k) => e ? rej(e) : res(k)));
  return got.length === want.length && timingSafeEqual(got, want);
}
/** empreinte factice : on calcule toujours un scrypt, même pour un compte inconnu (même durée de réponse) */
let DUMMY = '';
hashPassword('x').then(h => DUMMY = h);

export const cleanEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
export const emailOk = (e: string) => e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e);
const pwError = (pw: unknown) => typeof pw !== 'string' ? 'Mot de passe manquant.' : pw.length < 8 ? 'Le mot de passe doit faire au moins 8 caractères.' : pw.length > 128 ? 'Le mot de passe est trop long (128 caractères au plus).' : null;

// limites de tentatives, en mémoire (fenêtre glissante)
const hits = new Map<string, number[]>();
/** true si la limite est dépassée pour cette clé */
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs);
  list.push(now); hits.set(key, list);
  return list.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (!l.some(t => now - t < 3600_000)) hits.delete(k) }, 600_000).unref();
/** ménage régulier : comptes jamais confirmés (au bout de UNVERIFIED_DAYS jours), sessions et liens expirés */
export async function housekeeping() {
  if (!dbReady()) return;
  try {
    await q(`DELETE FROM users WHERE verified_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`, [UNVERIFIED_DAYS]);
    await q(`DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()`);
    await q(`DELETE FROM email_tokens WHERE expires_at < UTC_TIMESTAMP()`);
  } catch (e: any) { console.error('comptes : ménage raté :', e.code || e.message) }
}
setInterval(housekeeping, 3600_000).unref();
const tooMany = () => err(429, 'Trop de tentatives. Réessaie dans quelques minutes.', 'rate');

async function emailToken(userId: number, kind: 'verify' | 'reset', minutes: number) {
  const t = newToken();
  await q(`DELETE FROM email_tokens WHERE user_id = ? AND kind = ?`, [userId, kind]);
  await q(`INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`, [sha(t), userId, kind, minutes]);
  return t;
}
async function sendVerify(user: { id: number, pseudo: string, email: string }) {
  const t = await emailToken(user.id, 'verify', VERIFY_HOURS * 60);
  const m = layout(`Bienvenue, ${user.pseudo} !`, [
    'Il reste une étape pour activer ton compte FightForLigeria : confirmer ton adresse email.',
    `Le lien est valable ${VERIFY_HOURS} heures.`,
  ], { label: 'Confirmer mon adresse', url: `${API_URL}/api/verify?t=${t}` });
  await sendMail({ to: user.email, subject: 'Confirme ton adresse email · FightForLigeria', ...m });
}
const publicUser = (u: any) => ({ id: u.id, pseudo: u.pseudo, email: u.email, createdAt: u.created_at });

// ---------------- les actions ----------------
/** inscription : le compte n'est utilisable qu'une fois l'email confirmé */
export async function register(b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  const pseudo = cleanPseudo(b?.pseudo), email = cleanEmail(b?.email);
  if (!pseudo) return err(400, 'Pseudo invalide : 3 à 16 caractères (lettres, chiffres, espaces, tirets).', 'pseudo');
  if (pseudo !== String(b?.pseudo ?? '').trim()) return err(400, 'Le pseudo contient des caractères non autorisés.', 'pseudo');
  if (!emailOk(email)) return err(400, 'Adresse email invalide.', 'email');
  const pe = pwError(b?.password); if (pe) return err(400, pe, 'password');
  if (b?.terms !== true) return err(400, 'Tu dois accepter les conditions d\'utilisation et la politique de confidentialité.', 'terms');
  // on ne compte que les demandes valides : une faute de frappe ne bloque personne
  if (limited('reg:' + ip, 10, 3600_000)) return tooMany();
  // les comptes jamais confirmés libèrent leur pseudo et leur email au bout de quelques jours
  await q(`DELETE FROM users WHERE verified_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`, [UNVERIFIED_DAYS]);
  // la base compare les pseudos sans tenir compte des majuscules ni des accents (« Julien » = « julién »)
  const same = await q(`SELECT id, pseudo, email, verified_at FROM users WHERE pseudo = ? OR email = ?`, [pseudo, email]);
  const byEmail = same.find((u: any) => u.email === email), byPseudo = same.find((u: any) => u !== byEmail);
  if (byEmail && byEmail.verified_at) {
    // email déjà utilisé par un compte actif : on ne le dit pas ici (pour ne pas révéler qui a un compte), on prévient le propriétaire par email
    const m = layout('Tu as déjà un compte', [
      `Quelqu'un (peut-être toi) a voulu créer un compte FightForLigeria avec cette adresse, mais elle est déjà utilisée par le compte « ${byEmail.pseudo} ».`,
      'Si tu as oublié ton mot de passe, utilise « Mot de passe oublié » sur la page de connexion.',
    ], { label: 'Aller au jeu', url: `${GAME_URL}#compte` });
    await sendMail({ to: email, subject: 'Tu as déjà un compte · FightForLigeria', ...m });
    return ok({ ok: true, pending: true }, 201);
  }
  if (byPseudo) return err(409, 'Ce pseudo est déjà pris.', 'pseudo');
  // une inscription précédente jamais confirmée avec cet email est remplacée par la nouvelle
  if (byEmail) await q(`DELETE FROM users WHERE id = ? AND verified_at IS NULL`, [byEmail.id]);
  const hash = await hashPassword(b.password);
  let id: number;
  try { id = (await q(`INSERT INTO users (pseudo, email, pass_hash, terms_version) VALUES (?, ?, ?, ?)`, [pseudo, email, hash, TERMS_VERSION])).insertId }
  catch (e: any) { if (e.code === 'ER_DUP_ENTRY') return err(409, 'Ce pseudo est déjà pris.', 'pseudo'); throw e }
  await sendVerify({ id, pseudo, email });
  return ok({ ok: true, pending: true }, 201);
}

/** lien cliqué dans l'email : confirme l'adresse puis renvoie vers la page du jeu */
export async function verify(token: string): Promise<Res> {
  if (!dbReady()) return { status: 302, redirect: `${GAME_URL}#compte?erreur=indisponible` };
  const rows = await q(`SELECT user_id FROM email_tokens WHERE token_hash = ? AND kind = 'verify' AND expires_at > UTC_TIMESTAMP()`, [sha(String(token || ''))]);
  if (!rows.length) return { status: 302, redirect: `${GAME_URL}#compte?erreur=lien` };
  await q(`UPDATE users SET verified_at = COALESCE(verified_at, UTC_TIMESTAMP()) WHERE id = ?`, [rows[0].user_id]);
  await q(`DELETE FROM email_tokens WHERE user_id = ? AND kind = 'verify'`, [rows[0].user_id]);
  return { status: 302, redirect: `${GAME_URL}#compte?ok=verifie` };
}

/** renvoyer l'email de confirmation (même réponse que le compte existe ou non) */
export async function resend(b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  const email = cleanEmail(b?.email);
  if (limited('resend:' + ip, 5, 3600_000) || limited('resend:' + email, 3, 3600_000)) return tooMany();
  const u = (await q(`SELECT id, pseudo, email FROM users WHERE email = ? AND verified_at IS NULL`, [email]))[0];
  if (u) await sendVerify(u);
  return ok();
}

/** connexion avec le pseudo ou l'email. Renvoie un jeton de session. */
export async function login(b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  const id = String(b?.login ?? '').trim(), pw = String(b?.password ?? '');
  if (limited('login:' + ip, 20, 600_000) || limited('login:' + id.toLowerCase(), 10, 900_000)) return tooMany();
  const u = (await q(`SELECT * FROM users WHERE email = ? OR pseudo = ? LIMIT 1`, [cleanEmail(id), id]))[0];
  const good = await checkPassword(pw, u ? u.pass_hash : DUMMY);
  if (!u || !good) return err(401, 'Pseudo, email ou mot de passe incorrect.', 'credentials');
  if (!u.verified_at) return err(403, 'Confirme d\'abord ton adresse email : clique sur le lien reçu par email.', 'unverified');
  const t = newToken();
  await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`, [sha(t), u.id, SESSION_DAYS]);
  await q(`UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?`, [u.id]);
  return ok({ token: t, user: publicUser(u) });
}

/** le compte derrière un jeton de session (null si invalide ou expiré). Prolonge la session. */
export async function sessionUser(token: string | null | undefined) {
  if (!token || !dbReady()) return null;
  const h = sha(String(token));
  const u = (await q(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.verified_at IS NOT NULL`, [h]))[0];
  if (!u) return null;
  await q(`UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(), expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY) WHERE token_hash = ?`, [SESSION_DAYS, h]);
  return u;
}
export const bearer = (auth: string | null | undefined) => { const m = /^Bearer\s+(\S+)$/i.exec(String(auth || '')); return m ? m[1] : null };

export async function me(token: string | null): Promise<Res> {
  if (!dbReady()) return unavailable();
  const u = await sessionUser(token);
  return u ? ok({ user: publicUser(u) }) : err(401, 'Session expirée : reconnecte-toi.', 'session');
}
export async function logout(token: string | null): Promise<Res> {
  if (!dbReady()) return unavailable();
  if (token) await q(`DELETE FROM sessions WHERE token_hash = ?`, [sha(token)]);
  return ok();
}

/** mot de passe oublié : envoie un lien (même réponse que le compte existe ou non) */
export async function forgot(b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  const email = cleanEmail(b?.email);
  if (limited('forgot:' + ip, 5, 3600_000) || limited('forgot:' + email, 3, 3600_000)) return tooMany();
  const u = (await q(`SELECT id, pseudo, email, verified_at FROM users WHERE email = ?`, [email]))[0];
  if (u) {
    const t = await emailToken(u.id, 'reset', RESET_MINUTES);
    const m = layout('Nouveau mot de passe', [
      `Bonjour ${u.pseudo}, tu as demandé à changer le mot de passe de ton compte FightForLigeria.`,
      `Le lien est valable ${RESET_MINUTES} minutes et ne sert qu'une fois. Si tu n'as rien demandé, ignore cet email : ton mot de passe ne change pas.`,
    ], { label: 'Choisir un nouveau mot de passe', url: `${GAME_URL}#reinit?t=${t}` });
    await sendMail({ to: u.email, subject: 'Nouveau mot de passe · FightForLigeria', ...m });
  }
  return ok();
}
/** nouveau mot de passe depuis le lien reçu : déconnecte toutes les sessions et confirme l'email au passage */
export async function reset(b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  if (limited('reset:' + ip, 10, 3600_000)) return tooMany();
  const pe = pwError(b?.password); if (pe) return err(400, pe, 'password');
  const h = sha(String(b?.token || ''));
  const row = (await q(`SELECT user_id FROM email_tokens WHERE token_hash = ? AND kind = 'reset' AND expires_at > UTC_TIMESTAMP()`, [h]))[0];
  if (!row) return err(400, 'Ce lien n\'est plus valable. Redemande un nouveau mot de passe.', 'token');
  await q(`UPDATE users SET pass_hash = ?, verified_at = COALESCE(verified_at, UTC_TIMESTAMP()) WHERE id = ?`, [await hashPassword(b.password), row.user_id]);
  await q(`DELETE FROM email_tokens WHERE user_id = ?`, [row.user_id]);
  await q(`DELETE FROM sessions WHERE user_id = ?`, [row.user_id]);
  return ok();
}
/** suppression définitive du compte (mot de passe demandé) */
export async function deleteAccount(token: string | null, b: any, ip: string): Promise<Res> {
  if (!dbReady()) return unavailable();
  const u = await sessionUser(token); if (!u) return err(401, 'Session expirée : reconnecte-toi.', 'session');
  if (limited('delete:' + u.id, 5, 900_000)) return tooMany();
  if (!(await checkPassword(String(b?.password ?? ''), u.pass_hash))) return err(401, 'Mot de passe incorrect.', 'credentials');
  await q(`DELETE FROM users WHERE id = ?`, [u.id]);
  return ok();
}

/** un invité ne peut pas prendre le pseudo d'un compte (même à une majuscule ou un accent près) */
export async function pseudoTaken(pseudo: string) {
  if (!dbReady()) return false;
  return (await q(`SELECT 1 FROM users WHERE pseudo = ? AND verified_at IS NOT NULL LIMIT 1`, [pseudo])).length > 0;
}
