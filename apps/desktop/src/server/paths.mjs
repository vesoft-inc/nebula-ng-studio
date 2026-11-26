import fs from 'node:fs';
import path from 'node:path';

export function serverBinaryName(platform = process.platform) {
  return platform === 'win32' ? 'studio.exe' : 'studio';
}

/**
 * Resolve the bundled Go server layout for a packaged or development run.
 *
 * The server resolves its frontend assets relative to its working directory
 * (`assets/public`), so every layout exposes the directory that must be used as
 * the child process cwd.
 */
export function resolveServerLayout({
  isPackaged,
  resourcesPath,
  appPath,
  exists = fs.existsSync,
  platform = process.platform,
}) {
  if (!appPath) throw new Error('appPath is required to resolve the Studio server layout');
  const binaryName = serverBinaryName(platform);

  if (isPackaged) {
    if (!resourcesPath) throw new Error('resourcesPath is required for a packaged app');
    const dir = path.join(resourcesPath, 'server');
    return {
      kind: 'packaged',
      dir,
      binary: path.join(dir, binaryName),
      assetsDir: path.join(dir, 'assets', 'public'),
      configTemplate: path.join(dir, 'config.yaml'),
    };
  }

  const builtDir = path.join(appPath, 'build', 'server');
  const built = {
    kind: 'dev-built',
    dir: builtDir,
    binary: path.join(builtDir, binaryName),
    assetsDir: path.join(builtDir, 'assets', 'public'),
    configTemplate: path.join(appPath, 'resources', 'config.yaml'),
  };
  if (exists(built.binary) && exists(built.assetsDir)) return built;

  const sourceDir = path.resolve(appPath, '..', 'server');
  return {
    kind: 'dev-source',
    dir: sourceDir,
    binary: path.join(sourceDir, 'bin', binaryName),
    assetsDir: path.join(sourceDir, 'assets', 'public'),
    configTemplate: path.join(appPath, 'resources', 'config.yaml'),
  };
}

/** Return human-readable problems with a resolved server layout. */
export function validateServerLayout(layout, { exists = fs.existsSync, platform = process.platform } = {}) {
  const errors = [];
  const required = [
    ['binary', 'Studio server binary'],
    ['assetsDir', 'Studio frontend assets'],
    ['configTemplate', 'Studio server config template'],
  ];

  for (const [key, label] of required) {
    const value = layout?.[key];
    if (!value) {
      errors.push(`${label} path is missing`);
    } else if (!exists(value)) {
      errors.push(`${label} not found: ${value}`);
    }
  }

  // The executable bit is not meaningful on Windows; the .exe extension is.
  if (platform !== 'win32' && layout?.binary && exists(layout.binary)) {
    try {
      fs.accessSync(layout.binary, fs.constants.X_OK);
    } catch {
      errors.push(`Studio server binary is not executable: ${layout.binary}`);
    }
  }

  return errors;
}

export function describeServerLayout(layout) {
  if (!layout) return 'unknown';
  return `${layout.kind} (binary: ${layout.binary})`;
}
