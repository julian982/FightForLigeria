// Nettoyage de ce que les joueurs envoient (pseudos, noms, messages) : partagé par les salons et les comptes.
// caractères de contrôle et d'écriture invisible (retours à la ligne, inversions de sens, espaces de largeur nulle)
export const CTRL = new RegExp('[' + [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069]].map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']', 'g');
/** pseudo : 3 à 16 lettres, chiffres, espaces, tirets ou soulignés */
export function cleanPseudo(v: unknown): string {
  const s = String(v ?? '').replace(CTRL, '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s.length >= 3 ? s : '';
}
export function cleanName(v: unknown, fallback: string): string {
  const s = String(v ?? '').replace(CTRL, '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return s || fallback;
}
export function cleanChat(v: unknown): string { return String(v ?? '').replace(CTRL, '').replace(/\s+/g, ' ').trim().slice(0, 200) }
