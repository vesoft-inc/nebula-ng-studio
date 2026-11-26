# NebulaGraph Studio Desktop

This package wraps the existing NebulaGraph Studio web application in Electron. The
application is not a thin shell around a remote site: the bundled Go Studio server
serves the frontend **and** exposes `/api-studio`, so the desktop app works with any
reachable NebulaGraph 5.x deployment without a separate Studio installation.

## Supported targets

| Platform          | Artifacts                                   | Notes                                        |
| ----------------- | ------------------------------------------- | -------------------------------------------- |
| macOS arm64 / x64 | `.app`, `.dmg`, `.zip`                      | Ad-hoc signed, not notarized                 |
| Windows x64       | NSIS `.exe`, `.zip`, `win-unpacked/`        | Unsigned; SmartScreen may warn               |
| Linux x64         | `.AppImage`, `.deb`, `.tar.gz`, `linux-unpacked/` | Unsigned                              |

`pnpm desktop:build` builds the host platform. On macOS it builds **both** arm64 and
x64 by default. Windows and Linux builds are native because the Go server uses CGO
for SQLite; the desktop CI matrix runs one native job per platform.

## Prerequisites

Common:

- Go 1.25+ (the `apps/server` module pins its toolchain; Go downloads it if needed)
- Node.js >= 22.12 and pnpm 9.12.2
- Network access for the first Electron download; in restricted networks set
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` before installing

Platform-specific CGO compiler:

- macOS: Xcode Command Line Tools (`xcode-select --install`). Apple Silicon can build
  both arm64 and x64 with clang.
- Windows: MinGW-w64 with `gcc` on `PATH` (for example `choco install mingw`).
- Linux: `gcc` (for example `sudo apt-get install build-essential`).

## Build and run

```bash
pnpm install
pnpm desktop:build
```

Outputs go to `apps/desktop/release/`:

- macOS: `NebulaGraph-Studio-<version>-mac-{arm64,x64}.{dmg,zip}` and the corresponding
  `mac-arm64/` / `mac/` app directories.
- Windows: `NebulaGraph-Studio-<version>-win-x64.{exe,zip}` and `win-unpacked/`.
- Linux: `NebulaGraph-Studio-<version>-linux-x64.{AppImage,deb,tar.gz}` and
  `linux-unpacked/`.

Open/install:

```bash
# macOS
open "apps/desktop/release/mac-arm64/NebulaGraph Studio.app"
# Windows
start "" "apps\desktop\release\NebulaGraph-Studio-<version>-win-x64.exe"
# Linux
chmod +x apps/desktop/release/NebulaGraph-Studio-<version>-linux-x64.AppImage
```

`pnpm desktop:build` performs the full pipeline:

1. builds `apps/web` and copies the output to `apps/server/assets/public`;
2. builds the Go server for the target platform/arch with the web package version and
   Git metadata;
3. assembles `apps/desktop/build/server` (binary, assets, config template, license);
4. packages the Electron app and platform installers.

Other commands:

```bash
pnpm desktop:pack     # app bundle only, faster iteration
pnpm desktop:verify   # structure + architecture + installers + packaged smoke test
pnpm desktop:test     # unit tests (pure Node)
pnpm desktop:dev      # launch Electron using an existing desktop/server build
```

Useful build flags:

```bash
node apps/desktop/scripts/build.mjs --arch arm64          # one mac architecture
node apps/desktop/scripts/build.mjs --arch x64
node apps/desktop/scripts/build.mjs --output /tmp/studio  # build without touching release/
node apps/desktop/scripts/build.mjs --skip-web            # Electron-only iteration
node apps/desktop/scripts/build.mjs --force               # rebuild while the app is running
```

`STUDIO_DESKTOP_SKIP_WEB=1` is the environment-variable form of `--skip-web`.
`pnpm desktop:build` refuses to overwrite `release/` while NebulaGraph Studio is
running; quit the app or use `--output`.

## Verification

`pnpm desktop:verify` checks each packaged app's executable and bundled Go server
architecture, resources, installer artifacts, `SHA256SUMS`, and (where the host can run
that architecture) the packaged `--smoke-test`. On macOS the x64 app is launched through
Rosetta when available; on Linux CI it runs under `xvfb-run`.

The cross-platform workflow is [`.github/workflows/desktop.yml`](../../.github/workflows/desktop.yml):

- macOS arm64 + x64
- Windows x64 (installs MinGW-w64 for CGO when needed)
- Linux x64 (xvfb for the smoke test)

Each job uploads its installers and `SHA256SUMS` as a workflow artifact.

## Development

`pnpm desktop:dev` starts the packaged-style sidecar using `apps/desktop/build/server`
when present, otherwise `apps/server/bin/studio` plus `apps/server/assets/public`.

For web hot reload, run three terminals:

```bash
pnpm dev:server
pnpm dev
STUDIO_DESKTOP_URL=http://127.0.0.1:3000 pnpm --filter nebula-studio-desktop dev
```

The Vite dev server proxies `/api` to the Go server on `127.0.0.1:7001`.

## Runtime data

| Platform | Data directory |
| --- | --- |
| macOS | `~/Library/Application Support/NebulaGraph Studio/` |
| Windows | `%APPDATA%\NebulaGraph Studio\` |
| Linux | `~/.config/NebulaGraph Studio/` |

```
config.yaml          generated on every launch, owner-only
auth.json            stable desktop auth secrets
data/studio.db       SQLite database (plus -wal/-shm)
logs/                desktop.log, server-stdout.log, Go server logs
window-state.json
```

Development launches use a separate `NebulaGraph Studio Dev` directory. Override with
`STUDIO_DESKTOP_USER_DATA`. Delete the folder to reset the desktop app (this does not
touch your NebulaGraph data).

The bundled server binds to `127.0.0.1` only. Port `7001` is preferred so the browser
origin stays stable and the login session/localStorage survive restarts. If `7001` is
already in use, the app asks whether to retry, use another port for this session, or
quit. Set `STUDIO_DESKTOP_PORT` to force a specific port.

| Variable                   | Purpose                                                   |
| -------------------------- | --------------------------------------------------------- |
| `STUDIO_DESKTOP_PORT`      | Force the local Studio port (fails if it is busy)         |
| `STUDIO_DESKTOP_USER_DATA` | Override the Application Support data directory           |
| `STUDIO_DESKTOP_URL`       | Load an existing Studio URL and skip spawning the sidecar |

## Signing and distribution

The default builds are **not code-signed for distribution**:

- macOS uses ad-hoc signing (`mac.identity: '-'`) so the app runs locally without an
  Apple Developer account. It is not notarized; copied/downloaded apps are blocked by
  Gatekeeper. Right-click the app and choose **Open**, or run
  `xattr -dr com.apple.quarantine "/Applications/NebulaGraph Studio.app"`.
- Windows produces an unsigned NSIS installer; SmartScreen may show an “Unknown
  publisher” warning.
- Linux artifacts are unsigned.

A future macOS Developer ID release needs:

- `CSC_LINK` and `CSC_KEY_PASSWORD` for a Developer ID Application certificate;
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (or App Store Connect API
  key variables) for notarization;
- removing `com.apple.security.cs.disable-library-validation` from
  `resources/entitlements.mac.plist`;
- signing `Contents/Resources/server/studio` with the same identity (it is currently
  linker-signed ad-hoc by the Go toolchain).

## Architecture notes

- `src/main.mjs` owns the lifecycle: single-instance lock, port selection, sidecar
  startup, splash window, navigation, quit handling, and the `--smoke-test` mode.
- `src/server/paths.mjs` resolves `studio` or `studio.exe` for the packaged platform.
- `src/server/config.mjs` keeps `7001` stable, generates the auth passphrase, and
  converts Windows paths to forward slashes for the SQLite DSN.
- `src/server/manager.mjs` renders the user config, spawns the Go binary, waits for
  `/api-studio/health/ready`, rotates server output, tears the process down with
  SIGTERM then SIGKILL, and reaps stale PIDs (PowerShell on Windows, `ps` elsewhere).
- The renderer uses a persistent `persist:studio` session. External links open in the
  default browser; new Electron windows are denied; only clipboard permissions are
  granted.
- `--smoke-test` starts the backend with a temporary data directory, renders `/login`,
  captures `smoke-login.png`, prints a `DESKTOP_SMOKE_RESULT` JSON line, and exits.
  `pnpm desktop:verify` uses this to validate a packaged build end to end.

## Current limitations

- Windows and Linux packages are x64; macOS packages arm64 and x64 separately (no
  universal single bundle).
- No auto-update, Windows code signing, or Linux package repository publishing.
- Graphd TLS/SSO are not configurable from the desktop UI; the generated config keeps
  SSO disabled and does not set graphd TLS files.
- Existing Docker/Linux Studio data is not migrated.
