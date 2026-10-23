import { cp, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

const source = resolve('src');
async function copyDeclarations(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await copyDeclarations(path);
    else if (entry.name.endsWith('.d.ts')) await cp(path, resolve('dist', relative(source, path)));
  }
}
await copyDeclarations(source);
