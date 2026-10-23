import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import pkg from './package.json';

const entries = Object.fromEntries(
  Object.values(pkg.exports).flatMap((entry) =>
    !/\.tsx?$/.test(entry.source)
      ? []
      : [
          [
            entry.source.replace('./src/', '').replace(/\.tsx?$/, ''),
            fileURLToPath(new URL(entry.source, import.meta.url)),
          ],
        ]
  )
);
const dependencies = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];

export default defineConfig({
  base: './',
  plugins: [react()],
  // The library emits its own CSS without inheriting an application's PostCSS setup.
  css: { postcss: { plugins: [] } },
  build: {
    lib: { entry: entries, formats: ['es'] },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: (id) =>
        !id.includes('?worker') &&
        !id.endsWith('.css') &&
        dependencies.some((dependency) => id === dependency || id.startsWith(`${dependency}/`)),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        // npm excludes nested node_modules directories, including bundled worker wrappers.
        entryFileNames: ({ name }) => (name.includes('node_modules') ? `vendor/${basename(name)}.js` : '[name].js'),
        chunkFileNames: '[name].js',
      },
    },
  },
});
