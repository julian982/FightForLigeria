import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` : site pour GitHub Pages (chemins relatifs, marche sous /FightForLigeria/).
// `vite build --mode single` : un seul fichier HTML autonome (aperçu en artifact).
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: { alias: { '@ffl/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) } },
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
}));
