// Transforme dist-single/index.html en fragment (sans doctype/html/head/body) pour l'aperçu en artifact.
import { readFileSync, writeFileSync } from 'node:fs';
const src = new URL('../dist-single/index.html', import.meta.url);
let s = readFileSync(src, 'utf8');
s = s.replace(/<!doctype html>/i, '').replace(/<\/?(html|head|body)[^>]*>/gi, '').replace(/<meta (charset|name="viewport")[^>]*>/gi, '').trim() + '\n';
writeFileSync(new URL('../dist-single/fightforligeria.html', import.meta.url), s);
console.log('artifact :', (s.length / 1024).toFixed(0), 'ko');
