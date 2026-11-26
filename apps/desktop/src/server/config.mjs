import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const DEFAULT_PORT = 7001;
export const MAX_FALLBACK_PORT = 7099;
export const PORT_PLACEHOLDER = '__PORT__';
export const DB_PLACEHOLDER = '__DB_PATH__';
export const LOG_PLACEHOLDER = '__LOG_DIR__';

export class UserQuitError extends Error {
  constructor() {
    super('The user cancelled desktop startup');
    this.name = 'UserQuitError';
  }
}

export function parsePort(value) {
  if (value === undefined || value === null || value === '') return null;
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/** Quote a value for a YAML single-quoted scalar ('' is the only escape). */
export function yamlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * SQLite DSNs and go-zero log paths are more reliable with forward slashes on
 * Windows (`file:C:/Users/.../studio.db?...`). Paths on other platforms are
 * already POSIX.
 */
export function toConfigPath(value, platform = process.platform) {
  return platform === 'win32' ? String(value).replaceAll('\\', '/') : String(value);
}

export function renderConfigTemplate(template, { port, dataDir, logDir, platform = process.platform }) {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid Studio server port: ${port}`);
  }
  if (!dataDir || !logDir) throw new Error('dataDir and logDir are required');

  const dbPath = toConfigPath(path.join(dataDir, 'studio.db'), platform);
  const rendered = template
    .replaceAll(PORT_PLACEHOLDER, String(port))
    .replaceAll(DB_PLACEHOLDER, yamlQuote(dbPath))
    .replaceAll(LOG_PLACEHOLDER, yamlQuote(toConfigPath(logDir, platform)));

  const leftover = rendered.match(/__[A-Z][A-Z0-9_]*__/);
  if (leftover) throw new Error(`Unresolved Studio config placeholder: ${leftover[0]}`);
  return rendered;
}

function validPassphrase(value) {
  return typeof value === 'string' && [16, 24, 32].includes(Buffer.byteLength(value, 'utf8'));
}

function validAuthSecrets(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.tokenSecret === 'string' &&
    value.tokenSecret.length > 0 &&
    validPassphrase(value.encryptPassphrase)
  );
}

export function createAuthSecrets(randomBytes = crypto.randomBytes) {
  return {
    tokenSecret: randomBytes(32).toString('base64url'),
    encryptPassphrase: randomBytes(24).toString('base64url'),
  };
}

/**
 * Reuse the desktop's auth secrets across launches so the HttpOnly session
 * cookie remains valid after a restart. The file is owner-only.
 */
export function readOrCreateAuthSecrets(file, { randomBytes = crypto.randomBytes } = {}) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (validAuthSecrets(parsed)) {
      try {
        fs.chmodSync(file, 0o600);
      } catch {
        // Best effort; the file is already readable by this user.
      }
      return { tokenSecret: parsed.tokenSecret, encryptPassphrase: parsed.encryptPassphrase };
    }
  } catch {
    // Missing or corrupt file: generate a fresh pair below.
  }

  const secrets = createAuthSecrets(randomBytes);
  writeFileAtomic(file, `${JSON.stringify(secrets, null, 2)}\n`, 0o600);
  return secrets;
}

export function writeFileAtomic(file, contents, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, contents, { mode });
  fs.chmodSync(temporary, mode);
  fs.renameSync(temporary, file);
}

export function isPortAvailable(port, { host = '127.0.0.1' } = {}) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(start, end = MAX_FALLBACK_PORT, isAvailable = isPortAvailable) {
  for (let port = start; port <= end; port += 1) {
    if (await isAvailable(port)) return port;
  }
  throw new Error(`No free local port between ${start} and ${end}`);
}

/**
 * Pick the local Studio port. 7001 stays the default because the origin (and
 * therefore the login cookie and localStorage) must remain stable across
 * launches. When it is busy the caller decides whether to retry, fall back for
 * this session, or quit.
 */
export async function chooseServerPort({
  preferred = DEFAULT_PORT,
  end = MAX_FALLBACK_PORT,
  envPort,
  allowFallback = false,
  isAvailable = isPortAvailable,
  confirmFallback,
} = {}) {
  if (envPort !== undefined && envPort !== null && envPort !== '') {
    const port = parsePort(envPort);
    if (!port) {
      throw new Error(`STUDIO_DESKTOP_PORT must be an integer between 1 and 65535 (received "${envPort}")`);
    }
    if (!(await isAvailable(port))) {
      throw new Error(`STUDIO_DESKTOP_PORT=${port} is already in use`);
    }
    return { port, fallback: false, source: 'environment' };
  }

  if (await isAvailable(preferred)) {
    return { port: preferred, fallback: false, source: 'default' };
  }

  if (allowFallback) {
    const port = await findAvailablePort(preferred + 1, end, isAvailable);
    return { port, fallback: true, source: 'fallback' };
  }

  if (typeof confirmFallback !== 'function') {
    throw new Error(`Port ${preferred} is already in use`);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const action = await confirmFallback(preferred);
    if (action === 'retry') {
      if (await isAvailable(preferred)) {
        return { port: preferred, fallback: false, source: 'default' };
      }
      continue;
    }
    if (action === 'fallback') {
      const port = await findAvailablePort(preferred + 1, end, isAvailable);
      return { port, fallback: true, source: 'fallback' };
    }
    throw new UserQuitError();
  }
}
