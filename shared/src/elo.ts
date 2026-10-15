// Elo : calcul partagé par le simulateur de l'accueil, la file classée du serveur et l'animation de fin de partie.
export const RANK_NAMES = ['Bois', 'Pierre', 'Fer', 'Argent', 'Or', 'Rubis'];
export const DIVISIONS = ['III', 'II', 'I'];
export const ELO = {
  START: 1000,
  /** parties de placement : avant, le rang affiché est « Non classé » */
  PLACEMENT: 5,
  /** probabilité de victoire attendue de `me` contre `foe` */
  expected: (me: number, foe: number) => 1 / (1 + Math.pow(10, (foe - me) / 400)),
  /** facteur K : les premières parties font bouger l'Elo plus vite */
  K: (games: number) => games < 5 ? 80 : games < 30 ? 40 : 28,
  /** points gagnés (ou perdus, négatif) après une partie */
  delta(me: number, foe: number, won: boolean, games: number) { return Math.round(this.K(games) * ((won ? 1 : 0) - this.expected(me, foe))) },
  /** index du palier (0 = Bois III … 17 = Rubis I), un palier tous les 100 Elo à partir de 800 */
  tier(elo: number) { return elo < 900 ? 0 : Math.min(17, Math.floor((elo - 800) / 100)) },
  rank(elo: number) { const i = this.tier(elo); return RANK_NAMES[(i / 3) | 0] + ' ' + DIVISIONS[i % 3] },
  /** bornes d'Elo d'un palier (le premier commence à 0, le dernier n'a pas de fin : on lui donne 100 points pour la jauge) */
  tierLo(i: number) { return i === 0 ? 0 : 800 + 100 * i },
  tierHi(i: number) { return i === 0 ? 900 : 900 + 100 * i },
};
/** fenêtres d'Elo de la file classée, élargies avec l'attente (secondes) */
export const QUEUE_WINDOWS: [number, string][] = [[20, '±100'], [40, '±250'], [60, '±500'], [Infinity, 'Tous']];
/** écart d'Elo accepté par la file classée après `sec` secondes d'attente */
export const queueWindow = (sec: number) => sec < 20 ? 100 : sec < 40 ? 250 : sec < 60 ? 500 : Infinity;
