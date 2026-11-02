// Règles du jeu : toutes les valeurs d'équilibrage, partagées par le client et (plus tard) le serveur.

// une carte 1v1 fait 83 × 46 cases (agrandie de 15 % : elle faisait 72 × 40) ; les cases, les unités et les bâtiments
// gardent leur taille, la carte est simplement plus vaste. En 2v2, elle est deux fois plus haute (83 × 92) :
// chaque camp a deux châteaux l'un au-dessus de l'autre.
/** agrandissement des cartes par rapport à leur dessin d'origine (2880 × 1600 px) */
export const MAP_SCALE = 1.15;
export const T = 40, GW = 83, W = GW * T, TERR = 520, S = 1 / T;
/** hauteur d'une « rangée » de la carte (une carte 1v1), et hauteur maximale (2v2) */
export const GH1 = 46, GH_MAX = GH1 * 2, H1 = GH1 * T;
/** dimensions de la carte chargée (liaisons vivantes : mises à jour par setLayout) */
export let GH = GH1, H = GH * T;

export const DEF: Record<string, any> = {
  keep:    {name:'Donjon',w:3,h:3,hp:1500},
  reserve: {name:'Réserve',w:2,h:2,cost:{},hp:300,store:'goods'},
  grenier: {name:'Grenier',w:2,h:2,cost:{},hp:250,store:'food'},
  armurerie:{name:'Armurerie',w:2,h:2,cost:{bois:5},hp:300,store:'arms'},
  bucheron:{name:'Bûcheron',w:2,h:2,cost:{bois:6},hp:180,key:1,work:3,out:['bois',3]},
  carriere:{name:'Carrière',w:2,h:2,cost:{bois:12},hp:220,key:2,work:5,out:['pierre',3]},
  ferme:   {name:'Ferme à blé',w:3,h:3,cost:{bois:15},hp:160,key:3,work:9,out:['ble',5]},
  arcs:    {name:"Atelier d'arcs",w:2,h:2,cost:{bois:15,pierre:8},hp:220,key:4,work:18,out:['arc',1],input:{bois:3}},
  lances:  {name:'Atelier de lances',w:2,h:2,cost:{bois:15,pierre:8},hp:220,key:5,work:18,out:['lance',1],input:{bois:3}},
  caserne: {name:'Caserne',w:3,h:2,cost:{bois:15,pierre:23},hp:450,key:6},
  mine:    {name:'Mine de fer',w:2,h:2,cost:{bois:30,pierre:15},hp:300,key:7,work:12,out:['fer',1]},
  forge:   {name:'Forge',w:2,h:2,cost:{bois:20,pierre:20},hp:260,key:8,work:30,out:['epee',1],input:{fer:2,bois:3}},
  fleches: {name:'Atelier de flèches',w:2,h:2,cost:{bois:12},hp:180,key:9,work:10,out:['fleche',4],input:{bois:2}},
  // ---- défenses (onglet « Défenses ») : def = rôle, mat = matériau. Seuls lanciers et spadassins les abîment. ----
  mur_b:   {name:'Mur en bois',w:1,h:1,cost:{bois:3},hp:250,def:'mur',mat:'bois'},
  mur_p:   {name:'Mur en pierre',w:1,h:1,cost:{pierre:4,bois:1},hp:700,def:'mur',mat:'pierre'},
  porte_b: {name:'Porte en bois',w:1,h:1,cost:{bois:12},hp:400,def:'porte',mat:'bois'},
  porte_p: {name:'Porte en pierre',w:1,h:1,cost:{pierre:15,bois:5},hp:900,def:'porte',mat:'pierre'},
  escalier:{name:'Escalier',w:1,h:1,cost:{bois:8},hp:200,def:'escalier',mat:'bois'},
  tour_b:  {name:'Tour en bois',w:2,h:2,cost:{bois:60},hp:800,def:'tour',mat:'bois'},
  tour_p:  {name:'Tour en pierre',w:2,h:2,cost:{pierre:70,bois:30},hp:1800,def:'tour',mat:'pierre'},
};
export const ARMY_MAX = 30;
/** temps de construction de chaque bâtiment (secondes de travail de l'ouvrier, une fois arrivé sur le chantier).
 *  La réserve et le grenier n'en ont pas : ils sont posés tout de suite, pour que le stock de départ arrive aussitôt. */
export const BUILD_T: Record<string, number> = { mur_b: 3, mur_p: 5, porte_b: 6, porte_p: 8, escalier: 4, tour_b: 20, tour_p: 30, armurerie: 8, bucheron: 8, fleches: 8, carriere: 10, ferme: 10, arcs: 12, lances: 12, mine: 14, caserne: 16, forge: 16 };
export const BUILD_LIST = ['reserve','grenier','bucheron','carriere','ferme','fleches','arcs','lances','caserne','mine','forge','armurerie'];
export const BUILD_KEYS = ['1','2','3','4','5','6','7','8','9','0',')','='];
BUILD_LIST.forEach((t, i) => DEF[t].key = BUILD_KEYS[i]);
/** l'onglet « Défenses » : mêmes touches 1 à 7 quand il est ouvert */
export const DEFENSE_LIST = ['mur_b','mur_p','porte_b','porte_p','escalier','tour_b','tour_p'];
DEFENSE_LIST.forEach((t, i) => DEF[t].key = String(i + 1));
/** tours par joueur (bois et pierre confondus), soldats au plus sur une tour, longueur d'un mur tracé d'un coup */
export const TOWER_MAX = 4, TOWER_CAP = 4, WALL_MAX = 24;
/** le bâtisseur (un seul par joueur, il construit toutes les défenses) revient 40 s après sa mort */
export const MASON_RESPAWN = 40;
/** sur un mur ou une tour : portée des archers (et du seigneur) allongée, flèches ennemies arrêtées par les créneaux,
 *  dégâts réduits pour celles qui passent ; chute quand le mur s'effondre (part de la vie) */
export const UP_RANGE: Record<string, number> = { mur: 1.15, porte: 1.15, escalier: 1, tour: 1.35 };
export const UP_MISS: Record<string, number> = { mur: .35, porte: .35, escalier: 0, tour: .5 };
export const COVER_DMG = .75, FALL_DMG = .15;
/** hauteur du chemin de ronde (unités 3D) : là où se tiennent les soldats montés */
export const TOP_H: Record<string, number> = { mur_b: 1.43, mur_p: 1.58, porte_b: 1.43, porte_p: 1.58, escalier: 1.43, tour_b: 2.63, tour_p: 3.0 };
// stockage : le blé va au grenier, bois/pierre/fer à la réserve, les armes à l'armurerie, les flèches (celles du seigneur) au donjon
export const STORE_OF: Record<string, string> = {ble:'grenier',bois:'reserve',pierre:'reserve',fer:'reserve',arc:'armurerie',lance:'armurerie',epee:'armurerie'};
/** article pour les messages : « une réserve », « un grenier », « une armurerie » */
export const STORE_ART: Record<string, string> = {reserve:'une réserve',grenier:'un grenier',armurerie:'une armurerie'};
/** dégâts d'une flèche de seigneur sur un autre seigneur (part des dégâts normaux) */
export const LORD_VS_LORD = .75;
export const START_ARROWS = 8;
export const START_RES = {bois:30,pierre:10,ble:20,fer:0,arc:0,lance:0,epee:0,fleche:START_ARROWS};
export const RICH_RES = {bois:120,pierre:60,ble:90,fleche:16};
export const UT: Record<string, any> = {
  lord:{hp:300,speed:125,r:13},
  // portée 346 (240, puis +20 % deux fois) ; ils repèrent l'ennemi d'un peu plus loin encore
  archer:{hp:55,speed:78,r:9,range:346,dmg:9,cd:1.5,aggro:418},
  lancier:{hp:120,speed:88,r:10,range:16,dmg:13,cd:1.0,aggro:250},
  spadassin:{hp:420,speed:80,r:11,range:18,dmg:34,cd:.9,aggro:260},
};
export const RESN: Record<string, string> = {bois:'bois',pierre:'pierre',ble:'blé',fer:'fer',arc:'arc',lance:'lance',epee:'épée',fleche:'flèche'};
export const NEED: Record<string, string> = {archer:'arc',lancier:'lance',spadassin:'epee'};
export const AI_ORDER = ['reserve','grenier','bucheron','ferme','bucheron','fleches','carriere','bucheron','armurerie','carriere','arcs','lances','caserne','ferme','bucheron','mine','forge'];
// ---- disposition des joueurs et des gisements (1v1 : une rangée, 2v2 : deux rangées) ----
// Joueurs : 0 et 2 à gauche (camp 0), 1 et 3 à droite (camp 1). En 2v2, 0 et 1 en haut, 2 et 3 en bas.
export type Mode = '1v1' | '2v2';
export let MODE: Mode = '1v1';
/** nombre de joueurs de la disposition chargée */
export let PLAYERS = 2;
/** case du donjon de chaque joueur */
export let KEEPS: { tx: number, ty: number }[] = [];
/** gisements de pierre (un par joueur, dans sa moitié, à distance du donjon) */
export let STONES: any[] = [];
/** gisements de fer : un au centre de chaque rangée, à égale distance des deux camps */
export let IRONS: any[] = [];
export let ROCKS: any[] = [];
/** camp d'un joueur : 0 = gauche, 1 = droite */
export const sideOf = (p: number) => p & 1;
/** deux joueurs sont-ils ennemis ? (les alliés ne se font jamais de dégâts) */
export const isFoe = (a: number, b: number) => ((a ^ b) & 1) === 1;
/** un rectangle (en px) est-il entièrement dans la moitié de carte du camp de ce joueur ? (gauche pour le camp 0, droite pour le camp 1) */
export const inHalf = (p: number, x: number, w: number) => sideOf(p) === 0 ? x + w <= W / 2 : x >= W / 2;
/** installe la disposition d'un mode de jeu (à appeler avant de générer la carte) */
export function setLayout(mode: Mode) {
  MODE = mode === '2v2' ? '2v2' : '1v1';
  const rows = MODE === '2v2' ? 2 : 1;
  GH = GH1 * rows; H = GH * T; PLAYERS = rows * 2;
  KEEPS = []; STONES = []; IRONS = [];
  for (let r = 0; r < rows; r++) {
    const off = r * H1;
    // positions d'origine × MAP_SCALE ; le donjon de droite est le miroir exact de celui de gauche (3 cases de large)
    const ktx = Math.round(6 * MAP_SCALE), kty = Math.round(18 * MAP_SCALE);
    KEEPS.push({ tx: ktx, ty: kty + r * GH1 }, { tx: GW - ktx - 3, ty: kty + r * GH1 });
    // à bonne distance du donjon : le village s'étire et la carrière est à défendre
    const sx = Math.round(780 * MAP_SCALE), sy = Math.round(1080 * MAP_SCALE);
    STONES.push({ x: sx, y: sy + off, r: 80 }, { x: W - sx, y: sy + off, r: 80 });
    IRONS.push({ x: W / 2, y: Math.round(840 * MAP_SCALE) + off, r: 75, iron: true });
  }
  ROCKS = [...STONES, ...IRONS];
}
setLayout('1v1');
export const RIVER = {river:true};
export const BRIDGE_Y = .17;
export const RESPAWN = 20;
/** trêve du début de partie (secondes réelles) : pas de tir ni de dégâts entre ennemis, et personne ne franchit le milieu */
export const TRUCE = 20;
export const TREE_R = 11;
/** temps de charge complet de l'arc du seigneur, en secondes */
export const CHARGE_T = 1.1;
/** les archers de l'IA tirent de plus loin (portée et détection multipliées) */
export const AI_ARCHER_RANGE = 1.4;
