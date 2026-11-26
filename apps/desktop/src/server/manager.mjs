import { execFileSync, spawn as nodeSpawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readOrCreateAuthSecrets, renderConfigTemplate, writeFileAtomic } from './config.mjs';
import { rotateIfNeeded, tailFile } from '../logging.mjs';

export const READY_PATH = '/api-studio/health/ready';
export const DEFAULT_READY_TIMEOUT_MS = 60_000;
export const DEFAULT_STOP_TIMEOUT_MS = 5_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the Studio backend reports that its database is ready. The
 * liveness endpoint answers before migrations finish, so readiness is the signal
 * the renderer should wait for.
 */
export async function probeReady(
  baseUrl,
  {
    timeoutMs = DEFAULT_READY_TIMEOUT_MS,
    intervalMs = 250,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    sleep = delay,
  } = {}
) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const deadline = now() + timeoutMs;
  let lastError;

  while (now() < deadline) {
    const remaining = Math.max(250, deadline - now());
    try {
      const response = await fetchImpl(`${baseUrl}${READY_PATH}`, {
        signal: AbortSignal.timeout(Math.min(2_000, remaining)),
      });
      if (response.ok) return;
      lastError = new Error(`readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }

  const suffix = lastError ? `: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${baseUrl}${READY_PATH}${suffix}`);
}

function defaultSpawn({ command, args, cwd, env, stdio }) {
  return nodeSpawn(command, args, {
    cwd,
    env,
    stdio,
    windowsHide: process.platform === 'win32',
  });
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function readWindowsProcessCommand(pid) {
  try {
    const command = `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue).CommandLine`;
    const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim();
    if (output) return output;
  } catch {
    // Fall through to wmic on older/restricted systems.
  }

  try {
    const output = execFileSync('wmic', ['process', 'where', `processid=${pid}`, 'get', 'commandline', '/value'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const line = output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.startsWith('CommandLine='));
    return line ? line.slice('CommandLine='.length) : '';
  } catch {
    return '';
  }
}

function readProcessCommand(pid, platform = process.platform) {
  if (platform === 'win32') return readWindowsProcessCommand(pid);
  const ps = fs.existsSync('/bin/ps') ? '/bin/ps' : 'ps';
  try {
    return execFileSync(ps, ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Remove a backend process left behind by a previous crash (for example when
 * the Electron main process was killed). Only kill it when the recorded PID
 * still belongs to the bundled Studio server.
 */
export async function cleanupStaleServer({
  userDataDir,
  binaryPath,
  logger,
  platform = process.platform,
  processAliveImpl = processAlive,
  readCommandImpl,
  killImpl = process.kill,
  sleep = delay,
  timeoutMs = 2_000,
}) {
  const pidFile = path.join(userDataDir, 'server.pid');
  let pid;
  try {
    pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
  } catch {
    return;
  }

  if (Number.isInteger(pid) && pid > 0 && processAliveImpl(pid)) {
    const command = readCommandImpl ? readCommandImpl(pid) : readProcessCommand(pid, platform);
    if (binaryPath && command.includes(binaryPath)) {
      logger?.warn(`Stopping stale Studio backend process ${pid}`);
      try {
        killImpl(pid, 'SIGTERM');
      } catch {
        // The process may have exited between the checks.
      }
      for (let waited = 0; waited < timeoutMs && processAliveImpl(pid); waited += 100) {
        await sleep(100);
      }
      if (processAliveImpl(pid)) {
        try {
          killImpl(pid, 'SIGKILL');
        } catch {
          // Already gone.
        }
      }
    }
  }

  fs.rmSync(pidFile, { force: true });
}

export class ServerManager {
  constructor({
    layout,
    userDataDir,
    logger,
    serverLogPath,
    spawnServer = defaultSpawn,
    probe = probeReady,
    readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
    stopTimeoutMs = DEFAULT_STOP_TIMEOUT_MS,
    onUnexpectedExit,
    env = process.env,
    echoServerOutput = false,
    platform = process.platform,
  }) {
    if (!layout) throw new Error('layout is required');
    if (!userDataDir) throw new Error('userDataDir is required');
    this.layout = layout;
    this.userDataDir = userDataDir;
    this.logger = logger;
    this.serverLogPath = serverLogPath ?? path.join(userDataDir, 'logs', 'server-stdout.log');
    this.spawnServer = spawnServer;
    this.probe = probe;
    this.readyTimeoutMs = readyTimeoutMs;
    this.stopTimeoutMs = stopTimeoutMs;
    this.onUnexpectedExit = onUnexpectedExit;
    this.env = env;
    this.echoServerOutput = echoServerOutput;
    this.platform = platform;
    this.child = null;
    this.pid = null;
    this.url = null;
    this.starting = false;
    this.stopping = false;
  }

  get running() {
    return Boolean(this.child);
  }

  get pidFile() {
    return path.join(this.userDataDir, 'server.pid');
  }

  appendServerOutput(chunk) {
    fs.appendFileSync(this.serverLogPath, chunk);
    if (this.echoServerOutput) process.stdout.write(chunk);
  }

  handleExit(code, signal) {
    const wasRunning = Boolean(this.child);
    this.child = null;
    this.pid = null;
    fs.rmSync(this.pidFile, { force: true });
    if (wasRunning && !this.stopping && !this.starting) {
      this.onUnexpectedExit?.(code, signal);
    }
  }

  async start(port) {
    if (this.child) throw new Error('Studio backend is already running');
    this.starting = true;
    this.stopping = false;

    try {
      const dataDir = path.join(this.userDataDir, 'data');
      const logDir = path.join(this.userDataDir, 'logs');
      fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
      fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });
      fs.mkdirSync(path.dirname(this.serverLogPath), { recursive: true, mode: 0o700 });
      rotateIfNeeded(this.serverLogPath);

      const secrets = readOrCreateAuthSecrets(path.join(this.userDataDir, 'auth.json'));
      const template = fs.readFileSync(this.layout.configTemplate, 'utf8');
      const config = renderConfigTemplate(template, {
        port,
        dataDir,
        logDir,
        platform: this.platform,
      });
      const configPath = path.join(this.userDataDir, 'config.yaml');
      writeFileAtomic(configPath, config, 0o600);

      const childEnv = {
        ...this.env,
        STUDIO_TOKEN_SECRET: secrets.tokenSecret,
        STUDIO_ENCRYPT_PASSPHRASE: secrets.encryptPassphrase,
      };
      const child = this.spawnServer({
        command: this.layout.binary,
        args: ['-f', configPath],
        cwd: this.layout.dir,
        env: childEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      this.url = `http://127.0.0.1:${port}`;

      await new Promise((resolve, reject) => {
        if (typeof child.pid === 'number') return resolve();
        child.once('spawn', resolve);
        child.once('error', reject);
      });

      this.pid = child.pid;
      fs.writeFileSync(this.pidFile, String(child.pid), { mode: 0o644 });

      child.stdout?.on('data', (chunk) => this.appendServerOutput(chunk.toString()));
      child.stderr?.on('data', (chunk) => this.appendServerOutput(chunk.toString()));
      child.on('error', (error) => {
        this.logger?.error(`Studio backend process error: ${error.message}`);
      });
      child.once('exit', (code, signal) => this.handleExit(code, signal));

      const exitBeforeReady = new Promise((_, reject) => {
        child.once('exit', (code, signal) => {
          reject(
            new Error(
              `Studio backend exited before it became ready (code ${code ?? 'none'}, signal ${signal ?? 'none'})`
            )
          );
        });
      });

      await Promise.race([this.probe(this.url, { timeoutMs: this.readyTimeoutMs }), exitBeforeReady]);
      if (!this.child) throw new Error('Studio backend exited during startup');

      this.starting = false;
      this.logger?.info(`Studio backend ready at ${this.url} (pid ${child.pid})`);
      return { url: this.url, port, pid: child.pid };
    } catch (error) {
      this.starting = false;
      if (this.child) {
        await this.stop();
      } else {
        this.pid = null;
        fs.rmSync(this.pidFile, { force: true });
      }
      const tail = tailFile(this.serverLogPath);
      throw new Error(`Studio backend failed to start: ${error.message}${tail ? `\n\n${tail}` : ''}`);
    }
  }

  async stop() {
    const child = this.child;
    this.starting = false;
    this.stopping = true;
    if (!child) {
      fs.rmSync(this.pidFile, { force: true });
      return;
    }

    if (child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      this.pid = null;
      fs.rmSync(this.pidFile, { force: true });
      return;
    }

    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // Already gone.
        }
        finish();
      }, this.stopTimeoutMs);

      child.once('exit', finish);
      try {
        child.kill('SIGTERM');
      } catch {
        finish();
      }
    });

    this.child = null;
    this.pid = null;
    fs.rmSync(this.pidFile, { force: true });
    this.logger?.info('Studio backend stopped');
  }
}
