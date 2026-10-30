// Les saisons classées côté serveur : passage d'une saison à la suivante, et cadres de blason gagnés.
//
// La saison en cours est notée dans la table meta. Toutes les 10 minutes (et au démarrage), si le calendrier
// (shared/src/season.ts) est passé à une saison plus récente, on clôt la saison notée, dans une seule transaction :
// - une ligne par joueur et par mode dans season_results (Elo final, meilleur Elo une fois placé, victoires, place) ;
// - Elo rapproché de 1000 de moitié (soft reset), compteurs de parties et de victoires remis à zéro : 5 nouvelles
//   parties de placement, en partant de l'Elo réduit.
import { ELO, seasonAt, metalOf, type Frame } from '@ffl/shared';
import { q, tx, dbReady } from './db';

const CHECK_MS = +(process.env.SEASON_CHECK_MS || 600_000);

/** la saison notée en base (créée au premier passage avec la saison du calendrier) */
export async function storedSeason() {
  const r = await q(`SELECT v FROM meta WHERE k = 'season'`);
  if (r.length) return +r[0].v;
  const n = seasonAt();
  await q(`INSERT IGNORE INTO meta (k, v) VALUES ('season', ?)`, [String(n)]);
  return n;
}
/** clôt la saison s et ouvre la suivante. Ne fait rien si une autre instance l'a déjà fait. */
export async function closeSeason(s: number) {
  return tx(async run => {
    // verrou : seule la requête qui fait passer la saison de s à s + 1 continue
    const lock = await run(`UPDATE meta SET v = ? WHERE k = 'season' AND v = ?`, [String(s + 1), String(s)]);
    if (!lock.affectedRows) return false;
    for (const [n, mode] of [[1, '1v1'], [2, '2v2']] as const) {
      await run(`INSERT INTO season_results (season, user_id, mode, elo, peak, games, wins, place)
        SELECT ?, id, ?, elo${n}, peak${n}, games${n}, wins${n},
          IF(games${n} >= ?, ROW_NUMBER() OVER (PARTITION BY games${n} >= ? ORDER BY elo${n} DESC, games${n} DESC, id ASC), NULL)
        FROM users WHERE games${n} > 0`, [s, mode, ELO.PLACEMENT, ELO.PLACEMENT]);
      // soft reset pour tout le monde (même ceux qui n'ont pas joué cette saison) : on se rapproche de 1000 de moitié
      await run(`UPDATE users SET elo${n} = ROUND(? + (elo${n} - ?) / 2), games${n} = 0, wins${n} = 0, peak${n} = 0`, [ELO.START, ELO.START]);
    }
    console.log(`saisons : saison ${s} terminée, la saison ${s + 1} commence (Elo rapproché de 1000, placement à refaire)`);
    return true;
  });
}
/** rattrape le calendrier : clôt chaque saison terminée, dans l'ordre */
export async function checkSeason() {
  if (!dbReady()) return;
  try {
    const cur = seasonAt();
    for (let s = await storedSeason(); s < cur; s++) await closeSeason(s);
  } catch (e: any) { console.error('saisons : passage de saison raté :', e.code || e.message) }
}
setInterval(checkSeason, CHECK_MS).unref();

/** cadre affiché sur le blason de chaque compte : celui de la dernière saison où il a été placé (meilleur rang des deux modes) */
export async function framesOf(ids: number[]): Promise<Map<number, Frame>> {
  const out = new Map<number, Frame>();
  if (!ids.length || !dbReady()) return out;
  const rows = await q(`SELECT user_id, season, MAX(peak) AS peak FROM season_results WHERE user_id IN (${ids.map(() => '?').join(',')}) AND games >= ? AND peak > 0
    GROUP BY user_id, season ORDER BY season DESC`, [...ids, ELO.PLACEMENT]);
  for (const r of rows) if (!out.has(r.user_id)) out.set(r.user_id, { season: r.season, metal: metalOf(r.peak) });
  return out;
}
export const frameOf = async (id: number) => (await framesOf([id])).get(id) || null;
