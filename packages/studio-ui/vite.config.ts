import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import pkg from './package.json';
import surface from './public-api.json';

const dependencies = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { conditions: ['source'] },
  css: { postcss: { plugins: [] } },
  build: {
    target: 'es2021',
    lib: {
      entry: Object.fromEntries(
        Object.entries(surface).map(([entry, spec]) => [
          entry === '.' ? 'index' : entry.slice(2),
          fileURLToPath(new URL(spec.source, import.meta.url)),
        ])
      ),
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) =>
        !id.includes('?worker') &&
        !id.endsWith('.css') &&
        dependencies.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { entryFileNames: '[name].js', chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
