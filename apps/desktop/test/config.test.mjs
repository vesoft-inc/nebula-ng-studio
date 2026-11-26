import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  chooseServerPort,
  createAuthSecrets,
  readOrCreateAuthSecrets,
  renderConfigTemplate,
  UserQuitError,
  yamlQuote,
} from '../src/server/config.mjs';
import { versionInfo } from '../src/version.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(TEST_DIR, '..');
const TEMPLATE = fs.readFileSync(path.join(DESKTOP_DIR, 'resources', 'config.yaml'), 'utf8');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'studio desktop test '));
}

test('renderConfigTemplate substitutes every placeholder and quotes paths', () => {
  const dataDir = path.join(tempDir(), "data's");
  const logDir = path.join(tempDir(), 'log dir');
  const rendered = renderConfigTemplate(TEMPLATE, { port: 7001, dataDir, logDir });

  assert.match(rendered, /^Host: 127\.0\.0\.1$/m);
  assert.match(rendered, /^Port: 7001$/m);
  assert.ok(!rendered.includes('__PORT__'));
  assert.ok(!rendered.includes('__DB_PATH__'));
  assert.ok(!rendered.includes('__LOG_DIR__'));
  assert.ok(rendered.includes(yamlQuote(path.join(dataDir, 'studio.db'))));
  assert.ok(rendered.includes(yamlQuote(logDir)));
  assert.ok(rendered.includes("data''s"));
});

test('renderConfigTemplate rejects a port outside the valid range', () => {
  assert.throws(
    () => renderConfigTemplate(TEMPLATE, { port: 70000, dataDir: '/tmp/a', logDir: '/tmp/b' }),
    /Invalid Studio server port/
  );
});

test('yamlQuote escapes single quotes', () => {
  assert.equal(yamlQuote("C:\\Users\\o'brien"), "'C:\\Users\\o''brien'");
});

test('auth secrets are generated once, reused, and owner-only', () => {
  const dir = tempDir();
  const file = path.join(dir, 'auth.json');
  const first = readOrCreateAuthSecrets(file);
  assert.ok(first.tokenSecret.length > 20);
  assert.ok([16, 24, 32].includes(Buffer.byteLength(first.encryptPassphrase, 'utf8')));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);

  const second = readOrCreateAuthSecrets(file);
  assert.deepEqual(second, first);

  fs.writeFileSync(file, '{not json');
  const third = readOrCreateAuthSecrets(file);
  assert.notDeepEqual(third, first);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('createAuthSecrets produces a 32-byte passphrase after base64url encoding', () => {
  const secrets = createAuthSecrets(crypto.randomBytes);
  assert.equal(Buffer.byteLength(secrets.encryptPassphrase, 'utf8'), 32);
});

test('chooseServerPort prefers 7001 when it is available', async () => {
  const result = await chooseServerPort({
    preferred: 7001,
    isAvailable: async (port) => port === 7001,
  });
  assert.deepEqual(result, { port: 7001, fallback: false, source: 'default' });
});

test('chooseServerPort falls back for a single session when allowed', async () => {
  const result = await chooseServerPort({
    preferred: 7001,
    allowFallback: true,
    isAvailable: async (port) => port === 7004,
  });
  assert.deepEqual(result, { port: 7004, fallback: true, source: 'fallback' });
});

test('chooseServerPort retries when the user frees the preferred port', async () => {
  let attempts = 0;
  const result = await chooseServerPort({
    preferred: 7001,
    confirmFallback: () => 'retry',
    isAvailable: async (port) => {
      if (port !== 7001) return true;
      attempts += 1;
      return attempts > 1;
    },
  });
  assert.deepEqual(result, { port: 7001, fallback: false, source: 'default' });
});

test('chooseServerPort throws UserQuitError when the user quits', async () => {
  await assert.rejects(
    chooseServerPort({
      preferred: 7001,
      confirmFallback: () => 'quit',
      isAvailable: async () => false,
    }),
    UserQuitError
  );
});

test('chooseServerPort rejects a busy or invalid STUDIO_DESKTOP_PORT', async () => {
  await assert.rejects(chooseServerPort({ envPort: '7001', isAvailable: async () => false }), /already in use/);
  await assert.rejects(
    chooseServerPort({ envPort: 'not-a-port', isAvailable: async () => true }),
    /STUDIO_DESKTOP_PORT/
  );
});

test('versionInfo maps stable and prerelease versions to bundle values', () => {
  assert.deepEqual(versionInfo('5.3.2'), {
    version: '5.3.2',
    core: '5.3.2',
    prerelease: '',
    bundleVersion: '5.3.2',
  });
  assert.deepEqual(versionInfo('5.4.0-rc.5'), {
    version: '5.4.0-rc.5',
    core: '5.4.0',
    prerelease: 'rc.5',
    bundleVersion: '5.4.0.5',
  });
  assert.throws(() => versionInfo('v5.3.2'), /canonical SemVer/);
});
