export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const dist = (a: number, b: number, c: number, d: number) => Math.hypot(c - a, d - b);
export const dE = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** générateur pseudo-aléatoire déterministe (mulberry32) */
export function rng(s: number) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
export function rectDist(px, py, b) { const dx = Math.max(b.bx - px, 0, px - (b.bx + b.bw)), dy = Math.max(b.by - py, 0, py - (b.by + b.bh)); return Math.hypot(dx, dy) }
export function rectClamp(px, py, b) { return { x: Math.max(b.bx, Math.min(px, b.bx + b.bw)), y: Math.max(b.by, Math.min(py, b.by + b.bh)) } }
export function inRect(x, y, q) { return x > q.bx && x < q.bx + q.bw && y > q.by && y < q.by + q.bh }
