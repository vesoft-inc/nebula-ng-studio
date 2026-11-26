#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupStaleServer } from '../src/server/manager.mjs';
import { versionInfo } from '../src/version.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..', '..');
const RELEASE_DIR = path.join(DESKTOP_DIR, 'release');
const APP_PATH = path.join(RELEASE_DIR, 'mac-arm64', 'NebulaGraph Studio.app');
const APP_EXECUTABLE = path.join(APP_PATH, 'Contents', 'MacOS', 'NebulaGraph Studio');
const APP_PLIST = path.join(APP_PATH, 'Contents', 'Info.plist');
const SERVER_BINARY = path.join(APP_PATH, 'Contents', 'Resources', 'server', 'studio');
const SERVER_ASSETS = path.join(APP_PATH, 'Contents', 'Resources', 'server', 'assets', 'public', 'index.html');
const SMOKE_DIR = path.join(DESKTOP_DIR, '.smoke');

function fail(message) {
  throw new Error(message);
}

function assertFile(file, label) {
  if (!fs.existsSync(file)) fail(`${label} not found: ${file}`);
}

function plistValue(key) {
  return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', APP_PLIST], {
    encoding: 'utf8',
  }).trim();
}

function webVersion() {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'apps', 'web', 'package.json'), 'utf8'));
  return versionInfo(manifest.version);
}

export async function verify({ dir = false } = {}) {
  assertFile(APP_PATH, 'Application bundle');
  assertFile(APP_EXECUTABLE, 'App executable');
  assertFile(APP_PLIST, 'Info.plist');
  assertFile(SERVER_BINARY, 'Bundled Studio server');
  assertFile(SERVER_ASSETS, 'Bundled Studio assets');

  const binaryInfo = execFileSync('file', [SERVER_BINARY], { encoding: 'utf8' });
  if (!/Mach-O/.test(binaryInfo) || !/arm64/.test(binaryInfo)) {
    fail(`Bundled server is not an arm64 Mach-O binary: ${binaryInfo.trim()}`);
  }

  const version = webVersion();
  const bundleId = plistValue('CFBundleIdentifier');
  const shortVersion = plistValue('CFBundleShortVersionString');
  const bundleVersion = plistValue('CFBundleVersion');
  const executable = plistValue('CFBundleExecutable');

  if (bundleId !== 'com.vesoft.nebula.studio') fail(`Unexpected CFBundleIdentifier: ${bundleId}`);
  if (shortVersion !== version.core) {
    fail(`CFBundleShortVersionString is ${shortVersion}, expected ${version.core}`);
  }
  if (bundleVersion !== version.bundleVersion) {
    fail(`CFBundleVersion is ${bundleVersion}, expected ${version.bundleVersion}`);
  }
  if (!executable) fail('CFBundleExecutable is empty');

  try {
    const minimum = plistValue('LSMinimumSystemVersion');
    if (!minimum) console.warn('[verify] Warning: LSMinimumSystemVersion is empty');
    else console.log(`[verify] Minimum macOS version: ${minimum}`);
  } catch {
    console.warn('[verify] Warning: LSMinimumSystemVersion is not present');
  }

  if (!dir) {
    const dmg = path.join(RELEASE_DIR, `NebulaGraph-Studio-${version.version}-mac-arm64.dmg`);
    const zip = path.join(RELEASE_DIR, `NebulaGraph-Studio-${version.version}-mac-arm64.zip`);
    assertFile(dmg, 'DMG artifact');
    assertFile(zip, 'ZIP artifact');
    assertFile(path.join(RELEASE_DIR, 'SHA256SUMS'), 'SHA256SUMS');
  }

  // A previous smoke run that crashed may have left its backend behind and its
  // pid file inside .smoke. Reap it before deleting the directory so the next
  // launch can use the preferred port again.
  await cleanupStaleServer({
    userDataDir: SMOKE_DIR,
    binaryPath: SERVER_BINARY,
    logger: console,
  });
  fs.rmSync(SMOKE_DIR, { recursive: true, force: true });
  fs.mkdirSync(SMOKE_DIR, { recursive: true });

  console.log('[verify] Running the packaged smoke test…');
  const smoke = spawnSync(APP_EXECUTABLE, ['--smoke-test'], {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, STUDIO_DESKTOP_USER_DATA: SMOKE_DIR },
  });
  await cleanupStaleServer({
    userDataDir: SMOKE_DIR,
    binaryPath: SERVER_BINARY,
    logger: console,
  });

  const stdout = smoke.stdout ?? '';
  const stderr = smoke.stderr ?? '';
  const resultLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('DESKTOP_SMOKE_RESULT '));

  if (smoke.error) fail(`Smoke test failed to run: ${smoke.error.message}\n${stderr}`);
  if (!resultLine) {
    fail(
      `Smoke test did not report a result (exit ${smoke.status ?? 'none'}).\n` +
        `stdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }

  const payload = JSON.parse(resultLine.slice('DESKTOP_SMOKE_RESULT '.length));
  if (smoke.status !== 0 || !payload.ok) {
    fail(
      `Smoke test failed (exit ${smoke.status ?? 'none'}): ${payload.error ?? 'unknown error'}\n` + `stderr:\n${stderr}`
    );
  }
  if (!payload.screenshot || !fs.existsSync(payload.screenshot)) {
    fail(`Smoke screenshot was not written: ${payload.screenshot ?? '(unset)'}`);
  }
  const screenshotSize = fs.statSync(payload.screenshot).size;
  if (screenshotSize < 5_000) {
    fail(`Smoke screenshot looks empty (${screenshotSize} bytes): ${payload.screenshot}`);
  }

  console.log(`[verify] Smoke URL: ${payload.url}`);
  console.log(`[verify] Smoke page: ${payload.path} (${payload.title})`);
  console.log(`[verify] Screenshot: ${payload.screenshot} (${screenshotSize} bytes)`);
  console.log('\n[verify] OK');
  return payload;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dir = process.argv.includes('--dir');
  verify({ dir }).catch((error) => {
    console.error(`\n[verify] FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
