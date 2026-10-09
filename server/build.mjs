// Construit le serveur et le « worker » de simulation (qui embarque shared/) en JavaScript pour Node.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const shared = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: true, alias: { '@ffl/shared': shared }, logLevel: 'warning' };
await build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', packages: 'external' });
await build({ ...common, entryPoints: ['src/worker.ts'], outfile: 'dist/worker.js' });
console.log('serveur construit dans server/dist');
