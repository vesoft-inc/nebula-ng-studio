#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { binaryExtension, expectedBinaryFormat, readBinaryArchitecture } from './binary-arch.mjs';
import { versionInfo } from '../src/version.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const WEB_DIR = path.join(REPO_ROOT, 'apps', 'web');
const SERVER_DIR = path.join(REPO_ROOT, 'apps', 'server');
const BUILD_DIR = path.join(DESKTOP_DIR, 'build');
const SERVER_BUILD_DIR = path.join(BUILD_DIR, 'server');
const DEFAULT_OUTPUT_DIR = path.join(DESKTOP_DIR, 'release');
const CACHE_DIR = path.join(REPO_ROOT, '.cache');
const PLATFORM = process.platform;

const GOOS_BY_PLATFORM = {
  darwin: 'darwin',
  win32: 'windows',
  linux: 'linux',
};
const GOARCH_BY_ARCH = {
  arm64: 'arm64',
  x64: 'amd64',
};
const ELECTRON_FLAG_BY_PLATFORM = {
  darwin: '--mac',
  win32: '--win',
  linux: '--linux',
};
const ELECTRON_ARCH_FLAG = {
  arm64: '--arm64',
  x64: '--x64',
};
const VERSION_PACKAGE = 'github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version';
const MAC_ARTIFACT_EXTENSIONS = ['.dmg', '.zip'];
const WIN_ARTIFACT_EXTENSIONS = ['.exe', '.zip'];
const LINUX_ARTIFACT_EXTENSIONS = ['.AppImage', '.deb', '.tar.gz'];

const SERVER_BINARY = path.join(SERVER_BUILD_DIR, `studio${binaryExtension(PLATFORM)}`);

function run(command, args, { cwd, env, shell = false } = {}) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit', shell });
}

function runPnpm(args, { cwd, env } = {}) {
  const pnpmCli = process.env.npm_execpath;
  if (pnpmCli && fs.existsSync(pnpmCli)) {
    run(process.execPath, [pnpmCli, ...args], { cwd, env });
    return;
  }
  if (PLATFORM === 'win32') {
    run('pnpm.cmd', args, { cwd, env, shell: true });
    return;
  }
  run('pnpm', args, { cwd, env });
}

function runNodeScript(script, args = [], { cwd, env } = {}) {
  run(process.execPath, [script, ...args], { cwd, env });
}

function gitValue(args) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function readWebVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'package.json'), 'utf8'));
  if (!manifest.version) throw new Error('apps/web/package.json has no version');
  return manifest.version;
}

export function defaultArches() {
  const host = process.arch === 'arm64' ? 'arm64' : 'x64';
  if (PLATFORM === 'darwin') {
    // Build the host architecture last so build/server (used by desktop:dev)
    // contains a binary this machine can run without Rosetta.
    return host === 'arm64' ? ['x64', 'arm64'] : ['arm64', 'x64'];
  }
  return [host];
}

export function parseArchList(value) {
  const arches = String(value)
    .split(',')
    .map((arch) => arch.trim())
    .filter(Boolean);
  for (const arch of arches) {
    if (!GOARCH_BY_ARCH[arch]) throw new Error(`Unsupported arch "${arch}" (use arm64 or x64)`);
  }
  return [...new Set(arches)];
}

export function parseArgs(argv) {
  const options = {
    dir: false,
    skipWeb: process.env.STUDIO_DESKTOP_SKIP_WEB === '1',
    help: false,
    force: false,
    arches: null,
    output: DEFAULT_OUTPUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') options.dir = true;
    else if (arg === '--skip-web') options.skipWeb = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--arch' || arg === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === '--arch') options.arches = parseArchList(value);
      else options.output = path.resolve(value);
      index += 1;
    } else if (arg.startsWith('--arch=')) options.arches = parseArchList(arg.slice('--arch='.length));
    else if (arg.startsWith('--output=')) options.output = path.resolve(arg.slice('--output='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function assertPlatform() {
  if (!GOOS_BY_PLATFORM[PLATFORM]) {
    throw new Error(`Unsupported build host: ${PLATFORM}. Build on macOS, Windows, or Linux.`);
  }
}

function assertArchBuildable(arch) {
  if (!GOARCH_BY_ARCH[arch]) throw new Error(`Unsupported arch: ${arch}`);
  // CGO requires a compiler for the target. macOS can cross-build both Apple
  // architectures with clang; Windows/Linux builds run natively (CI matrix).
  if (PLATFORM !== 'darwin' && arch !== (process.arch === 'arm64' ? 'arm64' : 'x64')) {
    throw new Error(
      `Cannot build ${PLATFORM}/${arch} on ${PLATFORM}/${process.arch} with CGO. ` +
        'Run this build on the target architecture (the desktop CI matrix does this).'
    );
  }
}

function assertPnpm() {
  try {
    const pnpmCli = process.env.npm_execpath;
    if (pnpmCli && fs.existsSync(pnpmCli)) {
      execFileSync(process.execPath, [pnpmCli, '--version'], { stdio: 'ignore' });
    } else if (PLATFORM === 'win32') {
      execFileSync('pnpm.cmd', ['--version'], { stdio: 'ignore', shell: true });
    } else {
      execFileSync('pnpm', ['--version'], { stdio: 'ignore' });
    }
  } catch {
    throw new Error('pnpm is required to build the Studio workspace.');
  }
}

function assertToolchain() {
  try {
    execFileSync('go', ['version'], { stdio: 'ignore' });
  } catch {
    throw new Error('Go 1.25+ is required to build the Studio server.');
  }
  assertPnpm();

  if (PLATFORM === 'darwin') {
    try {
      execFileSync('xcrun', ['--find', 'clang'], { stdio: 'ignore' });
    } catch {
      throw new Error(
        'Xcode Command Line Tools are required (CGO builds the SQLite driver). Run: xcode-select --install'
      );
    }
    return;
  }

  try {
    execFileSync('gcc', ['--version'], { stdio: 'ignore', windowsHide: true });
  } catch {
    const hint =
      PLATFORM === 'win32'
        ? 'Install MinGW-w64 (for example: choco install mingw) and make gcc available on PATH.'
        : 'Install gcc (for example: sudo apt-get install build-essential).';
    throw new Error(`A C compiler is required for the SQLite driver. ${hint}`);
  }
}

function ensureElectron() {
  runNodeScript(path.join(SCRIPT_DIR, 'ensure-electron.mjs'), [], {
    cwd: DESKTOP_DIR,
    env: process.env,
  });
}

function buildWeb(version) {
  console.log(`\n[desktop] Building the Studio web app (${version})…`);
  runPnpm(['--filter', 'nebula-studio', 'build'], {
    cwd: REPO_ROOT,
    env: { ...process.env, STUDIO_VERSION: version },
  });
}

function cgoEnvironment(arch) {
  const env = {
    ...process.env,
    CGO_ENABLED: '1',
    GOOS: GOOS_BY_PLATFORM[PLATFORM],
    GOARCH: GOARCH_BY_ARCH[arch],
    GOCACHE: process.env.GOCACHE ?? path.join(CACHE_DIR, 'go-build'),
  };

  if (PLATFORM === 'darwin' && arch !== (process.arch === 'arm64' ? 'arm64' : 'x64')) {
    env.CC = `clang -arch ${arch === 'x64' ? 'x86_64' : 'arm64'}`;
  }
  return env;
}

function buildServer(version, arch) {
  console.log(`\n[desktop] Building the Studio Go server (${PLATFORM}/${arch})…`);
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
    env: cgoEnvironment(arch),
  });
}

function assembleServerDirectory(arch) {
  const assets = path.join(SERVER_DIR, 'assets', 'public');
  if (!fs.existsSync(path.join(assets, 'index.html'))) {
    throw new Error(`Studio frontend assets are missing at ${assets}. Run the web build before packaging.`);
  }

  fs.mkdirSync(SERVER_BUILD_DIR, { recursive: true });
  fs.cpSync(assets, path.join(SERVER_BUILD_DIR, 'assets', 'public'), { recursive: true });
  fs.copyFileSync(path.join(DESKTOP_DIR, 'resources', 'config.yaml'), path.join(SERVER_BUILD_DIR, 'config.yaml'));

  const license = path.join(REPO_ROOT, 'LICENSE');
  if (fs.existsSync(license)) fs.copyFileSync(license, path.join(SERVER_BUILD_DIR, 'LICENSE'));

  if (PLATFORM !== 'win32') {
    try {
      fs.chmodSync(SERVER_BINARY, 0o755);
    } catch {
      // Best effort; Windows does not use POSIX execute bits.
    }
  }

  const info = readBinaryArchitecture(SERVER_BINARY);
  const expectedFormat = expectedBinaryFormat(PLATFORM);
  if (info.format !== expectedFormat || info.arch !== arch) {
    throw new Error(
      `Unexpected Studio server binary: ${SERVER_BINARY} is ${info.format}/${info.arch}, expected ${expectedFormat}/${arch}`
    );
  }
}

function isAppRunning() {
  try {
    if (PLATFORM === 'darwin') {
      execFileSync('pgrep', ['-f', 'NebulaGraph Studio.app/Contents/MacOS/NebulaGraph Studio'], {
        stdio: 'ignore',
      });
      return true;
    }
    if (PLATFORM === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-Process "NebulaGraph Studio" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id',
        ],
        { encoding: 'utf8', windowsHide: true }
      ).trim();
      return output.length > 0;
    }
    execFileSync('pgrep', ['-f', 'linux-unpacked/nebula-studio'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runElectronBuilder(version, arch, { dir, outputDir }) {
  console.log(`\n[desktop] Packaging NebulaGraph Studio ${version.version} (${PLATFORM}/${arch})…`);
  const electronCache = process.env.ELECTRON_CACHE ?? path.join(CACHE_DIR, 'electron');
  fs.mkdirSync(electronCache, { recursive: true });
  fs.mkdirSync(path.join(CACHE_DIR, 'electron-builder'), { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const args = [
    'exec',
    'electron-builder',
    ELECTRON_FLAG_BY_PLATFORM[PLATFORM],
    ELECTRON_ARCH_FLAG[arch],
    '--publish',
    'never',
    `-c.directories.output=${outputDir}`,
    `-c.extraMetadata.version=${version.version}`,
    `-c.electronDownload.cache=${electronCache}`,
  ];
  if (PLATFORM === 'darwin') {
    args.push(`-c.mac.bundleShortVersion=${version.core}`, `-c.mac.bundleVersion=${version.bundleVersion}`);
  }
  if (dir) args.push('--dir');

  runPnpm(args, {
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

function artifactExtensions() {
  if (PLATFORM === 'darwin') return MAC_ARTIFACT_EXTENSIONS;
  if (PLATFORM === 'win32') return WIN_ARTIFACT_EXTENSIONS;
  return LINUX_ARTIFACT_EXTENSIONS;
}

function writeChecksums(outputDir) {
  if (!fs.existsSync(outputDir)) return;
  const extensions = artifactExtensions();
  const artifacts = fs
    .readdirSync(outputDir)
    .filter((name) => extensions.some((extension) => name.endsWith(extension)))
    .filter((name) => !name.endsWith('.blockmap'))
    .sort();
  if (artifacts.length === 0) return;

  const lines = artifacts.map((name) => {
    const hash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(outputDir, name)))
      .digest('hex');
    return `${hash}  ${name}`;
  });
  fs.writeFileSync(path.join(outputDir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

function printArtifacts(outputDir) {
  console.log('\n[desktop] Artifacts:');
  const extensions = artifactExtensions();
  const entries = fs.existsSync(outputDir)
    ? fs
        .readdirSync(outputDir)
        .filter(
          (name) =>
            extensions.some((extension) => name.endsWith(extension)) ||
            name === 'SHA256SUMS' ||
            name === 'mac-arm64' ||
            name === 'mac' ||
            name === 'win-unpacked' ||
            name === 'linux-unpacked'
        )
        .sort()
    : [];
  for (const name of entries) console.log(`  ${path.join(outputDir, name)}`);

  if (PLATFORM === 'darwin') {
    for (const name of ['mac-arm64', 'mac']) {
      const app = path.join(outputDir, name, 'NebulaGraph Studio.app');
      if (fs.existsSync(app)) console.log(`\n[desktop] Open with:\n  open "${app}"`);
    }
  } else if (PLATFORM === 'win32') {
    const installer = entries.find((name) => name.endsWith('.exe'));
    if (installer) console.log(`\n[desktop] Installer:\n  ${path.join(outputDir, installer)}`);
  } else {
    const appImage = entries.find((name) => name.endsWith('.AppImage'));
    if (appImage) console.log(`\n[desktop] AppImage:\n  chmod +x "${path.join(outputDir, appImage)}"`);
  }
}

export async function build({ dir = false, skipWeb = false, arches, output = DEFAULT_OUTPUT_DIR, force = false } = {}) {
  assertPlatform();
  assertToolchain();
  ensureElectron();

  const outputDir = path.resolve(output);
  const buildArches = arches?.length ? arches : defaultArches();
  for (const arch of buildArches) assertArchBuildable(arch);

  if (outputDir === DEFAULT_OUTPUT_DIR && !force && isAppRunning()) {
    throw new Error(
      'NebulaGraph Studio is currently running. Quit it before rebuilding the default ' +
        'release directory, or pass --output <dir> to build alongside it (or --force to override).'
    );
  }

  const version = versionInfo(readWebVersion());
  if (!skipWeb) buildWeb(version.version);

  fs.rmSync(SERVER_BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(SERVER_BUILD_DIR, { recursive: true });
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const arch of buildArches) {
    buildServer(version.version, arch);
    assembleServerDirectory(arch);
    runElectronBuilder(version, arch, { dir, outputDir });
  }

  writeChecksums(outputDir);
  printArtifacts(outputDir);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(
        'Usage: node scripts/build.mjs [--dir] [--skip-web] [--arch arm64|x64|arm64,x64] [--output <dir>] [--force]'
      );
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
