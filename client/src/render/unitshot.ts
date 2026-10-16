// Images fixes des troupes (archer, lancier, spadassin) pour l'interface : le vrai modèle 3D du jeu, rendu une seule
// fois hors de l'écran avec le moteur de la partie, aux couleurs de l'équipe, puis gardé en mémoire (image PNG).
import * as THREE from 'three';
import { renderer, VC, TEAMC } from './engine';
import { personGeo, PEOPLE_SCALE } from './people';

const W = 160, H = 200;
const cache = new Map<string, string>();
let refH = 0, scene: THREE.Scene | null = null, cam: THREE.PerspectiveCamera, rt: THREE.WebGLRenderTarget;

function setup() {
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b5a3a, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d2, 1.6); key.position.set(2, 3, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, .6); rim.position.set(-2, 1.5, -2); scene.add(rim);
  cam = new THREE.PerspectiveCamera(30, W / H, .1, 50);
  rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 } as any);
}

/** image (data URL) du modèle d'une troupe pour une équipe ; '' si le rendu 3D n'est pas disponible */
export function unitShot(type: string, team: number): string {
  const k = type + ':' + team + ':' + TEAMC[team]?.m;
  if (cache.has(k)) return cache.get(k)!;
  let url = '';
  try {
    if (!renderer || !renderer.setRenderTarget) return '';
    if (!scene) setup();
    const geo = personGeo(type, team), m = new THREE.Mesh(geo, VC);
    // trois quarts face, comme une figurine posée sur une étagère
    m.rotation.y = -Math.PI / 2 + .55;
    scene!.add(m);
    geo.computeBoundingBox();
    // on cadre sur le corps, pas sur l'arme : la lance dépasse en haut au lieu de rapetisser le lancier
    if (!refH) { const g = personGeo('archer', team); g.computeBoundingBox(); refH = (g.boundingBox!.max.y - g.boundingBox!.min.y) / (PEOPLE_SCALE.archer || 1); g.dispose() }
    const bb = geo.boundingBox!, h = Math.min(bb.max.y - bb.min.y, refH * (PEOPLE_SCALE[type] || 1) * 1.04), cy = bb.min.y + h * .52;
    const dist = (h * .62) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(Math.sin(.2) * dist, cy + h * .12, Math.cos(.2) * dist); cam.lookAt(0, cy, 0);
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha(), prevShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene!, cam);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(prevTarget); renderer.setClearAlpha(prevClear); renderer.shadowMap.enabled = prevShadow;
    scene!.remove(m); geo.dispose();
    // le rendu WebGL est à l'envers (bas en haut) : on le retourne en le copiant dans un canevas
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d')!, img = c2.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    c2.putImageData(img, 0, 0); url = cv.toDataURL('image/png');
  } catch (e) { console.warn('image de troupe :', e); url = '' }
  cache.set(k, url);
  return url;
}
