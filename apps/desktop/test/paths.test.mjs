import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveServerLayout, validateServerLayout } from '../src/server/paths.mjs';

test('resolveServerLayout returns bundle paths for a packaged app', () => {
  const layout = resolveServerLayout({
    isPackaged: true,
    resourcesPath: '/Applications/NebulaGraph Studio.app/Contents/Resources',
    appPath: '/Applications/NebulaGraph Studio.app/Contents/Resources/app.asar',
  });
  assert.equal(layout.kind, 'packaged');
  assert.equal(layout.binary, '/Applications/NebulaGraph Studio.app/Contents/Resources/server/studio');
  assert.equal(layout.assetsDir, '/Applications/NebulaGraph Studio.app/Contents/Resources/server/assets/public');
  assert.equal(layout.configTemplate, '/Applications/NebulaGraph Studio.app/Contents/Resources/server/config.yaml');
});

test('resolveServerLayout prefers the built server in development', () => {
  const layout = resolveServerLayout({
    isPackaged: false,
    appPath: '/repo/apps/desktop',
    exists: (file) => file.endsWith('/build/server/studio') || file.endsWith('/assets/public'),
  });
  assert.equal(layout.kind, 'dev-built');
  assert.equal(layout.dir, '/repo/apps/desktop/build/server');
  assert.equal(layout.configTemplate, '/repo/apps/desktop/resources/config.yaml');
});

test('resolveServerLayout falls back to apps/server when no build exists', () => {
  const layout = resolveServerLayout({
    isPackaged: false,
    appPath: '/repo/apps/desktop',
    exists: () => false,
  });
  assert.equal(layout.kind, 'dev-source');
  assert.equal(layout.dir, '/repo/apps/server');
  assert.equal(layout.binary, '/repo/apps/server/bin/studio');
  assert.equal(layout.assetsDir, '/repo/apps/server/assets/public');
});

test('validateServerLayout reports missing and non-executable files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-layout-test-'));
  const binary = path.join(dir, 'studio');
  const assets = path.join(dir, 'assets', 'public');
  const template = path.join(dir, 'config.yaml');
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(template, 'x');
  fs.writeFileSync(binary, '');
  fs.chmodSync(binary, 0o644);

  const layout = { kind: 'test', dir, binary, assetsDir: assets, configTemplate: template };
  const errors = validateServerLayout(layout);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /not executable/);

  fs.chmodSync(binary, 0o755);
  assert.deepEqual(validateServerLayout(layout), []);

  fs.rmSync(binary);
  assert.match(validateServerLayout(layout)[0], /not found/);

  const missing = validateServerLayout({ kind: 'test' });
  assert.equal(missing.length, 3);
});
