#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..');
const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'electron');
const require = createRequire(import.meta.url);

function skip(reason) {
  console.log(`[desktop] Skipping the Electron binary download: ${reason}`);
  process.exit(0);
}

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') skip('ELECTRON_SKIP_BINARY_DOWNLOAD=1');
if (process.platform !== 'darwin') skip(`not building on macOS (${process.platform})`);

let packagePath;
try {
  packagePath = require.resolve('electron/package.json');
} catch {
  console.error('[desktop] The electron package is not installed. Run pnpm install first.');
  process.exit(1);
}

const electronDir = path.dirname(packagePath);
const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
const pathFile = path.join(electronDir, 'path.txt');
const distDir = path.join(electronDir, 'dist');

function installed() {
  try {
    const distVersion = fs.readFileSync(path.join(distDir, 'version'), 'utf8').replace(/^v/, '');
    const executable = fs.readFileSync(pathFile, 'utf8').trim();
    return distVersion === version && fs.existsSync(path.join(distDir, executable));
  } catch {
    return false;
  }
}

if (installed()) {
  console.log(`[desktop] Electron ${version} is ready`);
  process.exit(0);
}

console.log(`[desktop] Downloading Electron ${version}…`);
fs.mkdirSync(CACHE_DIR, { recursive: true });
execFileSync(process.execPath, [path.join(electronDir, 'install.js')], {
  cwd: electronDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_CACHE: process.env.ELECTRON_CACHE ?? CACHE_DIR,
    electron_config_cache: process.env.electron_config_cache ?? CACHE_DIR,
  },
});

if (!installed()) {
  console.error(`[desktop] Electron ${version} was not installed correctly under ${electronDir}`);
  process.exit(1);
}
console.log(`[desktop] Electron ${version} is ready`);
