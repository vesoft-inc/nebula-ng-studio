import { app, dialog, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseExternalStudioUrl } from './external-url.mjs';
import { createLogger, tailFile } from './logging.mjs';
import { buildApplicationMenu } from './menu.mjs';
import { configureSession, hardenWebContents } from './session.mjs';
import { chooseServerPort, DEFAULT_PORT, UserQuitError } from './server/config.mjs';
import { cleanupStaleServer, ServerManager } from './server/manager.mjs';
import { describeServerLayout, resolveServerLayout, validateServerLayout } from './server/paths.mjs';
import { createMainWindow, loadSplash } from './window.mjs';

const APP_NAME = 'NebulaGraph Studio';
const DEV_APP_NAME = 'NebulaGraph Studio Dev';
const SMOKE = process.argv.includes('--smoke-test');
const USER_DATA_OVERRIDE = process.env.STUDIO_DESKTOP_USER_DATA;
const DEFAULT_SMOKE_DIR = path.join(os.tmpdir(), 'NebulaGraph Studio Smoke');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.setName(APP_NAME);

const appDataDir = app.getPath('appData');
const userDataDir =
  USER_DATA_OVERRIDE || (SMOKE ? DEFAULT_SMOKE_DIR : path.join(appDataDir, app.isPackaged ? APP_NAME : DEV_APP_NAME));

if (SMOKE && !USER_DATA_OVERRIDE) fs.rmSync(userDataDir, { recursive: true, force: true });
fs.mkdirSync(userDataDir, { recursive: true });
app.setPath('userData', userDataDir);
app.setPath('logs', path.join(userDataDir, 'logs'));
if (SMOKE) {
  app.setPath('sessionData', path.join(userDataDir, 'session'));
  app.setPath('crashDumps', path.join(userDataDir, 'crash-dumps'));
}

let mainWindow = null;
let serverManager = null;
let serverInfo = null;
let studioUrl = null;
let activeServerOrigin = null;
let logger = null;
let quitting = false;
let shuttingDown = false;
let quitReady = false;
let quitStopStarted = false;

const getServerOrigin = () => activeServerOrigin;

function getLogsDir() {
  return path.join(userDataDir, 'logs');
}

function readAppVersion() {
  if (app.isPackaged) return app.getVersion();
  try {
    const webManifest = path.resolve(app.getAppPath(), '..', 'web', 'package.json');
    return JSON.parse(fs.readFileSync(webManifest, 'utf8')).version ?? app.getVersion();
  } catch {
    return app.getVersion();
  }
}

function installProcessHandlers() {
  process.on('uncaughtException', (error) => {
    logger?.error(`Uncaught exception: ${error?.stack ?? error}`);
    if (app.isReady() && !SMOKE) {
      dialog.showErrorBox('NebulaGraph Studio encountered an unexpected error', String(error?.stack ?? error));
    }
    app.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger?.error(`Unhandled rejection: ${reason?.stack ?? reason}`);
  });
  process.on('SIGINT', () => {
    shuttingDown = true;
    app.quit();
  });
  process.on('SIGTERM', () => {
    shuttingDown = true;
    app.quit();
  });
}

async function stopBackend() {
  if (!serverManager) return;
  try {
    await serverManager.stop();
  } catch (error) {
    logger?.error(`Failed to stop Studio backend: ${error.message}`);
  }
}

async function fatal(message, detail) {
  logger?.error(`${message}: ${detail}`);
  if (shuttingDown || quitting) {
    await stopBackend();
    return;
  }
  if (SMOKE) {
    process.stdout.write(`DESKTOP_SMOKE_RESULT ${JSON.stringify({ ok: false, error: `${message}: ${detail}` })}\n`);
    await stopBackend();
    app.exit(1);
    return;
  }

  const choice = dialog.showMessageBoxSync({
    type: 'error',
    message,
    detail: `${detail}\n\nLogs: ${getLogsDir()}`,
    buttons: ['Open Logs', 'Quit'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  if (choice === 0) await shell.openPath(getLogsDir());
  await stopBackend();
  app.exit(1);
}

function showPortConflictDialog(port) {
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    message: `Port ${port} is already in use`,
    detail:
      `NebulaGraph Studio uses port ${DEFAULT_PORT} so that your login session and preferences ` +
      'persist between launches. Stop the program using this port and choose Retry, or use a ' +
      'different port for this session only.',
    buttons: ['Retry', 'Use a Different Port', 'Quit'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
  });
  return ['retry', 'fallback', 'quit'][choice] ?? 'quit';
}

async function loadStudio(window, url) {
  await window.loadURL(url);
}

async function waitForRenderer(window, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (window.isDestroyed()) throw new Error('The Studio window was closed during startup');
    const ready = await window.webContents.executeJavaScript(
      "Boolean(document.querySelector('#studioApp') && document.querySelector('#studioApp').children.length)"
    );
    if (ready) return;
    await delay(250);
  }
  throw new Error('Studio did not finish rendering within 30 seconds');
}

async function runSmoke(window, info) {
  try {
    await loadStudio(window, info.url);
    await waitForRenderer(window);

    const page = await window.webContents.executeJavaScript(
      `({
        title: document.title,
        path: location.pathname,
        appReady: Boolean(document.querySelector('#studioApp') && document.querySelector('#studioApp').children.length)
      })`
    );

    if (!page.appReady) throw new Error('Studio application root is empty');
    if (page.path !== '/login') throw new Error(`Expected the login page, got ${page.path}`);

    let image = await window.webContents.capturePage();
    if (image.isEmpty()) {
      window.showInactive();
      await delay(750);
      image = await window.webContents.capturePage();
    }

    const screenshot = path.join(userDataDir, 'smoke-login.png');
    fs.writeFileSync(screenshot, image.toPNG());

    process.stdout.write(
      `DESKTOP_SMOKE_RESULT ${JSON.stringify({
        ok: true,
        url: info.url,
        port: info.port,
        title: page.title,
        path: page.path,
        screenshot,
        version: readAppVersion(),
      })}\n`
    );
    await stopBackend();
    app.exit(0);
  } catch (error) {
    process.stdout.write(
      `DESKTOP_SMOKE_RESULT ${JSON.stringify({
        ok: false,
        error: String(error?.stack ?? error),
        serverLogTail: tailFile(path.join(userDataDir, 'logs', 'server-stdout.log')),
      })}\n`
    );
    await stopBackend();
    app.exit(1);
  }
}

async function restartBackend() {
  if (shuttingDown || quitting) return;
  const portInfo = await chooseServerPort({
    preferred: serverInfo?.port ?? DEFAULT_PORT,
    envPort: process.env.STUDIO_DESKTOP_PORT,
    allowFallback: true,
  });
  serverInfo = await serverManager.start(portInfo.port);
  activeServerOrigin = serverInfo.url;
  studioUrl = serverInfo.url;
  logger?.info(`Studio backend restarted at ${serverInfo.url}`);

  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow({ userDataDir, show: true });
    hardenWebContents(mainWindow.webContents, getServerOrigin);
    await loadSplash(mainWindow, app.getAppPath());
  }
  await loadStudio(mainWindow, serverInfo.url);
}

async function handleUnexpectedServerExit(code, signal) {
  if (quitting || shuttingDown) return;
  logger?.error(`Studio backend exited unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'})`);

  if (SMOKE) {
    process.stdout.write(
      `DESKTOP_SMOKE_RESULT ${JSON.stringify({ ok: false, error: 'Studio backend exited unexpectedly' })}\n`
    );
    app.exit(1);
    return;
  }

  const options = {
    type: 'error',
    message: 'The local Studio service stopped unexpectedly',
    detail: `Exit code: ${code ?? 'none'}\nSignal: ${signal ?? 'none'}\n\nLogs: ${getLogsDir()}`,
    buttons: ['Restart', 'Quit'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  };
  const choice =
    mainWindow && !mainWindow.isDestroyed()
      ? dialog.showMessageBoxSync(mainWindow, options)
      : dialog.showMessageBoxSync(options);

  if (choice === 1) {
    app.quit();
    return;
  }

  try {
    await restartBackend();
  } catch (error) {
    await fatal('Could not restart the local Studio service', error.message);
  }
}

function registerQuitHandling() {
  app.on('before-quit', (event) => {
    if (quitReady) return;
    event.preventDefault();
    quitting = true;
    shuttingDown = true;
    if (quitStopStarted) return;
    quitStopStarted = true;
    stopBackend().finally(() => {
      quitReady = true;
      app.quit();
    });
  });
}

function registerWindowLifecycle() {
  app.on('activate', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    const targetUrl = serverInfo?.url ?? studioUrl;
    if (!targetUrl) return;
    try {
      mainWindow = createMainWindow({ userDataDir, show: true });
      hardenWebContents(mainWindow.webContents, getServerOrigin);
      await loadSplash(mainWindow, app.getAppPath());
      await loadStudio(mainWindow, targetUrl);
    } catch (error) {
      await fatal('Could not reopen the Studio window', error.message);
    }
  });

  app.on('window-all-closed', () => {
    // macOS convention: keep the app and its local backend alive in the Dock.
    if (process.platform !== 'darwin') app.quit();
  });
}

async function boot() {
  await app.whenReady();

  logger = createLogger(path.join(getLogsDir(), 'desktop.log'), { echo: !app.isPackaged });
  installProcessHandlers();
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: readAppVersion(),
    copyright: 'Copyright © Vesoft Inc.',
  });

  if (!app.isPackaged && app.dock) {
    const devIcon = path.join(app.getAppPath(), 'resources', 'icon.png');
    if (fs.existsSync(devIcon)) app.dock.setIcon(devIcon);
  }

  const externalUrl = process.env.STUDIO_DESKTOP_URL?.trim();
  const window = createMainWindow({ userDataDir, show: !SMOKE });
  mainWindow = window;
  configureSession('persist:studio');
  hardenWebContents(window.webContents, getServerOrigin);
  buildApplicationMenu({
    isDev: !app.isPackaged,
    onOpenDataFolder: () => shell.openPath(userDataDir),
    onOpenLogs: () => shell.openPath(getLogsDir()),
  });

  if (!SMOKE) await loadSplash(window, app.getAppPath());

  if (externalUrl && !SMOKE) {
    let external;
    try {
      external = parseExternalStudioUrl(externalUrl);
    } catch (error) {
      await fatal('Invalid STUDIO_DESKTOP_URL', error.message);
      return;
    }
    if (!external) return;
    activeServerOrigin = external.origin;
    studioUrl = external.url;
    logger.info(`Using external Studio URL ${external.url}`);
    try {
      await loadStudio(window, external.url);
    } catch (error) {
      await fatal('Failed to load the external Studio URL', error.message);
      return;
    }
    registerWindowLifecycle();
    return;
  }

  const layout = resolveServerLayout({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
  const layoutErrors = validateServerLayout(layout);
  if (layoutErrors.length > 0) {
    await fatal(
      'The Studio desktop package is incomplete',
      `${describeServerLayout(layout)}\n\n${layoutErrors.join('\n')}`
    );
    return;
  }

  logger.info(`Desktop boot: app=${readAppVersion()} packaged=${app.isPackaged} layout=${layout.kind}`);
  await cleanupStaleServer({ userDataDir, binaryPath: layout.binary, logger });

  let portInfo;
  try {
    portInfo = await chooseServerPort({
      envPort: process.env.STUDIO_DESKTOP_PORT,
      allowFallback: SMOKE,
      confirmFallback: showPortConflictDialog,
    });
  } catch (error) {
    if (error instanceof UserQuitError) {
      app.quit();
      return;
    }
    await fatal('Could not prepare the local Studio service', error.message);
    return;
  }

  if (portInfo.fallback) {
    logger.warn(`Port ${DEFAULT_PORT} was unavailable; using ${portInfo.port} for this session`);
  }

  serverManager = new ServerManager({
    layout,
    userDataDir,
    logger,
    serverLogPath: path.join(getLogsDir(), 'server-stdout.log'),
    echoServerOutput: !app.isPackaged,
    onUnexpectedExit: (code, signal) => {
      if (shuttingDown || quitting) return;
      handleUnexpectedServerExit(code, signal).catch((error) => {
        logger?.error(`Unexpected-exit handler failed: ${error.message}`);
      });
    },
  });

  try {
    serverInfo = await serverManager.start(portInfo.port);
  } catch (error) {
    if (shuttingDown || quitting) return;
    await fatal('The local Studio service failed to start', error.message);
    return;
  }
  activeServerOrigin = serverInfo.url;
  studioUrl = serverInfo.url;

  if (SMOKE) {
    await runSmoke(window, serverInfo);
    return;
  }

  try {
    await loadStudio(window, serverInfo.url);
  } catch (error) {
    await fatal('Failed to load NebulaGraph Studio', error.message);
    return;
  }

  registerWindowLifecycle();
}

registerQuitHandling();

if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  boot().catch(async (error) => {
    await fatal('NebulaGraph Studio failed to start', String(error?.stack ?? error));
  });
}
