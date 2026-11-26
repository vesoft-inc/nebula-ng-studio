import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveServerLayout, serverBinaryName, validateServerLayout } from '../src/server/paths.mjs';

const isWindows = process.platform === 'win32';

test('serverBinaryName uses the Windows executable extension', () => {
  assert.equal(serverBinaryName('darwin'), 'studio');
  assert.equal(serverBinaryName('linux'), 'studio');
  assert.equal(serverBinaryName('win32'), 'studio.exe');
});

test('resolveServerLayout returns bundle paths for a packaged app', () => {
  const resources = path.join('/Applications', 'NebulaGraph Studio.app', 'Contents', 'Resources');
  const layout = resolveServerLayout({
    isPackaged: true,
    resourcesPath: resources,
    appPath: path.join(resources, 'app.asar'),
  });
  assert.equal(layout.kind, 'packaged');
  assert.equal(layout.binary, path.join(resources, 'server', serverBinaryName()));
  assert.equal(layout.assetsDir, path.join(resources, 'server', 'assets', 'public'));
  assert.equal(layout.configTemplate, path.join(resources, 'server', 'config.yaml'));
});

test('resolveServerLayout uses studio.exe for Windows', () => {
  const layout = resolveServerLayout({
    isPackaged: true,
    resourcesPath: path.join('/app', 'resources'),
    appPath: '/app/app.asar',
    platform: 'win32',
  });
  assert.ok(layout.binary.endsWith('studio.exe'));
});

test('resolveServerLayout prefers the built server in development', () => {
  const appPath = path.join('/repo', 'apps', 'desktop');
  const layout = resolveServerLayout({
    isPackaged: false,
    appPath,
    exists: () => true,
  });
  assert.equal(layout.kind, 'dev-built');
  assert.equal(layout.dir, path.join(appPath, 'build', 'server'));
  assert.equal(layout.configTemplate, path.join(appPath, 'resources', 'config.yaml'));
});

test('resolveServerLayout falls back to apps/server when no build exists', () => {
  const appPath = path.join('/repo', 'apps', 'desktop');
  const sourceDir = path.resolve(appPath, '..', 'server');
  const layout = resolveServerLayout({
    isPackaged: false,
    appPath,
    exists: () => false,
  });
  assert.equal(layout.kind, 'dev-source');
  assert.equal(layout.dir, sourceDir);
  assert.equal(layout.binary, path.join(sourceDir, 'bin', serverBinaryName()));
  assert.equal(layout.assetsDir, path.join(sourceDir, 'assets', 'public'));
});

test('validateServerLayout reports missing and non-executable files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-layout-test-'));
  const binary = path.join(dir, 'studio');
  const assets = path.join(dir, 'assets', 'public');
  const template = path.join(dir, 'config.yaml');
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(template, 'x');
  fs.writeFileSync(binary, '');
  try {
    fs.chmodSync(binary, 0o644);
  } catch {
    // Windows only models the write bit.
  }

  const layout = { kind: 'test', dir, binary, assetsDir: assets, configTemplate: template };
  if (!isWindows) {
    const errors = validateServerLayout(layout);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /not executable/);
  }

  try {
    fs.chmodSync(binary, 0o755);
  } catch {
    // Windows only models the write bit.
  }
  assert.deepEqual(validateServerLayout(layout), []);

  fs.rmSync(binary);
  assert.match(validateServerLayout(layout)[0], /not found/);

  const missing = validateServerLayout({ kind: 'test' });
  assert.equal(missing.length, 3);
});
