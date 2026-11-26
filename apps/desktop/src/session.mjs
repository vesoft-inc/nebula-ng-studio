import { app, session, shell } from 'electron';
import path from 'node:path';

const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write']);

function sameOrigin(url, allowedOrigin) {
  if (!allowedOrigin) return false;
  try {
    return new URL(url).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

function isExternalUrl(url) {
  return /^(https?:|mailto:)/i.test(url);
}

function openExternal(url) {
  if (isExternalUrl(url)) {
    shell.openExternal(url).catch(() => {
      // Opening an external link is best effort.
    });
  }
}

export function hardenWebContents(contents, getServerOrigin) {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    const serverOrigin = getServerOrigin();
    if (sameOrigin(url, serverOrigin)) return;
    // The only local file navigation is the startup splash page, which is
    // loaded before the backend origin exists.
    if (!serverOrigin && url.startsWith('file://')) return;
    event.preventDefault();
    openExternal(url);
  });

  contents.on('will-attach-webview', (event) => event.preventDefault());
}

export function configureSession(partition) {
  const appSession = session.fromPartition(partition);

  appSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  appSession.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSIONS.has(permission);
  });

  // Let Electron's built-in save dialog handle CSV/JSON/PNG exports, but point
  // it at ~/Downloads and keep the suggested filename.
  appSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: 'Save File',
      defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
    });
  });

  return appSession;
}
