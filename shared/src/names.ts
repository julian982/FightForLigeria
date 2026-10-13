// Identité des ouvriers : prénom et nom français médiévaux, âge et traits du visage, tirés d'une graine.
// La graine dépend de la partie (G.seed) et du numéro de l'ouvrier : tous les joueurs d'une partie en ligne
// voient le même nom pour le même ouvrier, et une nouvelle partie donne de nouveaux noms.

const MEN = ['Jehan', 'Guillaume', 'Perrin', 'Colin', 'Thibault', 'Gautier', 'Enguerrand', 'Huguet', 'Mathieu', 'Robin', 'Gilles', 'Martin',
  'Étienne', 'Bertrand', 'Regnault', 'Aymeric', 'Josselin', 'Amaury', 'Denis', 'Lambert', 'Arnoul', 'Girard', 'Simon', 'Philippot',
  'Thomas', 'Raoul', 'Geoffroy', 'Hugues', 'Baudouin', 'Odon', 'Foulques', 'Renaud', 'Gervais', 'Anseau', 'Clément', 'Thévenin',
  'Guiot', 'Jacquet', 'Lorin', 'Mahiet', 'Pierre', 'Robert', 'Yvon', 'Bernard', 'Hervé', 'Fouquet'];
const WOMEN = ['Jehanne', 'Perrette', 'Isabeau', 'Marguerite', 'Guillemette', 'Alix', 'Agnès', 'Béatrix', 'Mahaut', 'Ysabel', 'Ermengarde',
  'Colette', 'Aude', 'Marion', 'Péronnelle', 'Héloïse', 'Blanche', 'Clémence', 'Jacquette', 'Thiphaine', 'Alienor', 'Bertille',
  'Gillette', 'Huguette', 'Margot', 'Oudine', 'Sibylle', 'Tiphaine'];
/** noms de métier, surnoms et noms de lieux de Touraine et des bords de Loire */
const LAST = ['Lefèvre', 'Charpentier', 'Boucher', 'Meunier', 'Tixier', 'Fournier', 'Bouvier', 'Berger', 'Chauvin', 'Le Roux', 'Petit',
  'Legrand', 'Morin', 'Rousseau', 'Barbier', 'Delaunay', 'Dubois', 'Duchêne', 'Mercier', 'Pasquier', 'Masson', 'Tonnelier', 'Vigneron',
  'Courtois', 'Le Bègue', 'Hardi', 'Brunet', 'Guérin', 'Renard', 'Gaudin', 'Pelletier', 'Tisserand', 'Sabotier', 'Charron', 'Marchand',
  'Lebrun', 'Fleury', 'Prévost', 'Brisset', 'Cormier', 'Desforges', 'Dumoulin', 'Lavigne', 'Boisseau', 'Hamelin', 'Godard',
  'de Chinon', 'de Loches', "d'Amboise", 'de Langeais', 'de Bourgueil', 'de Vouvray', 'de Montbazon', 'de Saumur', 'de Blois',
  "d'Azay", 'de Candes', 'de Montrichard', "de l'Île-Bouchard", 'du Pont', 'de la Loire', 'du Cher', 'de la Vienne'];

/** générateur pseudo-aléatoire déterministe (mulberry32) */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
function mix(a: number, b: number) { let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x632BE5AB, 0xC2B2AE35); h ^= h >>> 13; h = Math.imul(h, 0x27D4EB2F); return (h ^ (h >>> 16)) >>> 0 }

export interface Identity {
  first: string, last: string, female: boolean, age: number,
  /** traits du visage (indices dans les palettes du portrait) */
  face: { skin: number, hair: number, hairStyle: number, hat: number, beard: number, eyes: number, brows: number, mouth: number, cheeks: boolean, freckles: boolean, nose: number }
}

/** identité d'un ouvrier, stable pour une partie donnée */
export function identityOf(id: number, gameSeed = 0): Identity {
  const r = seeded(mix(gameSeed, id)), pick = <T>(l: T[]) => l[r() * l.length | 0];
  const female = r() < .3, age = 16 + ((r() + r()) / 2 * 40 | 0);
  const first = female ? pick(WOMEN) : pick(MEN), last = pick(LAST);
  const grey = age > 46 && r() < .7;
  return {
    first, last, female, age,
    face: {
      skin: r() * 4 | 0,
      hair: grey ? 5 : r() * 5 | 0,
      hairStyle: r() * 3 | 0,
      // 0 tête nue, 1 chapeau de paille, 2 capuche, 3 bonnet ; les femmes portent souvent une coiffe (4)
      hat: female ? (r() < .55 ? 4 : r() < .5 ? 1 : 0) : [0, 1, 1, 2, 3][r() * 5 | 0],
      // 0 rasé, 1 barbe courte, 2 grande barbe, 3 moustache
      beard: female || age < 18 ? 0 : [0, 0, 1, 1, 2, 3][r() * 6 | 0],
      eyes: r() * 3 | 0, brows: r() * 3 | 0, mouth: r() * 3 | 0, nose: r() * 3 | 0,
      cheeks: r() < .5, freckles: r() < .18,
    },
  };
}

/** métier de l'ouvrier selon son bâtiment */
const JOBS: Record<string, [string, string]> = {
  bucheron: ['Bûcheron', 'Bûcheronne'], carriere: ['Tailleur de pierre', 'Tailleuse de pierre'], ferme: ['Paysan', 'Paysanne'],
  arcs: ['Arcier', 'Arcière'], lances: ['Artisan lancier', 'Artisane lancière'], mine: ['Mineur', 'Mineuse'],
  forge: ['Forgeron', 'Forgeronne'], fleches: ['Flécheur', 'Flécheuse'],
};
export const jobOf = (type: string, female: boolean) => (JOBS[type] || ['Ouvrier', 'Ouvrière'])[female ? 1 : 0];
