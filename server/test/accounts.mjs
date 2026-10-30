// Test de bout en bout des comptes avec confirmation de l'email (EMAIL_VERIFY=1), contre une vraie base MariaDB (variables DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
// Sans base configurée, le test est ignoré. Les emails sont lus dans les journaux du serveur (pas de SMTP en test).
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
import * as mariadb from 'mariadb';

if (!process.env.DB_HOST) { console.log('comptes : pas de base de données (DB_HOST), test ignoré'); process.exit(0) }
const PORT = 2900 + (Math.random() * 300 | 0), BASE = `http://localhost:${PORT}`;
// base vide à chaque test
const admin = await mariadb.createConnection({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
for (const t of ['season_results', 'meta', 'match_players', 'matches', 'email_tokens', 'sessions', 'users', 'schema_version']) await admin.query(`DROP TABLE IF EXISTS ${t}`);
const mails = [];
const srv = spawn(process.execPath, ['dist/index.mjs'], { env: { ...process.env, PORT: String(PORT), API_PUBLIC_URL: BASE, GAME_URL: 'https://jeu.example/', SMTP_HOST: '', EMAIL_VERIFY: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
await new Promise((ok, ko) => {
  srv.stdout.on('data', d => { out += d; for (const l of String(d).split('\n')) if (l.startsWith('MAIL ')) mails.push(JSON.parse(l.slice(5))); if (out.includes('base de données prête')) ok() });
  setTimeout(() => ko(new Error('le serveur ou la base ne démarre pas :\n' + out.slice(-500))), 20000);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('ÉCHEC :', m); srv.kill(); process.exit(1) };
const ok = (c, m) => { if (!c) fail(m) };
async function api(path, body, token, method = body ? 'POST' : 'GET') {
  const r = await fetch(BASE + path, { method, redirect: 'manual', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json() } catch (e) {}
  return { status: r.status, body: j, location: r.headers.get('location') };
}
const lastMail = to => mails.filter(m => m.to === to).at(-1);
const linkIn = (m, re) => (m && m.text.match(re) || [])[0];

try {
  const good = { pseudo: 'Julian', email: 'Julian@Example.com', password: 'motdepasse1', terms: true };
  // ---- validations ----
  ok((await api('/api/register', { ...good, pseudo: 'J' })).status === 400, 'pseudo trop court accepté');
  ok((await api('/api/register', { ...good, pseudo: '<b>Hack</b>' })).status === 400, 'pseudo avec du HTML accepté');
  ok((await api('/api/register', { ...good, email: 'pas-un-email' })).status === 400, 'email invalide accepté');
  ok((await api('/api/register', { ...good, password: 'court' })).status === 400, 'mot de passe trop court accepté');
  ok((await api('/api/register', { ...good, terms: false })).status === 400, 'inscription sans accepter les conditions');
  // ---- inscription, puis confirmation obligatoire ----
  let r = await api('/api/register', good);
  ok(r.status === 201 && r.body.pending, 'inscription refusée : ' + JSON.stringify(r.body));
  const verifyLink = linkIn(lastMail('julian@example.com'), /http:\/\/localhost:\d+\/api\/verify\?t=[\w-]+/);
  ok(verifyLink, 'email de confirmation manquant');
  r = await api('/api/login', { login: 'Julian', password: 'motdepasse1' });
  ok(r.status === 403 && r.body.code === 'unverified', 'connexion possible sans email confirmé');
  ok((await api('/api/resend', { email: 'julian@example.com' })).status === 200 && mails.filter(m => m.to === 'julian@example.com').length === 2, 'renvoi de l\'email raté');
  const verifyLink2 = linkIn(lastMail('julian@example.com'), /http:\/\/localhost:\d+\/api\/verify\?t=[\w-]+/);
  ok((await fetch(verifyLink, { redirect: 'manual' })).headers.get('location').includes('erreur=lien'), 'l\'ancien lien doit être remplacé par le nouveau');
  r = await fetch(verifyLink2, { redirect: 'manual' });
  ok(r.status === 302 && r.headers.get('location') === 'https://jeu.example/#compte?ok=verifie', 'confirmation de l\'email ratée');
  ok((await fetch(verifyLink2, { redirect: 'manual' })).headers.get('location').includes('erreur=lien'), 'un lien de confirmation ne sert qu\'une fois');
  // ---- connexion ----
  ok((await api('/api/login', { login: 'julian', password: 'mauvais-mdp' })).status === 401, 'mauvais mot de passe accepté');
  r = await api('/api/login', { login: 'JULIAN', password: 'motdepasse1' });
  ok(r.status === 200 && r.body.token && r.body.user.pseudo === 'Julian' && r.body.user.email === 'julian@example.com', 'connexion par pseudo ratée');
  const token = r.body.token;
  ok((await api('/api/login', { login: 'Julian@example.COM', password: 'motdepasse1' })).status === 200, 'connexion par email ratée');
  ok((await api('/api/me', null, token)).body?.user?.pseudo === 'Julian', '/api/me avec jeton raté');
  ok((await api('/api/me', null, 'faux-jeton')).status === 401, '/api/me doit refuser un faux jeton');
  // ---- doublons ----
  ok((await api('/api/register', { ...good, pseudo: 'julian', email: 'x@example.com' })).status === 409, 'pseudo déjà pris (casse) accepté');
  ok((await api('/api/register', { ...good, pseudo: 'Juliàn', email: 'y@example.com' })).status === 409, 'pseudo déjà pris (accent) accepté');
  const before = mails.length;
  r = await api('/api/register', { ...good, pseudo: 'Autre', email: 'JULIAN@example.com' });
  ok(r.status === 201 && mails.length === before + 1 && /déjà un compte/.test(mails.at(-1).subject), 'email déjà utilisé : doit répondre pareil et prévenir le propriétaire par email');
  // ---- dans un salon : compte = pseudo réservé + badge, invité renommé ----
  const host = await new Client(`ws://localhost:${PORT}`).create('ffl', { pseudo: 'nimporte', token });
  let salon = null; host.onMessage('salon', s => salon = s); for (const k of ['chat', 'chatLog']) host.onMessage(k, () => {});
  const guest = await new Client(`ws://localhost:${PORT}`).joinById(host.roomId, { pseudo: 'Julian' });
  guest.onMessage('salon', () => {}); for (const k of ['chat', 'chatLog']) guest.onMessage(k, () => {});
  await sleep(400);
  const ps = salon.players.map(p => [p.pseudo, p.acct]);
  ok(JSON.stringify(ps) === JSON.stringify([['Julian', true], ['Julian invité', false]]), 'pseudos et badges dans le salon : ' + JSON.stringify(ps));
  host.leave(); guest.leave();
  // ---- mot de passe oublié ----
  ok((await api('/api/forgot', { email: 'inconnu@example.com' })).status === 200, 'mot de passe oublié doit répondre pareil pour un email inconnu');
  ok((await api('/api/forgot', { email: 'julian@example.com' })).status === 200, 'mot de passe oublié raté');
  const resetToken = (linkIn(lastMail('julian@example.com'), /#reinit\?t=[\w-]+/) || '').split('t=')[1];
  ok(resetToken, 'email de nouveau mot de passe manquant');
  ok((await api('/api/reset', { token: resetToken, password: 'court' })).status === 400, 'nouveau mot de passe trop court accepté');
  ok((await api('/api/reset', { token: resetToken, password: 'nouveaumdp2' })).status === 200, 'changement de mot de passe raté');
  ok((await api('/api/reset', { token: resetToken, password: 'encoreun3' })).status === 400, 'un lien de mot de passe ne sert qu\'une fois');
  ok((await api('/api/me', null, token)).status === 401, 'changer le mot de passe doit déconnecter les anciennes sessions');
  ok((await api('/api/login', { login: 'Julian', password: 'motdepasse1' })).status === 401, 'l\'ancien mot de passe marche encore');
  r = await api('/api/login', { login: 'Julian', password: 'nouveaumdp2' });
  ok(r.status === 200, 'connexion avec le nouveau mot de passe ratée');
  const token2 = r.body.token;
  // ---- limite de tentatives ----
  let last = 0; for (let i = 0; i < 11; i++) last = (await api('/api/login', { login: 'Julian', password: 'faux' + i })).status;
  ok(last === 429, 'trop de tentatives de connexion doivent être bloquées (dernier code ' + last + ')');
  // ---- suppression du compte ----
  ok((await api('/api/account/delete', { password: 'faux' }, token2)).status === 401, 'suppression sans le bon mot de passe');
  ok((await api('/api/account/delete', { password: 'nouveaumdp2' }, token2)).status === 200, 'suppression du compte ratée');
  ok((await admin.query(`SELECT COUNT(*) n FROM users WHERE email = 'julian@example.com'`))[0].n == 0 && (await admin.query(`SELECT COUNT(*) n FROM sessions`))[0].n == 0, 'le compte et ses sessions doivent être effacés');
  // ---- stockage : rien en clair ----
  const rows = await admin.query(`SELECT pass_hash FROM users`);
  ok(rows.every(u => u.pass_hash.startsWith('scrypt$')), 'mots de passe non hachés');
  console.log(`OK : comptes (validations, confirmation par email, connexion, doublons, salon, mot de passe oublié, limite de tentatives, suppression) · ${mails.length} emails`);
} catch (e) { fail(e.stack || e) }
await admin.end(); srv.kill(); process.exit(0);
