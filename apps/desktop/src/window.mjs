import { app, BrowserWindow, nativeTheme, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;

const WINDOW_STATE_FILE = 'window-state.json';

function windowStatePath(userDataDir) {
  return path.join(userDataDir, WINDOW_STATE_FILE);
}

function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function defaultBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(DEFAULT_WIDTH, workArea.width);
  const height = Math.min(DEFAULT_HEIGHT, workArea.height);
  return {
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  };
}

export function readWindowState(userDataDir) {
  try {
    const state = JSON.parse(fs.readFileSync(windowStatePath(userDataDir), 'utf8'));
    const bounds = state?.bounds;
    if (
      bounds &&
      Number.isFinite(bounds.x) &&
      Number.isFinite(bounds.y) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height) &&
      bounds.width >= MIN_WIDTH &&
      bounds.height >= MIN_HEIGHT
    ) {
      return { bounds, maximized: Boolean(state.maximized) };
    }
  } catch {
    // First launch, or a corrupt state file.
  }
  return null;
}

export function saveWindowState(window, userDataDir) {
  if (!window || window.isDestroyed()) return;
  const state = {
    bounds: window.isMaximized() ? window.getNormalBounds() : window.getBounds(),
    maximized: window.isMaximized(),
  };
  try {
    fs.writeFileSync(windowStatePath(userDataDir), `${JSON.stringify(state, null, 2)}\n`, {
      mode: 0o600,
    });
  } catch {
    // Window state is a convenience; never block quit.
  }
}

function linuxWindowIcon() {
  if (process.platform !== 'linux') return undefined;
  const candidate = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'resources', 'icon.png');
  return fs.existsSync(candidate) ? candidate : undefined;
}

export function createMainWindow({ userDataDir, show = true }) {
  const saved = readWindowState(userDataDir);
  const bounds =
    saved?.bounds && screen.getAllDisplays().some((display) => intersects(saved.bounds, display.workArea))
      ? saved.bounds
      : defaultBounds();

  const window = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'NebulaGraph Studio',
    icon: linuxWindowIcon(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101418' : '#ffffff',
    webPreferences: {
      partition: 'persist:studio',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  window.once('ready-to-show', () => {
    if (saved?.maximized) window.maximize();
    if (show) window.show();
  });
  window.on('close', () => saveWindowState(window, userDataDir));

  return window;
}

export function loadSplash(window, appPath) {
  return window.loadFile(path.join(appPath, 'src', 'loading.html'));
}
