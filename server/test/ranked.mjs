// Test de bout en bout : inscription immédiate (sans email), blason, historique, file classée 1v1 et 2v2, Elo, classement.
// Contre une vraie base MariaDB (variables DB_*). Sans base configurée, le test est ignoré.
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
import * as mariadb from 'mariadb';

if (!process.env.DB_HOST) { console.log('classé : pas de base de données (DB_HOST), test ignoré'); process.exit(0) }
const PORT = 3300 + (Math.random() * 300 | 0), BASE = `http://localhost:${PORT}`, WS = `ws://localhost:${PORT}`;
const admin = await mariadb.createConnection({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
for (const t of ['season_results', 'meta', 'match_players', 'matches', 'email_tokens', 'sessions', 'users', 'schema_version']) await admin.query(`DROP TABLE IF EXISTS ${t}`);
const srv = spawn(process.execPath, ['dist/index.mjs'], { env: { ...process.env, PORT: String(PORT), SMTP_HOST: '', EMAIL_VERIFY: '', ADMIN_PSEUDOS: 'arthur', ADMIN_EMAILS: '', SEASON_CHECK_MS: '300' }, stdio: ['ignore', 'pipe', 'inherit'] });
let out = '';
await new Promise((ok, ko) => { srv.stdout.on('data', d => { out += d; if (out.includes('base de données prête')) ok() }); setTimeout(() => ko(new Error('le serveur ne démarre pas :\n' + out.slice(-500))), 20000) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('ÉCHEC :', m); srv.kill(); process.exit(1) };
const ok = (c, m) => { if (!c) fail(m) };
async function api(path, body, token) {
  const r = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json() } catch (e) {}
  return { status: r.status, body: j };
}
async function signup(pseudo, blason) {
  const r = await api('/api/register', { pseudo, email: pseudo.toLowerCase() + '@exemple.fr', password: 'motdepasse1', terms: true, blason });
  ok(r.status === 201 && r.body.token && r.body.user.pseudo === pseudo, `inscription immédiate de ${pseudo} : ` + JSON.stringify(r.body));
  return r.body;
}
/** entre dans la file classée et attend d'être apparié, puis rejoint la partie */
async function queueUp(token, mode) {
  const qr = await new Client(WS).joinOrCreate('ranked', { token, mode });
  const t = { qr, q: null, match: null, cancel: null };
  qr.onMessage('q', m => t.q = m); qr.onMessage('match', m => t.match = m); qr.onMessage('qError', () => {}); qr.onMessage('replaced', () => {});
  return t;
}
async function enter(token, roomId) {
  const room = await new Client(WS).joinById(roomId, { token });
  const t = { room, start: null, end: null, elo: null, cancel: null, salon: null, left: null };
  room.onMessage('start', m => t.start = m); room.onMessage('end', m => t.end = m); room.onMessage('elo', m => t.elo = m); room.onMessage('cancel', m => t.cancel = m);
  room.onMessage('salon', m => t.salon = m); room.onLeave(c => t.left = c);
  for (const k of ['snap', 'note', 'chat', 'chatLog', 'chatRefused']) room.onMessage(k, () => {});
  return t;
}
const until = async (f, ms, what) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) fail('délai dépassé : ' + what); await sleep(50) } };

try {
  // ---- inscription sans email : connecté tout de suite, blason gardé (et nettoyé) ----
  const A = await signup('Arthur', { s: 'losange', f: 'gueules', t: 'or', d: 'parti', c: 'tour', k: 'argent' });
  ok(A.user.blason.s === 'losange' && A.user.blason.c === 'tour' && A.user.r1.elo === 1000 && !A.user.r1.placed && A.user.r1.rank === 'Bois I', 'blason ou Elo de départ incorrects');
  const B = await signup('Blanche', { s: '<script>', f: 'gueules' });
  ok(B.user.blason.s === 'ecu' && B.user.blason.f === 'gueules', 'un blason invalide doit être nettoyé');
  ok((await api('/api/register', { pseudo: 'Autre', email: 'arthur@exemple.fr', password: 'motdepasse1', terms: true })).status === 409, 'email en double accepté');
  ok((await api('/api/me', null, A.token)).body.user.pseudo === 'Arthur', '/api/me avec le jeton de l\'inscription');
  ok((await api('/api/login', { login: 'Arthur', password: 'motdepasse1' })).status === 200, 'connexion après inscription sans email');
  let r = await api('/api/account/blason', { blason: { s: 'rond', f: 'sinople', t: 'argent', d: 'ecartele', c: 'grappe', k: 'pourpre' } }, A.token);
  ok(r.status === 200 && r.body.blason.c === 'grappe', 'changement de blason');
  ok((await api('/api/me', null, A.token)).body.user.blason.s === 'rond', 'le blason doit être enregistré');

  // ---- partie contre l'IA déclarée par le navigateur : historique seulement ----
  ok((await api('/api/history/solo', { map: 'cher', won: true, duration: 600 }, A.token)).status === 200, 'partie solo refusée');
  ok((await api('/api/history/solo', { map: 'jardin', won: true, duration: 600 }, A.token)).status === 400, 'le tutoriel ne va pas dans l\'historique');
  ok((await api('/api/history/solo', { map: 'cher', won: true, duration: 600 })).status === 401, 'historique sans compte');
  r = await api('/api/history', null, A.token);
  ok(r.body.matches.length === 1 && r.body.matches[0].kind === 'solo' && r.body.matches[0].won && r.body.matches[0].foes[0].ai, 'historique solo incorrect');

  // ---- file classée : sans compte, refusé ----
  let refused = false; try { await new Client(WS).joinOrCreate('ranked', { mode: '1v1' }) } catch (e) { refused = true }
  ok(refused, 'la file classée doit demander un compte');
  // un joueur ne peut pas fabriquer une partie classée lui-même
  const fake = await new Client(WS).create('ffl', { ranked: true, seats: [{ userId: 1 }, { userId: 2 }], token: A.token });
  let fakeSalon = null; fake.onMessage('salon', m => fakeSalon = m);
  for (const k of ['chat', 'chatLog', 'chatRefused']) fake.onMessage(k, () => {});
  await sleep(300);
  ok(fakeSalon && fakeSalon.players.length === 1, 'une partie « classée » créée par un joueur doit rester un salon ordinaire');
  fake.leave();

  // ---- 1v1 classé : appariement, partie, abandon, Elo ----
  const qa = await queueUp(A.token, '1v1'), qb = await queueUp(B.token, '1v1');
  await until(() => qa.match && qb.match, 4000, 'appariement 1v1');
  ok(qa.match.roomId === qb.match.roomId && qa.match.mode === '1v1', 'les deux joueurs doivent être envoyés dans la même partie');
  qa.qr.leave(); qb.qr.leave();
  const ga = await enter(A.token, qa.match.roomId);
  // un intrus (compte non attendu) est refusé
  const C = await signup('Clovis');
  const intruder = await enter(C.token, qa.match.roomId).catch(() => null);
  await sleep(300);
  ok(!intruder || intruder.left === 4003, 'un compte non attendu ne doit pas entrer dans une partie classée');
  const gb = await enter(B.token, qa.match.roomId);
  await until(() => ga.start && gb.start, 4000, 'lancement automatique de la partie classée');
  ok(ga.start.ranked && ga.start.map === qa.match.map && ga.start.team !== gb.start.team, 'lancement classé incorrect');
  await sleep(1200);
  // Blanche quitte : défaite pour elle, victoire pour Arthur
  const aSide = ga.start.team & 1;
  gb.room.leave();
  await until(() => ga.end && ga.elo, 6000, 'fin de partie et Elo');
  ok(ga.end.winner === aSide && ga.elo.won && ga.elo.before === 1000 && ga.elo.delta === 40 && ga.elo.after === 1040 && ga.elo.games === 1, 'Elo du gagnant : ' + JSON.stringify(ga.elo));
  ok(ga.elo.rank === 'Bois I' && ga.elo.rankBefore === 'Bois I' && !ga.elo.placed, 'rang après une partie');
  let me = (await api('/api/me', null, B.token)).body.user;
  ok(me.r1.elo === 960 && me.r1.games === 1 && me.r1.wins === 0, 'Elo du perdant (abandon) : ' + JSON.stringify(me.r1));
  r = await api('/api/history', null, B.token);
  const h = r.body.matches[0];
  ok(h.kind === 'ranked' && !h.won && h.left && h.eloBefore === 1000 && h.eloAfter === 960 && h.foes[0].pseudo === 'Arthur' && h.foes[0].blason.c === 'grappe', 'historique classé : ' + JSON.stringify(h));
  ga.room.leave();

  // ---- départ avant le lancement : partie annulée, sans effet ----
  const q1 = await queueUp(A.token, '1v1'), q2 = await queueUp(C.token, '1v1');
  await until(() => q1.match && q2.match, 4000, 'deuxième appariement');
  q1.qr.leave(); q2.qr.leave();
  const g1 = await enter(A.token, q1.match.roomId);
  g1.room.leave(); await sleep(200);
  const g2 = await enter(C.token, q1.match.roomId).catch(() => null);
  await sleep(500);
  me = (await api('/api/me', null, A.token)).body.user;
  ok(me.r1.games === 1 && me.r1.elo === 1040, 'une partie annulée ne doit pas compter');

  // ---- placement et classement : 4 parties de plus pour Arthur ----
  await admin.query(`UPDATE users SET games1 = 5, elo1 = 1234 WHERE pseudo = 'Arthur'`);
  r = await api('/api/leaderboard?mode=1v1', null, A.token);
  ok(r.body.players.length === 1 && r.body.players[0].pseudo === 'Arthur' && r.body.players[0].you && r.body.players[0].rank === 'Pierre II' && r.body.me.place === 1, 'classement : ' + JSON.stringify(r.body));
  r = await api('/api/leaderboard?mode=1v1', null, B.token);
  ok(r.body.me.place === null && !r.body.me.placed, 'un joueur non placé n\'a pas de place');

  // ---- 2v2 classé : quatre comptes, équipes équilibrées ----
  const D = await signup('Dagobert');
  await admin.query(`UPDATE users SET elo2 = CASE pseudo WHEN 'Arthur' THEN 1300 WHEN 'Blanche' THEN 1200 WHEN 'Clovis' THEN 1100 ELSE 1000 END`);
  const qs = [];
  for (const u of [A, B, C, D]) qs.push(await queueUp(u.token, '2v2'));
  // 1300/1200/1100/1000 : ±100 ne suffit pas, il faut attendre que la fenêtre s'élargisse (±500 après 40 s)… on la force ici
  await admin.query(`UPDATE users SET elo2 = 1000 + (id % 3) * 30`);
  for (const q of qs) q.qr.leave();
  await sleep(300);
  const q4 = [];
  for (const u of [A, B, C, D]) q4.push(await queueUp(u.token, '2v2'));
  await until(() => q4.every(q => q.match), 4000, 'appariement 2v2');
  ok(new Set(q4.map(q => q.match.roomId)).size === 1, '2v2 : tout le monde dans la même partie');
  for (const q of q4) q.qr.leave();
  const gs = [];
  for (const u of [A, B, C, D]) gs.push(await enter(u.token, q4[0].match.roomId));
  await until(() => gs.every(g => g.start), 5000, 'lancement 2v2');
  ok(gs.every(g => g.start.mode === '2v2' && g.start.ranked), '2v2 classé lancé');
  // ---- administration : réservée aux comptes déclarés ----
  ok(A.user.admin === true && B.user.admin === false, 'drapeau administrateur');
  r = await api('/api/admin/stats', null, B.token); ok(r.status === 403, 'un joueur ordinaire ne voit pas l\'administration');
  r = await api('/api/admin/stats'); ok(r.status === 401, 'administration sans session');
  r = await api('/api/admin/stats', null, A.token);
  ok(r.status === 200 && r.body.stats.users === 4 && r.body.users.length === 4 && r.body.stats.matches >= 2 && r.body.stats.byKind.ranked >= 1, 'statistiques : ' + JSON.stringify(r.body.stats));
  ok(r.body.users.find(x => x.pseudo === 'Arthur').games >= 2, 'nombre de parties par joueur');
  console.log('OK : administration (droits, chiffres, liste des joueurs) · inscription sans email, blason, historique (solo, classé), file classée sans compte refusée, partie classée fabriquée refusée, 1v1 (appariement, intrus refusé, lancement, abandon, Elo ±40), partie annulée, classement et place, 2v2 (appariement, lancement)');
  for (const g of gs) g.room.leave();
  try { g2 && g2.room.leave() } catch (e) {}
  await sleep(800);

  // ---- saisons : la saison notée en base est en retard sur le calendrier → elle est clôturée ----
  r = await api('/api/profile?pseudo=Arthur');
  ok(r.status === 200 && r.body.pseudo === 'Arthur' && r.body.seasons.length === 0 && r.body.frame === null && r.body.matches.length >= 1 && r.body.matches.every(m => m.kind === 'ranked') && !r.body.you, 'profil public avant la fin de saison : ' + JSON.stringify(r.body).slice(0, 300));
  ok(r.body.season.n >= 1 && r.body.season.end > r.body.season.start, 'saison en cours dans le profil');
  ok((await api('/api/profile?pseudo=Arthur', null, A.token)).body.you === true, 'son propre profil');
  ok((await api('/api/profile?pseudo=Personne')).status === 404, 'profil inconnu');
  await admin.query(`UPDATE users SET games1 = 12, wins1 = 8, elo1 = 1834, peak1 = 1900 WHERE pseudo = 'Arthur'`);
  await admin.query(`UPDATE users SET games1 = 3, wins1 = 1, elo1 = 1100, peak1 = 0 WHERE pseudo = 'Blanche'`);
  const cur = +(await admin.query(`SELECT v FROM meta WHERE k = 'season'`))[0].v, prev = cur - 1;
  await admin.query(`UPDATE meta SET v = ? WHERE k = 'season'`, [String(prev)]);
  let meA = null;
  for (let i = 0; i < 60 && !(meA && meA.r1.games === 0); i++) { await sleep(100); meA = (await api('/api/me', null, A.token)).body.user }
  ok(meA.r1.games === 0 && meA.r1.elo === 1417 && !meA.r1.placed && meA.r1.rank === 'Fer III', 'soft reset : 1834 → 1417 (Fer III), placement à refaire : ' + JSON.stringify(meA.r1));
  ok(meA.frame && meA.frame.season === prev && meA.frame.metal === 3, 'cadre Argent (meilleur Elo 1900) : ' + JSON.stringify(meA.frame));
  const meB = (await api('/api/me', null, B.token)).body.user;
  ok(meB.frame === null && meB.r1.elo === 1050, 'pas de cadre sans placement, Elo rapproché de 1000 : ' + JSON.stringify(meB));
  r = await api('/api/profile?pseudo=Arthur');
  const s0 = r.body.seasons[0];
  ok(s0.season === prev && s0.modes['1v1'].elo === 1834 && s0.modes['1v1'].peakRank === 'Argent I' && s0.modes['1v1'].place === 1 && s0.reward.metal === 3 && r.body.frame.metal === 3, 'saison passée dans le profil : ' + JSON.stringify(s0));
  ok(r.body.r1.games === 0 && r.body.r1.place === null, 'nouvelle saison : pas encore placé');
  r = await api('/api/leaderboard?mode=1v1', null, A.token);
  ok(r.body.players.length === 0 && r.body.season.n >= 1, 'nouvelle saison : classement vide tant que personne n\'est placé');
  await admin.query(`UPDATE users SET games1 = 5 WHERE pseudo = 'Arthur'`);
  r = await api('/api/leaderboard?mode=1v1');
  ok(r.body.players[0].frame && r.body.players[0].frame.metal === 3, 'le cadre apparaît dans le classement');
  await sleep(700);
  ok((await admin.query(`SELECT COUNT(*) AS c FROM season_results WHERE season = ?`, [prev]))[0].c >= 2 && +(await admin.query(`SELECT v FROM meta WHERE k = 'season'`))[0].v === cur, 'la saison n\'est clôturée qu\'une fois');
  console.log('OK : saisons (clôture, soft reset, cadre de blason, profil public, classement)');
} catch (e) { fail(e.stack || e) }
await admin.end(); srv.kill(); process.exit(0);
