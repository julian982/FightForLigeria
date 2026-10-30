// Le blason des comptes : dessin en SVG et éditeur (forme, émaux, partition, meuble).
import { BL_SHAPES, BL_TINCTURES, BL_DIVS, BL_CHARGES, cleanBlason, randomBlason, FRAME_METALS, frameName, type Blason, type Frame } from '@ffl/shared';

const COL: Record<string, string> = Object.fromEntries(BL_TINCTURES.map(([id, , c]) => [id, c]));
const INK = '#1b1610';
export const SHAPE_PATH: Record<string, string> = {
  ecu: 'M6 6 H94 V56 C94 88 72 106 50 116 C28 106 6 88 6 56 Z',
  francais: 'M6 6 H94 V90 Q94 104 80 104 H62 Q54 104 50 116 Q46 104 38 104 H20 Q6 104 6 90 Z',
  rond: 'M4 60 A46 46 0 1 0 96 60 A46 46 0 1 0 4 60 Z',
  losange: 'M50 4 L95 60 L50 116 L5 60 Z',
  banniere: 'M10 6 H90 V112 L50 94 L10 112 Z',
};
/** la partie du champ peinte avec le second émail */
const DIV_SHAPE: Record<string, string> = {
  plein: '',
  parti: '<rect x="50" y="0" width="50" height="120"/>',
  coupe: '<rect x="0" y="60" width="100" height="60"/>',
  tranche: '<polygon points="0,0 100,120 0,120"/>',
  ecartele: '<rect x="50" y="0" width="50" height="60"/><rect x="0" y="60" width="50" height="60"/>',
  fasce: '<rect x="0" y="45" width="100" height="28"/>',
  pal: '<rect x="37" y="0" width="26" height="120"/>',
  chevron: '<polygon points="0,98 50,48 100,98 100,124 50,74 0,124"/>',
};
const star = (cx: number, cy: number, R: number, r: number) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; return (cx + Math.cos(a) * d).toFixed(1) + ',' + (cy + Math.sin(a) * d).toFixed(1);
}).join(' ');
/** les meubles, dessinés autour du centre de l'écu (50, 58) ; `c` = émail du meuble, `h` = trous et détails */
const CHARGE: Record<string, (c: string, h: string) => string> = {
  aucun: () => '',
  lys: c => `<g fill="${c}"><path d="M50 22 C43 31 41 42 45 52 L50 63 L55 52 C59 42 57 31 50 22Z"/>
    <path d="M45 58 C40 47 30 44 25 50 C20 57 27 65 34 61 C30 59 30 54 34 54 C38 54 42 58 44 63Z"/>
    <path d="M55 58 C60 47 70 44 75 50 C80 57 73 65 66 61 C70 59 70 54 66 54 C62 54 58 58 56 63Z"/>
    <rect x="35" y="61" width="30" height="6" rx="2"/><path d="M45 67 L50 82 L55 67Z"/></g>`,
  tour: (c, h) => `<g fill="${c}"><rect x="34" y="34" width="8" height="10"/><rect x="46" y="34" width="8" height="10"/><rect x="58" y="34" width="8" height="10"/>
    <rect x="36" y="42" width="28" height="38"/><rect x="31" y="78" width="38" height="7" rx="1"/></g>
    <path d="M45 80 V71 A5 5 0 0 1 55 71 V80Z" fill="${h}"/><rect x="47.5" y="52" width="5" height="8" rx="2.5" fill="${h}"/>`,
  etoile: c => `<polygon points="${star(50, 58, 25, 10)}" fill="${c}"/>`,
  croix: c => `<path d="M43 30 H57 V51 H78 V65 H57 V88 H43 V65 H22 V51 H43 Z" fill="${c}"/>`,
  epee: (c, h) => `<g fill="${c}"><polygon points="46.5,40 53.5,40 53.5,80 50,90 46.5,80"/><rect x="34" y="35" width="32" height="6" rx="2"/>
    <rect x="47.5" y="23" width="5" height="13"/><circle cx="50" cy="21" r="4.5"/></g><path d="M50 42 V80" stroke="${h}" stroke-width="1.2" opacity=".55"/>`,
  couronne: (c, h) => `<g fill="${c}"><path d="M27 74 L23 42 L38 55 L50 33 L62 55 L77 42 L73 74 Z"/><rect x="26" y="72" width="48" height="9" rx="2"/>
    <circle cx="23" cy="40" r="3.5"/><circle cx="50" cy="31" r="3.5"/><circle cx="77" cy="40" r="3.5"/></g>
    <g fill="${h}"><circle cx="38" cy="76.5" r="2"/><circle cx="50" cy="76.5" r="2"/><circle cx="62" cy="76.5" r="2"/></g>`,
  grappe: c => `<g fill="${c}">${[[38, 52], [46, 52], [54, 52], [62, 52], [42, 61], [50, 61], [58, 61], [46, 70], [54, 70], [50, 79]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join('')}
    <path d="M51 46 C54 34 66 30 72 36 C66 39 59 41 53 47Z"/><path d="M49 47 C48 41 46 37 43 34" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g>`,
  cle: (c, h) => `<g fill="${c}"><circle cx="50" cy="34" r="10"/><rect x="47" y="42" width="6" height="42"/><rect x="53" y="70" width="9" height="5"/><rect x="53" y="78" width="7" height="5"/></g>
    <circle cx="50" cy="34" r="4.5" fill="${h}"/>`,
};

let uid = 0;
/**
 * le blason complet en SVG (viewBox 100 × 120). Avec un cadre de saison (frame), il est entouré d'un liseré du métal
 * gagné (bois, pierre, fer, argent, or, rubis) et porte un ruban « S1 » en pointe : le dessin s'élargit un peu.
 */
export function blasonSvg(b: Partial<Blason> | null | undefined, opts: { cls?: string, title?: string, frame?: Frame | null } = {}) {
  const bl = cleanBlason(b), id = 'bl' + (uid++), shape = SHAPE_PATH[bl.s];
  const f = COL[bl.f], t = COL[bl.t], k = COL[bl.k];
  // les détails du meuble (portes, trous) prennent l'émail du champ s'il contraste, sinon une encre sombre
  const hole = bl.k === bl.f ? INK : f;
  const fr = opts.frame && FRAME_METALS[opts.frame.metal] ? opts.frame : null, mt = fr ? FRAME_METALS[fr.metal] : null;
  const title = fr ? `${opts.title ? opts.title + ' · ' : ''}cadre ${frameName(fr)}` : opts.title;
  const label = title ? `role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  // liseré du métal sous le contour, puis ruban « S1 » en pointe
  const rim = mt ? `<path d="${shape}" fill="none" stroke="url(#${id}m)" stroke-width="11" stroke-linejoin="round"/>` : '';
  const ribbon = mt ? `<g><path d="M30 111 H70 L66 118 L70 125 H30 L34 118 Z" fill="url(#${id}m)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <text x="50" y="121.6" text-anchor="middle" font-family="'Alegreya Sans',sans-serif" font-weight="800" font-size="10" fill="${fr!.metal === 3 || fr!.metal === 4 ? INK : '#fff8e8'}">S${fr!.season}</text></g>` : '';
  return `<svg class="blason ${fr ? 'framed' : ''} ${opts.cls || ''}" viewBox="${fr ? '-7 -7 114 135' : '0 0 100 120'}" ${label}>
    <defs><clipPath id="${id}c"><path d="${shape}"/></clipPath>
      ${mt ? `<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mt.light}"/><stop offset=".5" stop-color="${mt.dark}"/><stop offset="1" stop-color="${mt.light}"/></linearGradient>` : ''}
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
    <g clip-path="url(#${id}c)"><rect width="100" height="120" fill="${f}"/>${DIV_SHAPE[bl.d] ? `<g fill="${t}">${DIV_SHAPE[bl.d]}</g>` : ''}
      <g stroke="${INK}" stroke-width="1.4" stroke-linejoin="round">${CHARGE[bl.c](k, hole)}</g>
      <rect width="100" height="120" fill="url(#${id}g)"/></g>
    ${rim}<path d="${shape}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="${shape}" fill="none" stroke="#d9a441" stroke-width="1.2" stroke-linejoin="round" opacity=".55" transform="translate(50 60) scale(.9) translate(-50 -60)"/>${ribbon}</svg>`;
}

/** l'éditeur de blason : aperçu et réglages. Renvoie de quoi lire et changer le blason. */
export function blasonEditor(box: HTMLElement, initial?: Partial<Blason> | null, onChange?: (b: Blason) => void) {
  let bl: Blason = initial ? cleanBlason(initial) : randomBlason();
  const opt = (group: string, id: string, label: string, inner: string) =>
    `<button type="button" class="be-opt" data-g="${group}" data-v="${id}" aria-pressed="false" title="${label}" aria-label="${label}">${inner}</button>`;
  const mini = (p: Partial<Blason>) => blasonSvg({ ...bl, ...p });
  const sw = (group: string) => BL_TINCTURES.map(([id, n, c]) => `<button type="button" class="be-sw" data-g="${group}" data-v="${id}" aria-pressed="false" title="${n}" aria-label="${n}" style="background:${c}"></button>`).join('');
  box.classList.add('be');
  function build() {
    box.innerHTML = `<div class="be-prev">${blasonSvg(bl, { title: 'Aperçu de ton blason' })}<button type="button" class="linkbtn be-rnd">Au hasard</button></div>
      <div class="be-ctl">
        <div class="be-row"><span class="lbl">Forme</span><div class="be-opts">${BL_SHAPES.map(([id, n]) => opt('s', id, n, mini({ s: id, d: 'plein', c: 'aucun' }))).join('')}</div></div>
        <div class="be-row"><span class="lbl">Couleur du champ</span><div class="be-sws">${sw('f')}</div></div>
        <div class="be-row"><span class="lbl">Partition</span><div class="be-opts">${BL_DIVS.map(([id, n]) => opt('d', id, n, mini({ d: id, c: 'aucun' }))).join('')}</div></div>
        <div class="be-row" data-need-div><span class="lbl">Couleur de la partition</span><div class="be-sws">${sw('t')}</div></div>
        <div class="be-row"><span class="lbl">Meuble</span><div class="be-opts">${BL_CHARGES.map(([id, n]) => opt('c', id, n, mini({ c: id, d: 'plein' }))).join('')}</div></div>
        <div class="be-row" data-need-charge><span class="lbl">Couleur du meuble</span><div class="be-sws">${sw('k')}</div></div>
      </div>`;
    sync();
  }
  function sync() {
    box.querySelector('.be-prev svg')!.outerHTML = blasonSvg(bl, { title: 'Aperçu de ton blason' });
    for (const b of Array.from(box.querySelectorAll<HTMLElement>('[data-g]'))) b.setAttribute('aria-pressed', String((bl as any)[b.dataset.g!] === b.dataset.v));
    (box.querySelector('[data-need-div]') as HTMLElement).hidden = bl.d === 'plein';
    (box.querySelector('[data-need-charge]') as HTMLElement).hidden = bl.c === 'aucun';
  }
  /** les vignettes des formes, partitions et meubles reprennent les couleurs choisies */
  function refreshMinis() {
    for (const b of Array.from(box.querySelectorAll<HTMLElement>('.be-opt'))) {
      const g = b.dataset.g!, v = b.dataset.v!;
      b.innerHTML = mini(g === 's' ? { s: v, d: 'plein', c: 'aucun' } : g === 'd' ? { d: v, c: 'aucun' } : { c: v, d: 'plein' });
    }
  }
  box.addEventListener('click', e => {
    const t = (e.target as HTMLElement).closest('button'); if (!t || !box.contains(t)) return;
    if (t.classList.contains('be-rnd')) { bl = randomBlason(); refreshMinis(); sync(); onChange?.(bl); return }
    const g = t.dataset.g, v = t.dataset.v; if (!g || !v) return;
    bl = { ...bl, [g]: v }; refreshMinis(); sync(); onChange?.(bl);
  });
  build();
  return { get: () => bl, set(b: Partial<Blason> | null) { bl = cleanBlason(b); refreshMinis(); sync() } };
}
