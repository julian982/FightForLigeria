// Règles du jeu : toutes les valeurs d'équilibrage, partagées par le client et (plus tard) le serveur.

export const T = 40, GW = 60, GH = 40, W = GW * T, H = GH * T, TERR = 520, S = 1 / T;

export const DEF: Record<string, any> = {
  keep:    {name:'Donjon',w:3,h:3,hp:1500},
  reserve: {name:'Réserve',w:2,h:2,cost:{},hp:300,store:'goods'},
  grenier: {name:'Grenier',w:2,h:2,cost:{},hp:250,store:'food'},
  bucheron:{name:'Bûcheron',w:2,h:2,cost:{bois:6},hp:180,key:1,work:3,out:['bois',3]},
  carriere:{name:'Carrière',w:2,h:2,cost:{bois:12},hp:220,key:2,work:5,out:['pierre',2]},
  ferme:   {name:'Ferme à blé',w:3,h:3,cost:{bois:15},hp:160,key:3,work:9,out:['ble',5]},
  arcs:    {name:"Atelier d'arcs",w:2,h:2,cost:{bois:15,pierre:8},hp:220,key:4,work:18,out:['arc',1],input:{bois:3}},
  lances:  {name:'Atelier de lances',w:2,h:2,cost:{bois:15,pierre:8},hp:220,key:5,work:18,out:['lance',1],input:{bois:3}},
  caserne: {name:'Caserne',w:3,h:2,cost:{bois:15,pierre:23},hp:450,key:6},
  mine:    {name:'Mine de fer',w:2,h:2,cost:{bois:30,pierre:15},hp:300,key:7,work:12,out:['fer',1]},
  forge:   {name:'Forge',w:2,h:2,cost:{bois:20,pierre:20},hp:260,key:8,work:30,out:['epee',1],input:{fer:2,bois:3}},
  fleches: {name:'Atelier de flèches',w:2,h:2,cost:{bois:12},hp:180,key:9,work:10,out:['fleche',4],input:{bois:2}},
};
export const ARMY_MAX = 15;
export const BUILD_LIST = ['reserve','grenier','bucheron','carriere','ferme','fleches','arcs','lances','caserne','mine','forge'];
export const BUILD_KEYS = ['1','2','3','4','5','6','7','8','9','0',')'];
BUILD_LIST.forEach((t, i) => DEF[t].key = BUILD_KEYS[i]);
// stockage : le blé va au grenier, bois/pierre/fer à la réserve, les armes et flèches au donjon
export const STORE_OF: Record<string, string> = {ble:'grenier',bois:'reserve',pierre:'reserve',fer:'reserve'};
export const START_ARROWS = 8;
export const START_RES = {bois:30,pierre:10,ble:20,fer:0,arc:0,lance:0,epee:0,fleche:START_ARROWS};
export const RICH_RES = {bois:120,pierre:60,ble:90,fleche:16};
export const UT: Record<string, any> = {
  lord:{hp:300,speed:125,r:13},
  archer:{hp:55,speed:78,r:9,range:240,dmg:9,cd:1.5,aggro:290},
  lancier:{hp:120,speed:88,r:10,range:16,dmg:13,cd:1.0,aggro:250},
  spadassin:{hp:420,speed:80,r:11,range:18,dmg:34,cd:.9,aggro:260},
};
export const RESN: Record<string, string> = {bois:'bois',pierre:'pierre',ble:'blé',fer:'fer',arc:'arc',lance:'lance',epee:'épée',fleche:'flèche'};
export const NEED: Record<string, string> = {archer:'arc',lancier:'lance',spadassin:'epee'};
export const AI_ORDER = ['reserve','grenier','bucheron','ferme','bucheron','fleches','carriere','bucheron','arcs','lances','caserne','ferme','bucheron','mine','forge'];
export const STONES = [{x:580,y:1010,r:80},{x:W-580,y:1010,r:80}];
// gisement de fer unique, à égale distance des deux donjons
export const IRON = {x:W/2,y:840,r:75,iron:true};
export const ROCKS: any[] = [...STONES, IRON];
export const RIVER = {river:true};
export const BRIDGE_Y = .17;
export const RESPAWN = 20;
export const TREE_R = 11;
/** temps de charge complet de l'arc du seigneur, en secondes */
export const CHARGE_T = 1.1;
/** les archers de l'IA tirent de plus loin (portée et détection multipliées) */
export const AI_ARCHER_RANGE = 1.4;
