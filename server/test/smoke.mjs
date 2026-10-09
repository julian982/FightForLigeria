// Test de bout en bout : lance le serveur, deux joueurs créent puis rejoignent un lobby et jouent quelques secondes.
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
const PORT = 2600 + (Math.random() * 300 | 0), URL_ = `ws://localhost:${PORT}`;
const srv = spawn(process.execPath, ['dist/index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { srv.stdout.on('data', d => { if (String(d).includes('prêt')) ok() }); setTimeout(() => ko(new Error('le serveur ne démarre pas')), 10000) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.error('ÉCHEC :', m); srv.kill(); process.exit(1) };
try {
  const host = await new Client(URL_).create('ffl', { map: 'cher' });
  const last = { 0: null, 1: null }, start = {}, notes = [];
  let ended = null;
  host.onMessage('joined', m => { if (m.team !== 0) fail('l\'hôte doit être l\'équipe 0') });
  host.onMessage('start', m => start[0] = m); host.onMessage('snap', s => last[0] = s); host.onMessage('note', n => notes.push(n));
  host.onMessage('end', () => {});
  const guest = await new Client(URL_).joinById(host.roomId);
  guest.onMessage('joined', () => {}); guest.onMessage('start', m => start[1] = m); guest.onMessage('snap', s => last[1] = s);
  guest.onMessage('note', () => {}); guest.onMessage('end', e => ended = e);
  await sleep(600);
  if (!start[0] || !start[1] || start[1].team !== 1 || start[0].map !== 'cher') fail('pas de message start correct');
  if (!last[0] || !last[1]) fail('aucun instantané reçu');
  const s0 = last[1], myLord = s0.u.find(u => u[0] === s0.tm[1].lord), x0 = myLord[3];
  // l'invité marche vers la gauche, l'hôte pose sa réserve
  guest.send('cmd', { c: 'steer', dx: -1, dy: 0 });
  host.send('cmd', { c: 'place', type: 'reserve', tx: 10, ty: 16 });
  host.send('cmd', { c: 'place', type: 'reserve', tx: 10, ty: 16 }); // la deuxième doit être refusée
  await sleep(1200);
  const s1 = last[1], lord1 = s1.u.find(u => u[0] === s1.tm[1].lord);
  if (!(lord1[3] < x0 - 60)) fail(`le seigneur invité n'a pas bougé (${x0} → ${lord1[3]})`);
  const res = s1.b.filter(b => b[1] === 0 && b[2] === 1);
  if (res.length !== 1) fail('la réserve de l\'hôte devrait exister une fois, trouvée ' + res.length);
  if (s1.tm[0].res.bois !== 30) fail('le stock de départ devrait être arrivé dans la réserve');
  if (!notes.some(n => /déjà/.test(n.msg))) fail('le refus de la deuxième réserve n\'est pas arrivé');
  // l'hôte quitte : l'invité gagne par abandon
  await host.leave();
  await sleep(800);
  if (!ended || ended.winner !== 1) fail('l\'invité aurait dû gagner par abandon');
  console.log(`OK : lobby ${host.roomId}, ${s1.u.length} unités, ${s1.w.length} ouvriers, ${s1.b.length} bâtiments, victoire par abandon reçue`);
  await guest.leave();
} catch (e) { fail(e.message || e) }
srv.kill(); process.exit(0);
