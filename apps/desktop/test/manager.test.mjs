import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanupStaleServer, ServerManager } from '../src/server/manager.mjs';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = path.resolve(TEST_DIR, '..');
const TEMPLATE = path.join(DESKTOP_DIR, 'resources', 'config.yaml');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'studio-manager-test-'));
}

class FakeChild extends EventEmitter {
  constructor(pid = 43210) {
    super();
    this.pid = pid;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.exitCode = null;
    this.signalCode = null;
    this.signals = [];
    this.exited = false;
  }

  kill(signal = 'SIGTERM') {
    this.signals.push(signal);
    if (this.exited) return true;
    this.exited = true;
    this.exitCode = signal === 'SIGKILL' ? null : 0;
    this.signalCode = signal;
    setImmediate(() => this.emit('exit', this.exitCode, this.signalCode));
    return true;
  }

  emitExit(code = 0, signal = null) {
    if (this.exited) return;
    this.exited = true;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit('exit', code, signal);
  }
}

function createHarness({ probe, spawnServer, onUnexpectedExit } = {}) {
  const dir = tempDir();
  const child = new FakeChild();
  const manager = new ServerManager({
    layout: {
      kind: 'test',
      dir,
      binary: path.join(dir, 'studio'),
      assetsDir: dir,
      configTemplate: TEMPLATE,
    },
    userDataDir: dir,
    logger: { info() {}, warn() {}, error() {} },
    serverLogPath: path.join(dir, 'logs', 'server-stdout.log'),
    spawnServer: spawnServer ?? (() => child),
    probe: probe ?? (async () => {}),
    stopTimeoutMs: 100,
    onUnexpectedExit,
  });
  return { manager, child, dir };
}

test('ServerManager starts the backend, writes config/auth, and stops it', async () => {
  const { manager, child, dir } = createHarness();
  const info = await manager.start(7010);

  assert.equal(info.url, 'http://127.0.0.1:7010');
  assert.equal(manager.running, true);
  assert.equal(fs.readFileSync(path.join(dir, 'server.pid'), 'utf8'), String(child.pid));

  const config = fs.readFileSync(path.join(dir, 'config.yaml'), 'utf8');
  assert.match(config, /^Port: 7010$/m);
  assert.match(config, /^Host: 127\.0\.0\.1$/m);
  assert.ok(!config.includes('__PORT__'));

  const auth = JSON.parse(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'));
  assert.ok(auth.tokenSecret);
  assert.ok([16, 24, 32].includes(Buffer.byteLength(auth.encryptPassphrase, 'utf8')));

  await manager.stop();
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(manager.running, false);
  assert.equal(fs.existsSync(path.join(dir, 'server.pid')), false);
});

test('ServerManager fails and kills the backend when readiness fails', async () => {
  const { manager, child } = createHarness({
    probe: async () => {
      throw new Error('readiness never became available');
    },
  });

  await assert.rejects(manager.start(7011), /Studio backend failed to start/);
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(manager.running, false);
});

test('ServerManager fails fast when the backend exits before readiness', async () => {
  const { manager, child } = createHarness({ probe: () => new Promise(() => {}) });
  const starting = manager.start(7012);
  setTimeout(() => child.emitExit(1, null), 10);

  await assert.rejects(starting, /exited before it became ready/);
  assert.equal(manager.running, false);
});

test('ServerManager reports an unexpected exit after it becomes ready', async () => {
  let unexpected = null;
  const { manager, child } = createHarness({
    onUnexpectedExit: (code, signal) => {
      unexpected = { code, signal };
    },
  });

  await manager.start(7013);
  child.emitExit(2, null);
  assert.deepEqual(unexpected, { code: 2, signal: null });
  assert.equal(manager.running, false);
});

test('cleanupStaleServer terminates a matching leftover process', async () => {
  const dir = tempDir();
  const binary = path.join(dir, 'studio');
  fs.writeFileSync(binary, '');
  const pidFile = path.join(dir, 'server.pid');
  fs.writeFileSync(pidFile, '24680');

  let alive = true;
  const signals = [];
  await cleanupStaleServer({
    userDataDir: dir,
    binaryPath: binary,
    logger: { warn() {} },
    processAliveImpl: () => alive,
    readCommandImpl: () => `${binary} -f config.yaml`,
    killImpl: (_pid, signal) => {
      signals.push(signal);
      alive = false;
    },
    sleep: async () => {},
  });

  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(fs.existsSync(pidFile), false);
});

test('cleanupStaleServer never kills an unrelated PID', async () => {
  const dir = tempDir();
  const binary = path.join(dir, 'studio');
  fs.writeFileSync(binary, '');
  const pidFile = path.join(dir, 'server.pid');
  fs.writeFileSync(pidFile, '13579');

  const signals = [];
  await cleanupStaleServer({
    userDataDir: dir,
    binaryPath: binary,
    logger: { warn() {} },
    processAliveImpl: () => true,
    readCommandImpl: () => '/usr/bin/something-else',
    killImpl: (_pid, signal) => signals.push(signal),
    sleep: async () => {},
  });

  assert.deepEqual(signals, []);
  assert.equal(fs.existsSync(pidFile), false);
});
