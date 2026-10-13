// Portrait d'un ouvrier en SVG (style plat, comme les maquettes du jeu), à partir de ses traits (shared/src/names.ts).
import type { Identity } from '@ffl/shared';

const SKIN = [['#f1cfa8', '#d9ac82'], ['#e0b48a', '#c4926a'], ['#c08a5e', '#9c6b44'], ['#8d5f3c', '#6f4628']];
const HAIR = ['#3a2516', '#5b3a1e', '#1f1712', '#8a4a1e', '#c9a25a', '#b9b3a8'];
const HOOD = ['#6b4a2c', '#4f5b34', '#7a3a2a'];

/** portrait carré (viewBox 64 × 64). `team` : couleur du royaume (foulard et fond). */
export function portraitSvg(idn: Identity, team: string, size = 64) {
  const f = idn.face, [sk, skD] = SKIN[f.skin], hc = HAIR[f.hair], fem = idn.female;
  const hood = HOOD[(f.hairStyle + f.eyes) % HOOD.length], old = idn.age > 44;
  const p: string[] = [];
  // fond : écusson sombre teinté de la couleur du royaume
  p.push(`<rect width="64" height="64" rx="6" fill="#241c15"/><circle cx="32" cy="30" r="27" fill="${team}" opacity=".28"/>`);
  // cheveux longs derrière la tête (femmes sans coiffe, ou un homme sur trois)
  const long = (fem && f.hat !== 4) || (!fem && f.hairStyle === 2 && f.hat === 0);
  if (long) p.push(`<path d="M15 30 C14 46 18 54 24 56 L40 56 C46 54 50 46 49 30 Z" fill="${hc}"/>`);
  // capuche : le pan arrière passe derrière les épaules
  if (f.hat === 2) p.push(`<path d="M12 60 C10 34 18 12 32 11 C46 12 54 34 52 60 Z" fill="${hood}"/>`);
  // épaules et tunique de toile, foulard aux couleurs du royaume
  p.push(`<path d="M8 64 C9 52 17 47 26 46 L38 46 C47 47 55 52 56 64 Z" fill="#b79a6a"/>`,
    `<path d="M26 46 L32 53 L38 46 L35 45 L32 48 L29 45 Z" fill="${team}"/><path d="M22 47 C26 51 38 51 42 47" stroke="${team}" stroke-width="3" fill="none"/>`,
    `<rect x="27" y="38" width="10" height="10" rx="3" fill="${skD}"/>`);
  // oreilles et tête
  p.push(`<ellipse cx="17.5" cy="31" rx="3" ry="4.5" fill="${skD}"/><ellipse cx="46.5" cy="31" rx="3" ry="4.5" fill="${skD}"/>`,
    `<ellipse cx="32" cy="30" rx="14.5" ry="17" fill="${sk}"/>`);
  if (old) p.push(`<path d="M22 22 Q25 21 27 22 M37 22 Q39 21 42 22" stroke="${skD}" stroke-width=".8" fill="none"/><path d="M21 37 Q22 39 23 40 M43 37 Q42 39 41 40" stroke="${skD}" stroke-width=".9" fill="none"/>`);
  if (f.cheeks) p.push(`<circle cx="23" cy="36" r="3.2" fill="#e07a6a" opacity=".28"/><circle cx="41" cy="36" r="3.2" fill="#e07a6a" opacity=".28"/>`);
  if (f.freckles) p.push(`<g fill="${skD}" opacity=".8">${[[23, 33], [25.5, 34.5], [22, 35.5], [41, 33], [38.5, 34.5], [42, 35.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7"/>`).join('')}</g>`);
  // yeux, sourcils, nez, bouche
  const ey = 30, eo = 6.5, eye = f.eyes === 0 ? (x: number) => `<circle cx="${x}" cy="${ey}" r="1.6" fill="#2a1d14"/>`
    : f.eyes === 1 ? (x: number) => `<ellipse cx="${x}" cy="${ey}" rx="2.3" ry="1.5" fill="#fbf5ea"/><circle cx="${x}" cy="${ey}" r="1.3" fill="#3b2a1c"/>`
    : (x: number) => `<path d="M${x - 2.2} ${ey} Q${x} ${ey - 1.8} ${x + 2.2} ${ey}" stroke="#2a1d14" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  p.push(eye(32 - eo), eye(32 + eo));
  const bt = f.brows === 0 ? 1.4 : f.brows === 1 ? 2.2 : 1.6, bl = f.brows === 2 ? -1.2 : 0, bc = f.hair === 5 ? '#8e877c' : hc;
  p.push(`<path d="M${22} ${25.5 + bl} L${29} ${25 - bl}" stroke="${bc}" stroke-width="${bt}" stroke-linecap="round"/><path d="M${35} ${25 - bl} L${42} ${25.5 + bl}" stroke="${bc}" stroke-width="${bt}" stroke-linecap="round"/>`);
  p.push(f.nose === 0 ? `<path d="M32 30 L30 37 L33 37.5" stroke="${skD}" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`
    : f.nose === 1 ? `<ellipse cx="32" cy="36" rx="2.6" ry="2" fill="${skD}"/>`
    : `<path d="M31 29 Q35 34 33 38 L30 37.5" stroke="${skD}" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`);
  const my = 41.5;
  p.push(f.mouth === 0 ? `<path d="M28 ${my} Q32 ${my + 2.6} 36 ${my}" stroke="#7a3b2c" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
    : f.mouth === 1 ? `<path d="M28.5 ${my + .5} L35.5 ${my + .5}" stroke="#7a3b2c" stroke-width="1.4" stroke-linecap="round"/>`
    : `<path d="M28 ${my - .5} Q32 ${my + 3.5} 36 ${my - .5} Z" fill="#7a3b2c"/><path d="M29 ${my} L35 ${my}" stroke="#fbf5ea" stroke-width="1"/>`);
  // barbe et moustache
  if (f.beard === 1) p.push(`<path d="M18.5 33 C19 45 25 48 32 48 C39 48 45 45 45.5 33 C43 40 40 43.5 32 44 C24 43.5 21 40 18.5 33 Z" fill="${hc}" opacity=".9"/><path d="M27 39.5 Q32 37.5 37 39.5" stroke="${hc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  if (f.beard === 2) p.push(`<path d="M18 32 C18 50 25 56 32 56 C39 56 46 50 46 32 C44 40 40 43 32 43.5 C24 43 20 40 18 32 Z" fill="${hc}"/><path d="M26.5 39.5 Q32 37 37.5 39.5" stroke="${hc}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M29 ${my + .3} Q32 ${my + 1.8} 35 ${my + .3}" stroke="#5a2c20" stroke-width="1.2" fill="none"/>`);
  if (f.beard === 3) p.push(`<path d="M25.5 40.5 Q28 37.5 32 39 Q36 37.5 38.5 40.5 Q35 39.8 32 40.6 Q29 39.8 25.5 40.5 Z" fill="${hc}" stroke="${hc}" stroke-width="1.2" stroke-linejoin="round"/>`);
  // cheveux et coiffures
  if (f.hat === 4) {
    // coiffe de lin
    p.push(`<path d="M15.5 34 C14 18 22 11 32 11 C42 11 50 18 48.5 34 C46 26 42 20 32 20 C22 20 18 26 15.5 34 Z" fill="#efe7d6"/><path d="M17 28 C22 23 42 23 47 28" stroke="#d8ccb4" stroke-width="1.2" fill="none"/>`);
  } else if (f.hat === 2) {
    // capuche (chaperon) autour du visage
    p.push(`<path d="M14 40 C12 20 21 9 32 9 C43 9 52 20 50 40 C48 28 43 19 32 19 C21 19 16 28 14 40 Z" fill="${hood}"/><path d="M15 38 C15 26 22 18.5 32 18.5 C42 18.5 49 26 49 38" stroke="rgba(0,0,0,.25)" stroke-width="1.5" fill="none"/>`);
  } else {
    // cheveux (sous le chapeau éventuel)
    if (f.hairStyle === 0) p.push(`<path d="M17 28 C16 15 24 11 32 11 C40 11 48 15 47 28 C45 22 43 20 41 20 L23 20 C21 20 19 22 17 28 Z" fill="${hc}"/>`); // coupe au bol
    else if (f.hairStyle === 1) p.push(`<path d="M17 27 C15 14 25 10 33 11 C42 11 49 16 47 27 C46 22 44 19 40 21 C37 18 34 21 31 19 C28 21 25 18 22 21 C20 20 18 23 17 27 Z" fill="${hc}"/>`); // en bataille
    else p.push(`<path d="M17 30 C15 15 24 11 32 11 C40 11 49 15 47 30 C46 21 41 17 32 17 C23 17 18 21 17 30 Z" fill="${hc}"/>`); // raie au milieu
    if (f.hat === 1) p.push(`<ellipse cx="32" cy="17.5" rx="23" ry="5" fill="#d9b765"/><path d="M21 17.5 C21 7 43 7 43 17.5 Z" fill="#e6c87a"/><path d="M21.5 15.5 C26 17 38 17 42.5 15.5" stroke="${team}" stroke-width="2.4" fill="none"/><path d="M12 18.5 C20 21 44 21 52 18.5" stroke="#b8963f" stroke-width="1" fill="none"/>`);
    if (f.hat === 3) p.push(`<path d="M17 21 C17 9 47 9 47 21 C40 18.5 24 18.5 17 21 Z" fill="${hood}"/><path d="M17 21 C24 18.5 40 18.5 47 21 L47 23 C40 20.5 24 20.5 17 23 Z" fill="rgba(0,0,0,.25)"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${p.join('')}</svg>`;
}
