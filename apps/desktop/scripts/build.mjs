#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionInfo } from '../src/version.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const BUILD_DIR = path.join(DESKTOP_DIR, 'build');
const SERVER_BUILD_DIR = path.join(BUILD_DIR, 'server');
const RELEASE_DIR = path.join(DESKTOP_DIR, 'release');
const SERVER_BINARY = path.join(SERVER_BUILD_DIR, 'studio');
const CACHE_DIR = path.join(REPO_ROOT, '.cache');

const VERSION_PACKAGE = 'github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version';

function run(command, args, { cwd, env } = {}) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function readWebVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'package.json'), 'utf8'));
  if (!manifest.version) throw new Error('apps/web/package.json has no version');
  return manifest.version;
}

export function parseArgs(argv) {
  const options = { dir: false, skipWeb: process.env.STUDIO_DESKTOP_SKIP_WEB === '1', help: false };
  for (const arg of argv) {
    if (arg === '--dir') options.dir = true;
    else if (arg === '--skip-web') options.skipWeb = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function assertPlatform() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error(`This build targets macOS Apple Silicon only (detected ${process.platform}/${process.arch}).`);
  }
}

function assertToolchain() {
  try {
    execFileSync('xcrun', ['--find', 'clang'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'Xcode Command Line Tools are required (CGO builds the SQLite driver). Run: xcode-select --install'
    );
  }
  try {
    execFileSync('go', ['version'], { stdio: 'ignore' });
  } catch {
    throw new Error('Go 1.25+ is required to build the Studio server.');
  }
  try {
    execFileSync('pnpm', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('pnpm is required to build the Studio workspace.');
  }
}

function ensureElectron() {
  run(process.execPath, [path.join(SCRIPT_DIR, 'ensure-electron.mjs')], {
    cwd: DESKTOP_DIR,
    env: process.env,
  });
}

function buildWeb(version) {
  console.log(`\n[desktop] Building the Studio web app (${version})…`);
  run('pnpm', ['--filter', 'nebula-studio', 'build'], {
    cwd: REPO_ROOT,
    env: { ...process.env, STUDIO_VERSION: version },
  });
}

function buildServer(version) {
  console.log('\n[desktop] Building the Studio Go server (darwin/arm64)…');
  const gitHash = gitValue(['rev-parse', 'HEAD']);
  const gitRef = gitValue(['rev-parse', '--abbrev-ref', 'HEAD']);
  const ldflags = [
    '-s',
    '-w',
    `-X ${VERSION_PACKAGE}.Value=${version}`,
    `-X ${VERSION_PACKAGE}.GitHash=${gitHash}`,
    `-X ${VERSION_PACKAGE}.GitRef=${gitRef}`,
  ].join(' ');

  run('go', ['build', '-trimpath', '-ldflags', ldflags, '-o', SERVER_BINARY, '.'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      CGO_ENABLED: '1',
      GOOS: 'darwin',
      GOARCH: 'arm64',
      GOCACHE: process.env.GOCACHE ?? path.join(CACHE_DIR, 'go-build'),
    },
  });
}

function assembleServerDirectory() {
  const assets = path.join(SERVER_DIR, 'assets', 'public');
  if (!fs.existsSync(path.join(assets, 'index.html'))) {
    throw new Error(`Studio frontend assets are missing at ${assets}. Run the web build before packaging.`);
  }

  fs.cpSync(assets, path.join(SERVER_BUILD_DIR, 'assets', 'public'), { recursive: true });
  fs.copyFileSync(path.join(DESKTOP_DIR, 'resources', 'config.yaml'), path.join(SERVER_BUILD_DIR, 'config.yaml'));

  const license = path.join(REPO_ROOT, 'LICENSE');
  if (fs.existsSync(license)) {
    fs.copyFileSync(license, path.join(SERVER_BUILD_DIR, 'LICENSE'));
  }

  fs.chmodSync(SERVER_BINARY, 0o755);
  const fileInfo = execFileSync('file', [SERVER_BINARY], { encoding: 'utf8' });
  if (!/Mach-O/.test(fileInfo) || !/arm64/.test(fileInfo)) {
    throw new Error(`Unexpected Studio server binary: ${fileInfo.trim()}`);
  }
}

function runElectronBuilder(version, dir) {
  console.log(`\n[desktop] Packaging NebulaGraph Studio ${version.version}…`);
  const electronCache = process.env.ELECTRON_CACHE ?? path.join(CACHE_DIR, 'electron');
  fs.mkdirSync(electronCache, { recursive: true });
  fs.mkdirSync(path.join(CACHE_DIR, 'electron-builder'), { recursive: true });

  const args = [
    'exec',
    'electron-builder',
    '--mac',
    '--arm64',
    '--publish',
    'never',
    `-c.extraMetadata.version=${version.version}`,
    `-c.mac.bundleShortVersion=${version.core}`,
    `-c.mac.bundleVersion=${version.bundleVersion}`,
    `-c.electronDownload.cache=${electronCache}`,
  ];
  if (dir) args.push('--dir');

  run('pnpm', args, {
    cwd: DESKTOP_DIR,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      ELECTRON_CACHE: electronCache,
      electron_config_cache: process.env.electron_config_cache ?? electronCache,
      ELECTRON_BUILDER_CACHE: process.env.ELECTRON_BUILDER_CACHE ?? path.join(CACHE_DIR, 'electron-builder'),
    },
  });
}

function writeChecksums() {
  if (!fs.existsSync(RELEASE_DIR)) return;
  const artifacts = fs
    .readdirSync(RELEASE_DIR)
    .filter((name) => name.endsWith('.dmg') || name.endsWith('.zip'))
    .sort();
  if (artifacts.length === 0) return;

  const lines = artifacts.map((name) => {
    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(RELEASE_DIR, name)))
      .digest('hex');
    return `${hash}  ${name}`;
  });
  fs.writeFileSync(path.join(RELEASE_DIR, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

function printArtifacts() {
  console.log('\n[desktop] Artifacts:');
  if (!fs.existsSync(RELEASE_DIR)) {
    console.log('  (none)');
    return;
  }
  const visible = fs
    .readdirSync(RELEASE_DIR)
    .filter((name) => name === 'mac-arm64' || name === 'SHA256SUMS' || name.endsWith('.dmg') || name.endsWith('.zip'))
    .sort();
  for (const name of visible) {
    console.log(`  ${path.join(RELEASE_DIR, name)}`);
  }
  console.log(
    `\n[desktop] Open the app with:\n  open "${path.join(RELEASE_DIR, 'mac-arm64', 'NebulaGraph Studio.app')}"\n`
  );
}

export async function build({ dir = false, skipWeb = false } = {}) {
  assertPlatform();
  assertToolchain();
  ensureElectron();

  const version = versionInfo(readWebVersion());
  if (!skipWeb) buildWeb(version.version);

  fs.rmSync(SERVER_BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(SERVER_BUILD_DIR, { recursive: true });
  buildServer(version.version);
  assembleServerDirectory();

  fs.rmSync(RELEASE_DIR, { recursive: true, force: true });
  runElectronBuilder(version, dir);
  writeChecksums();
  printArtifacts();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/build.mjs [--dir] [--skip-web]');
      process.exit(0);
    }
    build(options).catch((error) => {
      console.error(`\n[desktop] Build failed: ${error.message}`);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`\n[desktop] ${error.message}`);
    process.exitCode = 1;
  }
}
