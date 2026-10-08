// Elo : calcul partagé par le simulateur de l'accueil et, plus tard, par le serveur.
export const RANK_NAMES = ['Bois', 'Pierre', 'Fer', 'Argent', 'Or', 'Rubis'];
export const DIVISIONS = ['III', 'II', 'I'];
export const ELO = {
  START: 1000,
  /** probabilité de victoire attendue de `me` contre `foe` */
  expected: (me: number, foe: number) => 1 / (1 + Math.pow(10, (foe - me) / 400)),
  /** facteur K : les premières parties font bouger l'Elo plus vite */
  K: (games: number) => games < 5 ? 80 : games < 30 ? 40 : 28,
  /** points gagnés (ou perdus, négatif) après une partie */
  delta(me: number, foe: number, won: boolean, games: number) { return Math.round(this.K(games) * ((won ? 1 : 0) - this.expected(me, foe))) },
  /** index du palier (0 = Bois III … 17 = Rubis I), un palier tous les 100 Elo à partir de 800 */
  tier(elo: number) { return elo < 900 ? 0 : Math.min(17, Math.floor((elo - 800) / 100)) },
  rank(elo: number) { const i = this.tier(elo); return RANK_NAMES[(i / 3) | 0] + ' ' + DIVISIONS[i % 3] },
};
/** fenêtres d'Elo de la file classée, élargies avec l'attente (secondes) */
export const QUEUE_WINDOWS: [number, string][] = [[20, '±100'], [40, '±250'], [60, '±500'], [Infinity, 'Tous']];
