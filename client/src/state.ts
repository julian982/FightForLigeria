// État propre au client : ce que voit et fait le joueur local (pas la simulation).

/** l'équipe que contrôle ce client */
export const ME = 0;
export const ui = {
  /** une partie est en cours (pas en pause sur l'accueil, pas finie) */
  running: false,
  /** type de bâtiment en cours de placement */
  placing: null as string | null,
  /** sélection au cadre (coordonnées écran du coin de départ) */
  box: null as null | { sx: number, sy: number },
};
/** caméra et écran */
export const view = { VW: 0, VH: 0, DPR: 1, ppu: 46, camYaw: Math.PI / 4, yawTarget: Math.PI / 4, rotDrag: null as null | { x: number } };
/** soldats sélectionnés */
export const sel = new Set<any>();
export const keys: Record<string, boolean> = {};
export const mouse = { sx: 0, sy: 0, wx: 0, wy: 0, in: false };
export const $ = (id: string): any => document.getElementById(id);
