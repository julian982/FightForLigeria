// Test de bout en bout : liste des parties, salon (pseudos, discussion, réglages, prêt, exclusion), puis une partie jouée quelques secondes.
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
const PORT = 2600 + (Math.random() * 300 | 0), URL_ = `ws://localhost:${PORT}`;
const srv = spawn(process.execPath, ['dist/index.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { srv.stdout.on('data', d => { if (String(d).includes('prêt')) ok() }); setTimeout(() => ko(new Error('le serveur ne démarre pas')), 10000) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('ÉCHEC :', m); srv.kill(); process.exit(1) };
const ok = (cond, m) => { if (!cond) fail(m) };
const IGNORE = ['joined', 'note', 'end', 'chatLog', 'chatRefused', 'snap', 'start', 'salon', 'chat'];
/** rejoint une salle en notant tous les messages reçus */
function track(room) {
  const t = { room, salon: null, chat: [], refused: [], start: null, snap: null, end: null, notes: [], left: null };
  room.onMessage('salon', m => t.salon = m); room.onMessage('chat', m => t.chat.push(m)); room.onMessage('chatLog', l => t.chat.push(...l));
  room.onMessage('chatRefused', m => t.refused.push(m.msg)); room.onMessage('start', m => t.start = m); room.onMessage('snap', s => t.snap = s);
  room.onMessage('end', e => t.end = e); room.onMessage('note', n => t.notes.push(n)); room.onLeave(code => t.left = code);
  for (const k of IGNORE) room.onMessage(k, () => {});
  return t;
}
try {
  // ---- la liste des parties ----
  const lobby = await new Client(URL_).joinOrCreate('lobby');
  let rooms = [];
  lobby.onMessage('rooms', l => rooms = l);
  lobby.onMessage('+', ([id, r]) => { const i = rooms.findIndex(x => x.roomId === id); if (i < 0) rooms.push(r); else rooms[i] = r });
  lobby.onMessage('-', id => rooms = rooms.filter(r => r.roomId !== id));
  await sleep(200);

  const H = track(await new Client(URL_).create('ffl', { name: 'Duel test', pseudo: 'Julian', map: 'cher', priv: false }));
  const P = track(await new Client(URL_).create('ffl', { pseudo: 'Secret', priv: true }));
  await sleep(400);
  ok(H.salon && H.salon.players.length === 1 && H.salon.host === H.salon.you && H.salon.name === 'Duel test', 'état du salon de l\'hôte incorrect');
  const listed = rooms.find(r => r.roomId === H.room.roomId);
  ok(listed && listed.metadata.name === 'Duel test' && listed.metadata.host === 'Julian' && listed.metadata.map === 'cher' && listed.clients === 1, 'le salon public n\'apparaît pas correctement dans la liste');
  ok(!rooms.some(r => r.roomId === P.room.roomId), 'le salon privé ne doit pas apparaître dans la liste');
  ok(P.salon && P.salon.name === 'Partie de Secret' && P.salon.priv, 'nom par défaut ou visibilité du salon privé incorrects');
  const P2 = track(await new Client(URL_).joinById(P.room.roomId, { pseudo: 'Ami' }));
  await sleep(200);
  ok(P2.salon && P2.salon.players.length === 2, 'on doit pouvoir rejoindre un salon privé par son code');

  // ---- un invité rejoint le salon public : pseudo dédoublonné, discussion ----
  const G = track(await new Client(URL_).joinById(H.room.roomId, { pseudo: 'julian' }));
  await sleep(300);
  ok(G.salon.players.length === 2 && G.salon.players[1].pseudo === 'julian 2' && G.salon.players[1].team === 1, 'pseudo en double non corrigé ou équipe incorrecte');
  ok(rooms.find(r => r.roomId === H.room.roomId)?.clients === 2, 'la liste doit montrer 2 joueurs');
  ok(G.chat.some(m => m.sys && /ouvert le salon/.test(m.text)), 'l\'historique de la discussion doit être envoyé à l\'arrivée');
  G.room.send('chat', '  Salut\u0007 à tous  ');
  await sleep(200);
  ok(H.chat.some(m => m.who === 'julian 2' && m.text === 'Salut à tous'), 'message de discussion non reçu ou mal nettoyé');
  for (let i = 0; i < 6; i++) G.room.send('chat', 'spam ' + i);
  await sleep(200);
  ok(G.refused.length >= 1, 'l\'anti-spam de la discussion doit bloquer le 6e message');

  // ---- réglages (hôte seulement), prêt, lancement ----
  G.room.send('settings', { map: 'amboise' });
  await sleep(150);
  ok(H.salon.map === 'cher', 'un invité ne doit pas pouvoir changer les réglages');
  H.room.send('ready', true); G.room.send('ready', true);
  await sleep(150);
  ok(H.salon.players.every(p => p.ready), 'les deux joueurs devraient être prêts');
  H.room.send('settings', { map: 'chinon' }); await sleep(150);
  ok(H.salon.map === 'chinon' && H.salon.players.every(p => !p.ready), 'changer la carte doit remettre tout le monde « pas prêt »');
  ok(rooms.find(r => r.roomId === H.room.roomId)?.metadata.map === 'chinon', 'la liste doit suivre le changement de carte');
  H.room.send('settings', { map: 'cher' }); await sleep(150);
  H.room.send('launch'); await sleep(150);
  ok(!H.start && H.refused.some(m => /prêt/.test(m)), 'on ne doit pas pouvoir lancer si personne n\'est prêt');
  G.room.send('ready', true); H.room.send('ready', true); await sleep(150);
  G.room.send('launch'); await sleep(150);
  ok(!G.start, 'seul l\'hôte peut lancer la partie');
  H.room.send('launch'); await sleep(700);
  ok(H.start && G.start && H.start.team === 0 && G.start.team === 1 && H.start.map === 'cher', 'pas de message start correct');
  ok(H.snap && G.snap, 'aucun instantané reçu');
  ok(rooms.find(r => r.roomId === H.room.roomId)?.metadata.playing === true, 'la liste doit montrer la partie en cours');

  // ---- la partie ----
  const s0 = G.snap, x0 = s0.u.find(u => u[0] === s0.tm[1].lord)[3];
  G.room.send('cmd', { c: 'steer', dx: -1, dy: 0 });
  H.room.send('cmd', { c: 'place', type: 'reserve', tx: 10, ty: 16 });
  H.room.send('cmd', { c: 'place', type: 'reserve', tx: 10, ty: 16 }); // la deuxième doit être refusée
  await sleep(1200);
  const s1 = G.snap, lord1 = s1.u.find(u => u[0] === s1.tm[1].lord);
  ok(lord1[3] < x0 - 60, `le seigneur invité n'a pas bougé (${x0} → ${lord1[3]})`);
  ok(s1.b.filter(b => b[1] === 0 && b[2] === 1).length === 1, 'la réserve de l\'hôte devrait exister une fois');
  ok(s1.tm[0].res.bois === 30, 'le stock de départ devrait être arrivé dans la réserve');
  ok(H.notes.some(n => /déjà/.test(n.msg)), 'le refus de la deuxième réserve n\'est pas arrivé');
  await H.room.leave();
  await sleep(800);
  ok(G.end && G.end.winner === 1, 'l\'invité aurait dû gagner par abandon');

  // ---- exclusion et passation d'hôte ----
  const K = track(await new Client(URL_).create('ffl', { pseudo: 'Hote' }));
  const KG = track(await new Client(URL_).joinById(K.room.roomId, { pseudo: 'Gêneur' }));
  await sleep(200);
  KG.room.send('kick', K.salon.you); await sleep(150);
  ok(K.left === null, 'un invité ne doit pas pouvoir exclure l\'hôte');
  K.room.send('kick', KG.salon.you); await sleep(300);
  ok(KG.left === 4001 && K.salon.players.length === 1, 'l\'exclusion n\'a pas fonctionné');
  const KG2 = track(await new Client(URL_).joinById(K.room.roomId, { pseudo: 'Suivant' }));
  await sleep(200);
  await K.room.leave(); await sleep(300);
  ok(KG2.salon.host === KG2.salon.you && KG2.chat.some(m => /devient l'hôte/.test(m.text)), 'le joueur restant doit devenir l\'hôte');

  console.log(`OK : liste en direct, salon privé caché, pseudos, discussion, réglages, prêt, lancement, partie (${s1.u.length} unités), abandon, exclusion, passation d'hôte`);
  await G.room.leave().catch(() => {}); await KG2.room.leave(); await P.room.leave(); await P2.room.leave(); await lobby.leave();
} catch (e) { fail(e.message || e) }
srv.kill(); process.exit(0);
