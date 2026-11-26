#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupStaleServer } from '../src/server/manager.mjs';
import { versionInfo } from '../src/version.mjs';
import { binaryExtension, expectedBinaryFormat, readBinaryArchitecture } from './binary-arch.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const DEFAULT_OUTPUT_DIR = path.join(DESKTOP_DIR, 'release');
const SMOKE_ROOT = path.join(DESKTOP_DIR, '.smoke');
const PRODUCT_NAME = 'NebulaGraph Studio';
const PLATFORM = process.platform;
const SERVER_BINARY_NAME = `studio${binaryExtension(PLATFORM)}`;

function fail(message) {
  throw new Error(message);
}

function assertFile(file, label) {
  if (!fs.existsSync(file)) fail(`${label} not found: ${file}`);
}

function readWebVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'web', 'package.json'), 'utf8'));
  return versionInfo(manifest.version);
}

export function parseArgs(argv) {
  const options = { dir: false, output: DEFAULT_OUTPUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dir') options.dir = true;
    else if (arg === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error('--output requires a value');
      options.output = path.resolve(value);
      index += 1;
    } else if (arg.startsWith('--output=')) options.output = path.resolve(arg.slice('--output='.length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function findExecutable(root, candidates) {
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function macAppLayout(outputDir, arch) {
  const appRoot = path.join(outputDir, arch === 'arm64' ? 'mac-arm64' : 'mac', `${PRODUCT_NAME}.app`);
  return {
    arch,
    appRoot,
    executable: path.join(appRoot, 'Contents', 'MacOS', PRODUCT_NAME),
    resources: path.join(appRoot, 'Contents', 'Resources'),
    infoPlist: path.join(appRoot, 'Contents', 'Info.plist'),
  };
}

function winLayout(outputDir, arch) {
  const appRoot = path.join(outputDir, arch === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked');
  const executable = findExecutable(appRoot, [
    `${PRODUCT_NAME}.exe`,
    'nebula-studio.exe',
    ...(fs.existsSync(appRoot)
      ? fs.readdirSync(appRoot).filter((name) => name.endsWith('.exe') && name !== 'elevate.exe')
      : []),
  ]);
  return {
    arch,
    appRoot,
    executable,
    resources: path.join(appRoot, 'resources'),
  };
}

function linuxLayout(outputDir, arch) {
  const appRoot = path.join(outputDir, arch === 'arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked');
  const executable = findExecutable(appRoot, ['nebula-studio', PRODUCT_NAME]);
  return {
    arch,
    appRoot,
    executable,
    resources: path.join(appRoot, 'resources'),
  };
}

function layoutFor(outputDir, arch) {
  if (PLATFORM === 'darwin') return macAppLayout(outputDir, arch);
  if (PLATFORM === 'win32') return winLayout(outputDir, arch);
  return linuxLayout(outputDir, arch);
}

function detectArches(outputDir) {
  if (PLATFORM === 'darwin') {
    const arches = [];
    if (fs.existsSync(path.join(outputDir, 'mac-arm64', `${PRODUCT_NAME}.app`))) arches.push('arm64');
    if (fs.existsSync(path.join(outputDir, 'mac', `${PRODUCT_NAME}.app`))) arches.push('x64');
    return arches;
  }
  if (PLATFORM === 'win32') return [process.arch === 'arm64' ? 'arm64' : 'x64'];
  return [process.arch === 'arm64' ? 'arm64' : 'x64'];
}

function plistValue(plist, key) {
  return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8' }).trim();
}

function verifyMacInfoPlist(layout, version) {
  assertFile(layout.infoPlist, 'Info.plist');
  const bundleId = plistValue(layout.infoPlist, 'CFBundleIdentifier');
  const shortVersion = plistValue(layout.infoPlist, 'CFBundleShortVersionString');
  const bundleVersion = plistValue(layout.infoPlist, 'CFBundleVersion');
  if (bundleId !== 'com.vesoft.nebula.studio') fail(`Unexpected CFBundleIdentifier: ${bundleId}`);
  if (shortVersion !== version.core) {
    fail(`CFBundleShortVersionString is ${shortVersion}, expected ${version.core}`);
  }
  if (bundleVersion !== version.bundleVersion) {
    fail(`CFBundleVersion is ${bundleVersion}, expected ${version.bundleVersion}`);
  }
  try {
    const minimum = plistValue(layout.infoPlist, 'LSMinimumSystemVersion');
    if (!minimum) console.warn('[verify] Warning: LSMinimumSystemVersion is empty');
    else console.log(`[verify] ${layout.arch}: minimum macOS version ${minimum}`);
  } catch {
    console.warn('[verify] Warning: LSMinimumSystemVersion is not present');
  }
}

function verifyBinary(file, expectedArch, label) {
  assertFile(file, label);
  const info = readBinaryArchitecture(file);
  const expectedFormat = expectedBinaryFormat(PLATFORM);
  if (info.format !== expectedFormat) {
    fail(`${label} has format ${info.format}, expected ${expectedFormat}: ${file}`);
  }
  if (info.arch !== expectedArch) {
    fail(`${label} has arch ${info.arch}, expected ${expectedArch}: ${file}`);
  }
  return info;
}

function expectedArtifacts(version, arch) {
  if (PLATFORM === 'darwin') {
    return [
      `NebulaGraph-Studio-${version.version}-mac-${arch}.dmg`,
      `NebulaGraph-Studio-${version.version}-mac-${arch}.zip`,
    ];
  }
  if (PLATFORM === 'win32') {
    return [
      `NebulaGraph-Studio-${version.version}-win-${arch}.exe`,
      `NebulaGraph-Studio-${version.version}-win-${arch}.zip`,
    ];
  }
  return [
    `NebulaGraph-Studio-${version.version}-linux-${arch}.AppImage`,
    `NebulaGraph-Studio-${version.version}-linux-${arch}.deb`,
    `NebulaGraph-Studio-${version.version}-linux-${arch}.tar.gz`,
  ];
}

function verifyChecksums(outputDir) {
  const checksumFile = path.join(outputDir, 'SHA256SUMS');
  assertFile(checksumFile, 'SHA256SUMS');
  const lines = fs
    .readFileSync(checksumFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) fail('SHA256SUMS is empty');

  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) fail(`Malformed SHA256SUMS line: ${line}`);
    const [, expected, name] = match;
    const file = path.join(outputDir, name);
    assertFile(file, 'Checksummed artifact');
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== expected) fail(`Checksum mismatch for ${name}`);
  }
}

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function canRunOnHost(arch) {
  if (PLATFORM === 'darwin') {
    if (arch === (process.arch === 'arm64' ? 'arm64' : 'x64')) return true;
    if (arch === 'x64' && process.arch === 'arm64') {
      // Rosetta can translate the x64 app locally, but on headless CI runners
      // the translated Electron process can hang. The x64 bundle is still
      // architecture/Info.plist/artifact checked; only the smoke is skipped.
      if (process.env.CI === 'true') return false;
      try {
        execFileSync('arch', ['-x86_64', '/usr/bin/true'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  return arch === (process.arch === 'arm64' ? 'arm64' : 'x64');
}

function smokeCommand(layout, skipSandbox) {
  if (PLATFORM === 'darwin') {
    const args = ['--smoke-test'];
    if (layout.arch === 'x64' && process.arch === 'arm64') {
      return { command: 'arch', args: ['-x86_64', layout.executable, ...args] };
    }
    return { command: layout.executable, args };
  }
  if (PLATFORM === 'win32') {
    const args = ['--smoke-test'];
    if (process.env.CI === 'true') args.push('--disable-gpu');
    return { command: layout.executable, args };
  }

  const args = ['--smoke-test'];
  if (skipSandbox) args.push('--no-sandbox', '--disable-gpu');
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    if (!commandExists('xvfb-run')) {
      throw new Error('No display is available and xvfb-run is not installed. Install xvfb or run on a desktop.');
    }
    return { command: 'xvfb-run', args: ['-a', layout.executable, ...args] };
  }
  return { command: layout.executable, args };
}

async function smokeTest(layout, { skipSandbox }) {
  const smokeDir = path.join(SMOKE_ROOT, `${PLATFORM}-${layout.arch}`);
  const serverBinary = path.join(layout.resources, 'server', SERVER_BINARY_NAME);
  await cleanupStaleServer({
    userDataDir: smokeDir,
    binaryPath: serverBinary,
    logger: console,
    platform: PLATFORM,
  });
  fs.rmSync(smokeDir, { recursive: true, force: true });
  fs.mkdirSync(smokeDir, { recursive: true });

  const { command, args } = smokeCommand(layout, skipSandbox);
  console.log(`[verify] ${layout.arch}: packaged smoke test…`);
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, STUDIO_DESKTOP_USER_DATA: smokeDir },
  });
  await cleanupStaleServer({
    userDataDir: smokeDir,
    binaryPath: serverBinary,
    logger: console,
    platform: PLATFORM,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const resultFile = path.join(smokeDir, 'smoke-result.json');
  let line = stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith('DESKTOP_SMOKE_RESULT '));
  // Windows GUI executables may not inherit stdout when launched from CI.
  if (!line && fs.existsSync(resultFile)) {
    line = `DESKTOP_SMOKE_RESULT ${fs.readFileSync(resultFile, 'utf8').trim()}`;
  }

  if (result.error) fail(`Smoke test failed to run: ${result.error.message}\n${stderr}`);
  if (!line) {
    fail(
      `Smoke test did not report a result (exit ${result.status ?? 'none'}).\n` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }

  const payload = JSON.parse(line.slice('DESKTOP_SMOKE_RESULT '.length));
  if (result.status !== 0 || !payload.ok) {
    fail(
      `Smoke test failed (exit ${result.status ?? 'none'}): ${payload.error ?? 'unknown error'}\n` +
        `stderr:\n${stderr}`
    );
  }

  const ci = process.env.CI === 'true';
  if (!payload.screenshot || !fs.existsSync(payload.screenshot)) {
    if (!ci) fail(`Smoke screenshot was not written: ${payload.screenshot ?? '(unset)'}`);
    console.warn(`[verify] ${layout.arch}: smoke screenshot unavailable; renderer page/title checks passed`);
  } else {
    const size = fs.statSync(payload.screenshot).size;
    if (size < 5_000) {
      if (!ci) fail(`Smoke screenshot looks empty (${size} bytes): ${payload.screenshot}`);
      console.warn(`[verify] ${layout.arch}: smoke screenshot looks empty (${size} bytes); continuing in CI`);
    } else {
      console.log(`[verify] ${layout.arch}: screenshot ${payload.screenshot} (${size} bytes)`);
    }
  }

  console.log(`[verify] ${layout.arch}: ${payload.url} -> ${payload.path} (${payload.title})`);
  return payload;
}

export async function verify({ dir = false, output = DEFAULT_OUTPUT_DIR } = {}) {
  const outputDir = path.resolve(output);
  const arches = detectArches(outputDir);
  if (arches.length === 0) {
    fail(`No packaged app found under ${outputDir}. Build the desktop app first.`);
  }

  const version = readWebVersion();
  const results = [];
  const skipSandbox = PLATFORM === 'linux' && (process.env.CI === 'true' || !process.env.DISPLAY);

  for (const arch of arches) {
    const layout = layoutFor(outputDir, arch);
    console.log(`\n[verify] Checking ${PLATFORM}/${arch}…`);
    assertFile(layout.appRoot, `${arch} application`);
    if (!layout.executable) fail(`Could not find the ${arch} application executable under ${layout.appRoot}`);
    verifyBinary(layout.executable, arch, `${arch} app executable`);
    const serverBinary = path.join(layout.resources, 'server', SERVER_BINARY_NAME);
    verifyBinary(serverBinary, arch, `${arch} Studio server`);
    assertFile(path.join(layout.resources, 'server', 'assets', 'public', 'index.html'), `${arch} Studio assets`);

    if (PLATFORM === 'darwin') verifyMacInfoPlist(layout, version);

    if (!dir) {
      for (const artifact of expectedArtifacts(version, arch)) assertFile(path.join(outputDir, artifact), artifact);
    }

    let smoke = null;
    if (canRunOnHost(arch)) {
      smoke = await smokeTest(layout, { skipSandbox });
    } else {
      console.warn(`[verify] ${arch}: cannot run on this host; structure/architecture verified only`);
    }
    results.push({ arch, smoke });
  }

  if (!dir) verifyChecksums(outputDir);

  console.log('\n[verify] OK');
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    verify(options).catch((error) => {
      console.error(`\n[verify] FAILED: ${error.message}`);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(`\n[verify] FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
