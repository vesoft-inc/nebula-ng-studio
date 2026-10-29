import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const surface = JSON.parse(await readFile('public-api.json', 'utf8'));
const external = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)];
const internalRoot = resolve('../studio-ui-internal');
const internalPackage = JSON.parse(await readFile(resolve(internalRoot, 'package.json'), 'utf8'));
const index = await readFile('.types/index.d.ts', 'utf8');
await writeFile('.types/index.d.ts', index.replace(/^import ['"][^'"]+\.css['"];?\s*$/gm, ''));
const bundle = await rollup({
  input: Object.fromEntries(
    Object.entries(surface).map(([entry, spec]) => [
      entry === '.' ? 'index' : entry.slice(2),
      resolve(spec.source.replace('./src/', '.types/').replace(/\.tsx?$/, '.d.ts')),
    ])
  ),
  external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
  plugins: [
    {
      name: 'resolve-private-declarations',
      resolveId(id) {
        if (id === internalPackage.name || id.startsWith(`${internalPackage.name}/`)) {
          const subpath = id === internalPackage.name ? '.' : `.${id.slice(internalPackage.name.length)}`;
          const entry = internalPackage.exports[subpath];
          if (!entry?.types) throw new Error(`Missing internal type entry ${id}`);
          return resolve(internalRoot, entry.types);
        }
      },
    },
    dts({ respectExternal: true }),
  ],
});
try {
  await bundle.write({
    dir: 'dist',
    format: 'es',
    entryFileNames: '[name].d.ts',
    chunkFileNames: 'types/[name]-[hash].d.ts',
  });
} finally {
  await bundle.close();
}
await rm('.types', { recursive: true, force: true });
