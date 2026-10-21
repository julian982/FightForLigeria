// Le tutoriel : sur la carte « Le Jardin de la France », sans adversaire. Chaque étape présente un bâtiment,
// ce qu'il fait et où le poser ; elle se valide dès que le bâtiment est posé. On peut passer le tutoriel
// à tout moment et continuer à bâtir son village librement.
import { DEF, G } from '@ffl/shared';
import { costStr } from './hud';
import { $, ME, ui } from '../state';

type Step = { b?: string, title: string, text: string };
const STEPS: Step[] = [
  { title: 'Bienvenue, seigneur', text: 'Ici, pas d\'ennemi : prends le temps de bâtir ton village. Déplace ton seigneur avec <kbd>Z</kbd> <kbd>Q</kbd> <kbd>S</kbd> <kbd>D</kbd>, zoome à la molette et tourne la caméra en maintenant le clic molette. Chaque bâtiment se choisit avec sa touche (ou en bas de l\'écran), puis se pose d\'un clic dans ta moitié de carte, qui s\'éclaire.' },
  { b: 'reserve', title: 'La réserve', text: 'Elle garde le <b>bois</b>, la <b>pierre</b> et le <b>fer</b>. Ton stock de départ attend dans les charrettes : il n\'arrive qu\'une fois la réserve posée. Pose-la près du donjon, tes ouvriers y feront tous leurs allers-retours.' },
  { b: 'grenier', title: 'Le grenier', text: 'Il garde le <b>blé</b>, qui nourrit tes ouvriers et tes soldats. Sans blé, c\'est la famine : ils ralentissent et s\'affaiblissent.' },
  { b: 'bucheron', title: 'Le bûcheron', text: 'Il coupe les arbres voisins et rapporte <b>3 bois</b> par voyage à la réserve. Pose-le au bord d\'une forêt : le bois sert à presque tout construire. Quand les arbres proches sont tombés, il va plus loin.' },
  { b: 'ferme', title: 'La ferme à blé', text: 'Le paysan fait pousser le blé et porte <b>5 blé</b> par récolte au grenier. Quand ton armée grandit, construis-en une deuxième pour éviter la famine.' },
  { b: 'carriere', title: 'La carrière', text: 'Elle se pose sur le <b>gisement de tuffeau</b>, la pierre blanche de Touraine : les gros rochers blancs, à l\'écart du village. Elle rapporte <b>3 pierre</b> par voyage. Loin du donjon, elle sera une cible en vraie partie : pense à la protéger.' },
  { b: 'armurerie', title: 'L\'armurerie', text: 'Elle range les <b>arcs</b>, les <b>lances</b> et les <b>épées</b> que fabriquent tes artisans. Sans armurerie, les ateliers s\'arrêtent. Si elle est détruite, les armes qu\'elle contient sont perdues.' },
  { b: 'fleches', title: 'L\'atelier de flèches', text: 'Il transforme 2 bois en <b>4 flèches</b> pour ton seigneur. Essaie ton arc : maintiens <kbd>Espace</kbd> pour bander, relâche pour tirer. Plus la charge est longue, plus la flèche va loin et frappe fort.' },
  { b: 'arcs', title: 'L\'atelier d\'arcs', text: 'L\'artisan va chercher 3 bois à la réserve, fabrique un <b>arc</b> et le range à l\'armurerie. Chaque arc permettra de recruter un archer, qui tire de loin.' },
  { b: 'lances', title: 'L\'atelier de lances', text: 'Même principe : 3 bois donnent une <b>lance</b>. Le lancier tient la ligne au contact et protège tes archers.' },
  { b: 'caserne', title: 'La caserne', text: 'Elle transforme chaque arme en soldat : <kbd>R</kbd> pour un archer, <kbd>T</kbd> pour un lancier, <kbd>Y</kbd> pour un spadassin. Quinze soldats au plus. Sélectionne-les à la souris, puis clic droit pour les envoyer.' },
  { b: 'mine', title: 'La mine de fer', text: 'Elle se pose sur l\'unique <b>gisement de fer</b>, au centre de la carte : les rochers sombres veinés de rouille. C\'est le seul bâtiment hors de ta moitié. En vraie partie, l\'ennemi la convoitera aussi.' },
  { b: 'forge', title: 'La forge', text: 'Le forgeron prend 2 fer et 3 bois à la réserve et forge une <b>épée</b>. L\'épée fait le spadassin, ton soldat le plus solide.' },
  { title: 'Ton village est bâti !', text: 'Tu connais tous les bâtiments. Continue à agrandir ton village ici, autant que tu veux, ou retourne au menu pour affronter l\'IA ou tes amis. Un dernier conseil : regarde vers la Loire, des gabarres passent de temps en temps. Le premier qui en touche une d\'une flèche ramasse sa cargaison.' },
];

let step = -1, timer: any = null;
const panel = () => $('tutoPanel');
const built = (type: string) => G && G.buildings.some((o: any) => o.team === ME && o.type === type && !o.dead);
function highlight(type?: string) { for (const b of $('buildBtns').children) b.classList.toggle('tuto-hl', b.dataset.b === type) }

function render() {
  const s = STEPS[step], n = STEPS.length - 2, idx = s.b ? STEPS.indexOf(s) : 0;
  const key = s.b ? DEF[s.b].key : '';
  panel().innerHTML = `<div class="tp-head"><span class="tp-step">${s.b ? `Étape ${idx} sur ${n}` : step === 0 ? 'Tutoriel' : 'Terminé'}</span>
    <button type="button" class="tp-skip" id="tutoSkip">${step === STEPS.length - 1 ? 'Fermer' : 'Passer le tutoriel'}</button></div>
    <h3>${s.title}${key ? ` <kbd>${key}</kbd>` : ''}</h3><p>${s.text}</p>
    ${s.b ? `<p class="tp-cost">Coût : ${costStr(DEF[s.b].cost)} · <span class="tp-todo">à poser</span></p>` : ''}
    ${!s.b ? `<button type="button" class="go tp-go" id="tutoNext">${step === 0 ? 'Commencer' : 'Continuer à bâtir'}</button>` : ''}
    ${s.b ? `<div class="tp-bar"><div style="width:${Math.round((idx - 1) / n * 100)}%"></div></div>` : ''}`;
  highlight(s.b);
  $('tutoSkip').addEventListener('click', stopTutorial);
  const nx = $('tutoNext'); if (nx) nx.addEventListener('click', () => { if (step === STEPS.length - 1) stopTutorial(); else next() });
}
/** passe à la première étape dont le bâtiment n'est pas encore posé (on peut construire dans le désordre) */
function next() {
  step++;
  while (step < STEPS.length - 1 && STEPS[step].b && built(STEPS[step].b!)) step++;
  render();
}
function check() {
  if (!ui.running || step < 0) return;
  const s = STEPS[step];
  if (s.b && built(s.b)) next();
}

export function startTutorial() {
  stopTutorial(); step = 0; panel().hidden = false; render();
  timer = setInterval(check, 300);
}
export function stopTutorial() {
  clearInterval(timer); timer = null; step = -1; highlight(undefined);
  const p = panel(); if (p) { p.hidden = true; p.innerHTML = '' }
}
export const tutorialActive = () => step >= 0;
