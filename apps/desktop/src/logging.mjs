import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_LOG_BYTES = 5 * 1024 * 1024;

/** Rotate a log file to `<file>.1` once it exceeds the size limit. */
export function rotateIfNeeded(file, maxBytes = DEFAULT_MAX_LOG_BYTES) {
  try {
    if (fs.statSync(file).size > maxBytes) fs.renameSync(file, `${file}.1`);
  } catch {
    // No existing log file.
  }
}

export function createLogger(file, { echo = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  rotateIfNeeded(file);

  const write = (level, message) => {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}\n`;
    fs.appendFileSync(file, line);
    if (echo) process.stdout.write(line);
  };

  return {
    file,
    info: (message) => write('info', message),
    warn: (message) => write('warn', message),
    error: (message) => write('error', message),
    writeRaw: (chunk) => {
      fs.appendFileSync(file, chunk);
      if (echo) process.stdout.write(chunk);
    },
  };
}

/** Read the tail of a log file for error dialogs. */
export function tailFile(file, lines = 25) {
  try {
    const text = fs.readFileSync(file, 'utf8').trimEnd();
    if (!text) return '';
    return text.split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}
