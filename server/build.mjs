// Construit le serveur et le « worker » de simulation en deux fichiers JavaScript autonomes
// (Colyseus et shared/ compris) : pas besoin de node_modules pour les faire tourner.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const shared = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const common = {
  bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: true, logLevel: 'warning',
  alias: { '@ffl/shared': shared },
  // certains modules de Colyseus utilisent encore require()
  banner: { js: "import { createRequire as __ffl_require } from 'node:module'; const require = __ffl_require(import.meta.url);" },
};
await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.mjs' });
await build({ ...common, entryPoints: ['src/worker.ts'], outfile: 'dist/worker.mjs' });
console.log('serveur construit dans server/dist');
