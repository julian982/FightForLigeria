// L'état de la partie. La simulation n'affiche rien : elle prévient le client par des « hooks ».

/** état complet de la partie en cours (liaison vivante) */
export let G: any = null;
/** arbres encore debout (liaison vivante) */
export let trees: any[] = [];
export function setG(g: any) { G = g }
export function setTrees(t: any[]) { trees = t }

export interface Hooks {
  /** une entité (unité, ouvrier, bâtiment, flèche, arbre, effet) quitte la partie */
  removed(e: any): void;
  /** message destiné à l'équipe `team` */
  notify(team: number, msg: string, kind?: string): void;
  /** la partie est finie : `winner` est l'équipe gagnante */
  end(winner: number): void;
  /** une nouvelle partie démarre */
  reset(): void;
}
const noop = () => {};
export const hooks: Hooks = { removed: noop, notify: noop, end: noop, reset: noop };
export function setHooks(h: Partial<Hooks>) { Object.assign(hooks, h) }
