// Les saisons classées : 3 mois chacune, à partir du 1er novembre 2026 (minuit, heure de Paris).
// La saison 1 couvre aussi tout ce qui a été joué avant cette date.
//
// En fin de saison :
// - chaque joueur placé garde une trace de la saison (Elo final, meilleur Elo, victoires, place) ;
// - il reçoit le cadre de blason du meilleur rang atteint pendant la saison (Saison 1 · Or, par exemple) ;
// - son Elo est rapproché de 1000 de moitié (« soft reset ») et il rejoue 5 parties de placement. Un joueur très haut ne
//   repart donc pas tout en bas : à 2000 Elo (Or III), il reprend à 1500 (Fer II) ; à 2600 (Rubis I), à 1800 (Argent II).
import { ELO, RANK_NAMES } from './elo';

/** début officiel de la saison 1 : 1er novembre 2026 (elle se termine le 1er février 2027) */
const FIRST = { y: 2026, m: 10 }; // mois 0 = janvier : novembre 2026
export const SEASON_MONTHS = 3;

/** minuit, heure de Paris, le 1er du mois (y, m) (heure d'été d'avril à octobre) */
function parisMonthStart(y: number, m: number) {
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12, summer = mm >= 3 && mm <= 9;
  return Date.UTC(yy, mm, 1, 0) - (summer ? 2 : 1) * 3600_000;
}
/** début de la saison n (la saison 1 commence officiellement le 1er novembre 2026) */
export const seasonStart = (n: number) => parisMonthStart(FIRST.y, FIRST.m + (n - 1) * SEASON_MONTHS);
/** fin de la saison n (= début de la suivante) */
export const seasonEnd = (n: number) => seasonStart(n + 1);
/** numéro de la saison en cours à l'instant t (en ms) */
export function seasonAt(t = Date.now()) { let n = 1; while (t >= seasonEnd(n)) n++; return n }
export const seasonInfo = (n = seasonAt()) => ({ n, start: seasonStart(n), end: seasonEnd(n) });

/** Elo de départ de la saison suivante : rapproché de 1000 de moitié */
export const softReset = (elo: number) => Math.round(ELO.START + (elo - ELO.START) / 2);

/** les cadres de blason, un par famille de rangs (Bois, Pierre, Fer, Argent, Or, Rubis) : couleur sombre et claire */
export const FRAME_METALS: { name: string, dark: string, light: string }[] = [
  { name: 'Bois', dark: '#7a4a22', light: '#c58f5a' },
  { name: 'Pierre', dark: '#7f7b70', light: '#d2cdbf' },
  { name: 'Fer', dark: '#4b5762', light: '#a3b0bb' },
  { name: 'Argent', dark: '#9ea6af', light: '#f4f7fa' },
  { name: 'Or', dark: '#b07f1e', light: '#ffe28c' },
  { name: 'Rubis', dark: '#8e1229', light: '#ff7a8f' },
];
/** le cadre gagné en fin de saison : famille du meilleur rang atteint (seulement si le joueur a été placé) */
export type Frame = { season: number, metal: number };
export const metalOf = (elo: number) => Math.floor(ELO.tier(elo) / 3);
export const frameName = (f: Frame) => `Saison ${f.season} · ${RANK_NAMES[f.metal] || ''}`;
