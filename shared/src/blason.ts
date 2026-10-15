// Le blason d'un compte : forme de l'écu, émaux (couleurs héraldiques), partition et meuble (le motif central).
// Partagé par le serveur (validation de ce que le joueur envoie) et par le navigateur (dessin en SVG).

export const BL_SHAPES: [string, string][] = [['ecu', 'Écu'], ['francais', 'Écu français'], ['rond', 'Rondache'], ['losange', 'Losange'], ['banniere', 'Bannière']];
export const BL_TINCTURES: [string, string, string][] = [
  ['or', 'Or', '#e2b33c'], ['argent', 'Argent', '#eceae4'], ['gueules', 'Gueules', '#bf3129'], ['azur', 'Azur', '#2f5db5'],
  ['sinople', 'Sinople', '#2b7a42'], ['sable', 'Sable', '#26272c'], ['pourpre', 'Pourpre', '#77398c'], ['loire', 'Loire', '#24879a'],
];
export const BL_DIVS: [string, string][] = [['plein', 'Plein'], ['parti', 'Parti'], ['coupe', 'Coupé'], ['tranche', 'Tranché'], ['ecartele', 'Écartelé'], ['fasce', 'Fasce'], ['pal', 'Pal'], ['chevron', 'Chevron']];
export const BL_CHARGES: [string, string][] = [['aucun', 'Aucun'], ['lys', 'Fleur de lys'], ['tour', 'Tour'], ['etoile', 'Étoile'], ['croix', 'Croix'], ['epee', 'Épée'], ['couronne', 'Couronne'], ['grappe', 'Grappe'], ['cle', 'Clé']];

/** s : forme · f : émail du champ · t : second émail (partition) · d : partition · c : meuble · k : émail du meuble */
export type Blason = { s: string, f: string, t: string, d: string, c: string, k: string };
export const BLASON_DEFAULT: Blason = { s: 'ecu', f: 'azur', t: 'or', d: 'plein', c: 'lys', k: 'or' };

const ids = (l: [string, ...string[]][]) => l.map(x => x[0]);
const S = ids(BL_SHAPES), T = ids(BL_TINCTURES), D = ids(BL_DIVS), C = ids(BL_CHARGES);
/** garde uniquement des valeurs connues (le reste prend la valeur par défaut) */
export function cleanBlason(v: unknown): Blason {
  let o: any = v;
  if (typeof v === 'string') try { o = JSON.parse(v) } catch (e) { o = null }
  if (!o || typeof o !== 'object') return { ...BLASON_DEFAULT };
  const one = (x: unknown, list: string[], def: string) => typeof x === 'string' && list.includes(x) ? x : def;
  return { s: one(o.s, S, BLASON_DEFAULT.s), f: one(o.f, T, BLASON_DEFAULT.f), t: one(o.t, T, BLASON_DEFAULT.t), d: one(o.d, D, BLASON_DEFAULT.d), c: one(o.c, C, BLASON_DEFAULT.c), k: one(o.k, T, BLASON_DEFAULT.k) };
}
/** un blason tiré au hasard (point de départ de l'éditeur), avec des couleurs qui se distinguent */
export function randomBlason(rnd = Math.random): Blason {
  const p = <X>(l: X[]) => l[(rnd() * l.length) | 0];
  const metals = ['or', 'argent'], colors = T.filter(t => !metals.includes(t));
  // règle héraldique : on ne pose pas couleur sur couleur ni métal sur métal
  const f = p(colors), t = p(metals);
  return { s: p(S.slice(0, 4)), f, t, d: p(D), c: p(C.slice(1)), k: p(metals) === t ? t : p(metals) };
}
