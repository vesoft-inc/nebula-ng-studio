import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import pkg from './package.json';
const dependencies = Object.keys(pkg.dependencies);
const entries = Object.fromEntries(
  Object.values(pkg.exports).map((entry) => [
    entry.source.replace('./src/', '').replace(/\.ts$/, ''),
    fileURLToPath(new URL(entry.source, import.meta.url)),
  ])
);
export default defineConfig({
  build: {
    target: 'es2021',
    lib: { entry: entries, formats: ['es'] },
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: (id) => dependencies.some((name) => id === name || id.startsWith(`${name}/`)),
      output: { preserveModules: true, preserveModulesRoot: 'src' },
    },
  },
});
