// La partie classée : file d'attente (1v1 et 2v2) et calcul de l'Elo à la fin de la partie.
//
// File : un joueur connecté à son compte entre dans la salle « ranked » avec son mode. Chaque seconde, on cherche pour
// le joueur qui attend depuis le plus longtemps des adversaires dont l'Elo est dans sa fenêtre (±100, puis ±250, ±500,
// puis n'importe qui, selon son attente). Une fois trouvés, on crée une salle de partie privée réservée à ces comptes,
// avec une carte tirée au sort, et chacun reçoit son code pour la rejoindre. La partie démarre dès que tous sont là.
//
// Fin : chaque joueur gagne ou perd selon ELO.delta (en 2v2, avec l'Elo moyen de chaque équipe). Quitter compte comme
// une défaite. Contre le même adversaire, à partir de la 4e partie classée de la journée, gains et pertes sont divisés par deux.
import { Room, matchMaker, type Client } from '@colyseus/core';
import { ELO, MAP_IDS, queueWindow } from '@ffl/shared';
import { q, dbReady } from './db';
import { sessionUser, saveMatch, ladderOf } from './accounts';

import { randomBytes } from 'node:crypto';

type Mode = '1v1' | '2v2';
/** clé connue du seul serveur : la salle de partie vérifie qu'elle a bien été créée par la file classée */
export const RANKED_KEY = randomBytes(24).toString('base64url');
type Entry = { client: Client, userId: number, pseudo: string, elo: number, games: number, mode: Mode, since: number };
const SIZE: Record<Mode, number> = { '1v1': 2, '2v2': 4 };
/** les comptes en train de chercher (un compte n'est qu'une fois dans la file) */
const queue = new Map<number, Entry>();

export class QueueRoom extends Room {
  maxClients = 500;
  timer: any = null;

  onCreate() {
    this.autoDispose = false;
    this.timer = setInterval(() => this.tick(), 1000);
  }
  async onAuth(_client: Client, o: any = {}) {
    if (!dbReady()) throw new Error('Les comptes sont momentanément indisponibles.');
    const u = await sessionUser(String(o.token || ''));
    if (!u) throw new Error('Connecte-toi à ton compte pour jouer en classé.');
    return u;
  }
  onJoin(client: Client, o: any = {}, u?: any) {
    u = u || client.auth;
    const mode: Mode = o.mode === '2v2' ? '2v2' : '1v1', n = mode === '2v2' ? 2 : 1;
    // le même compte dans un autre onglet : l'ancienne recherche s'arrête
    const old = queue.get(u.id);
    if (old && old.client !== client) { old.client.send('replaced', {}); old.client.leave(4005) }
    queue.set(u.id, { client, userId: u.id, pseudo: u.pseudo, elo: u['elo' + n], games: u['games' + n], mode, since: Date.now() });
    this.status();
  }
  onLeave(client: Client) {
    for (const [id, e] of queue) if (e.client === client) queue.delete(id);
    this.status();
  }
  onDispose() { clearInterval(this.timer) }

  /** chaque joueur en attente reçoit : son attente, sa fenêtre d'Elo et le nombre de joueurs dans sa file */
  status() {
    const now = Date.now(), count = { '1v1': 0, '2v2': 0 };
    for (const e of queue.values()) count[e.mode]++;
    for (const e of queue.values()) {
      const w = queueWindow((now - e.since) / 1000);
      e.client.send('q', { waited: Math.floor((now - e.since) / 1000), window: Number.isFinite(w) ? w : null, players: count[e.mode], elo: e.elo, games: e.games });
    }
  }
  async tick() {
    for (const mode of ['1v1', '2v2'] as Mode[]) {
      let found: Entry[] | null;
      while ((found = pickMatch(mode))) {
        for (const e of found) queue.delete(e.userId);
        await startRanked(mode, found).catch(e => {
          console.error('classé : création de la partie ratée', e);
          for (const x of found!) x.client.send('qError', { msg: 'La partie n\'a pas pu être créée. Relance la recherche.' });
        });
      }
    }
    this.status();
  }
}

/** le joueur qui attend depuis le plus longtemps et les adversaires les plus proches de son Elo, dans sa fenêtre */
export function pickMatch(mode: Mode, now = Date.now(), list: Entry[] = [...queue.values()]): Entry[] | null {
  const waiting = list.filter(e => e.mode === mode).sort((a, b) => a.since - b.since), need = SIZE[mode];
  for (const e of waiting) {
    const w = queueWindow((now - e.since) / 1000);
    // c'est la fenêtre du joueur qui attend le plus qui compte : elle est la plus large de la file
    const near = waiting.filter(o => o !== e && Math.abs(o.elo - e.elo) <= w)
      .sort((a, b) => Math.abs(a.elo - e.elo) - Math.abs(b.elo - e.elo));
    if (near.length >= need - 1) return [e, ...near.slice(0, need - 1)];
  }
  return null;
}
/** équipes équilibrées en 2v2 : le plus fort avec le plus faible. Renvoie les joueurs dans l'ordre des places (0, 2 à gauche ; 1, 3 à droite). */
export function seatOrder(ps: Entry[]) {
  if (ps.length === 2) return Math.random() < .5 ? ps : [ps[1], ps[0]];
  const s = [...ps].sort((a, b) => b.elo - a.elo); // a ≥ b ≥ c ≥ d : gauche = a + d, droite = b + c
  return [s[0], s[1], s[3], s[2]];
}

async function startRanked(mode: Mode, found: Entry[]) {
  const seats = seatOrder(found).map(e => ({ userId: e.userId, pseudo: e.pseudo }));
  const map = MAP_IDS[(Math.random() * MAP_IDS.length) | 0];
  const room = await matchMaker.createRoom('ffl', { ranked: true, rankedKey: RANKED_KEY, mode, map, seats });
  for (const e of found) e.client.send('match', { roomId: room.roomId, mode, map });
  console.log(`classé ${mode} : ${found.map(e => `${e.pseudo} (${e.elo})`).join(', ')} → ${room.roomId}`);
}

// ---------------- fin d'une partie classée ----------------
export type RankedSeat = { slot: number, userId: number, pseudo: string, left: boolean };
export type EloResult = { before: number, after: number, delta: number, games: number, wins: number, placed: boolean, rank: string, tier: number, rankBefore: string, tierBefore: number, placedBefore: boolean, won: boolean, halved: boolean };
/** calcule et enregistre l'Elo de chaque joueur, enregistre la partie. Renvoie le résultat de chaque place. */
export async function settleRanked(m: { mode: Mode, map: string, duration: number, winner: number, seats: RankedSeat[] }): Promise<Record<number, EloResult>> {
  const n = m.mode === '2v2' ? 2 : 1, side = (slot: number) => slot & 1;
  const ids = m.seats.map(s => s.userId);
  const rows = await q(`SELECT id, pseudo, elo${n} AS elo, games${n} AS games, wins${n} AS wins FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  const byId = new Map<number, any>(rows.map((r: any) => [r.id, r]));
  const elo = (s: RankedSeat) => byId.get(s.userId)?.elo ?? ELO.START;
  const avg = (sd: number) => { const l = m.seats.filter(s => side(s.slot) === sd); return l.reduce((t, s) => t + elo(s), 0) / Math.max(1, l.length) };
  // anti-arrangement en 1v1 : à partir de la 4e partie classée de la journée contre le même adversaire, tout est divisé par deux
  let halved = false;
  if (n === 1 && m.seats.length === 2) {
    const c = await q(`SELECT COUNT(*) AS c FROM matches mt JOIN match_players a ON a.match_id = mt.id JOIN match_players b ON b.match_id = mt.id
      WHERE mt.kind = 'ranked' AND mt.mode = '1v1' AND mt.played_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) AND a.user_id = ? AND b.user_id = ?`, [m.seats[0].userId, m.seats[1].userId]);
    halved = c[0].c >= 3;
  }
  const out: Record<number, EloResult> = {};
  for (const s of m.seats) {
    const r = byId.get(s.userId); if (!r) continue; // compte supprimé pendant la partie
    const won = side(s.slot) === m.winner && !s.left;
    let d = ELO.delta(avg(side(s.slot)), avg(1 - side(s.slot)), won, r.games);
    if (halved) d = Math.round(d / 2);
    const after = Math.max(0, r.elo + d), before = ladderOf(r.elo, r.games, r.wins), now = ladderOf(after, r.games + 1, r.wins + (won ? 1 : 0));
    await q(`UPDATE users SET elo${n} = ?, games${n} = games${n} + 1, wins${n} = wins${n} + ? WHERE id = ?`, [after, won ? 1 : 0, s.userId]);
    out[s.slot] = { before: r.elo, after, delta: after - r.elo, games: now.games, wins: now.wins, placed: now.placed, rank: now.rank, tier: now.tier,
      rankBefore: before.rank, tierBefore: before.tier, placedBefore: before.placed, won, halved };
  }
  await saveMatch({ kind: 'ranked', mode: m.mode, map: m.map, duration: m.duration, winner: m.winner, players: m.seats.map(s => ({
    slot: s.slot, userId: s.userId, pseudo: s.pseudo, side: side(s.slot), won: !!out[s.slot]?.won, left: s.left, eloBefore: out[s.slot]?.before, eloAfter: out[s.slot]?.after,
  })) });
  return out;
}
