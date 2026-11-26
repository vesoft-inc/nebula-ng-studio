# NebulaGraph Studio Desktop (macOS Apple Silicon)

This package wraps the existing NebulaGraph Studio web application in Electron. The
application is not a thin shell around a remote site: the bundled Go Studio server
serves the frontend **and** exposes `/api-studio`, so the desktop app works with any
reachable NebulaGraph 5.x deployment without a separate Studio installation.

## Prerequisites

- macOS 13 Ventura or newer on Apple Silicon (`arm64`)
- Xcode Command Line Tools (`xcode-select --install`) for the CGO SQLite build
- Go 1.25+ (the `apps/server` module pins its toolchain; Go downloads it if needed)
- Node.js >= 22.12 and pnpm 9.12.2
- Network access for the first Electron download; in restricted networks set
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` before installing

## Build and run

```bash
pnpm install
pnpm desktop:build
open "apps/desktop/release/mac-arm64/NebulaGraph Studio.app"
```

`pnpm desktop:build` performs the full pipeline:

1. builds `apps/web` and copies the output to `apps/server/assets/public`;
2. builds `apps/server` for `darwin/arm64` with the web package version and Git metadata;
3. assembles `apps/desktop/build/server` (binary, assets, config template, license);
4. packages `NebulaGraph Studio.app` plus a DMG and a ZIP in `apps/desktop/release/`.

Other commands:

```bash
pnpm desktop:pack     # app bundle only, faster iteration
pnpm desktop:verify   # bundle structure + Info.plist + packaged smoke test
pnpm desktop:test     # unit tests (pure Node, runs on any platform)
pnpm desktop:dev      # launch Electron using an existing desktop/server build
```

`STUDIO_DESKTOP_SKIP_WEB=1 pnpm desktop:build` reuses the current
`apps/server/assets/public`; it is useful while iterating on Electron-only changes.

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

The app keeps all state under:

```
~/Library/Application Support/NebulaGraph Studio/
  config.yaml          generated on every launch, 0600
  auth.json            stable desktop auth secrets, 0600
  data/studio.db       SQLite database (plus -wal/-shm)
  logs/                desktop.log, server-stdout.log, Go server logs
  window-state.json
```

Development launches use `~/Library/Application Support/NebulaGraph Studio Dev` by
default. Override the location with `STUDIO_DESKTOP_USER_DATA`. Delete the folder to
reset the desktop app (this does not touch your NebulaGraph data).

The bundled server binds to `127.0.0.1` only. Port `7001` is preferred so the browser
origin stays stable and the login session/localStorage survive restarts. If `7001` is
already in use, the app asks whether to retry, use another port for this session, or
quit. Set `STUDIO_DESKTOP_PORT` to force a specific port.

| Variable                    | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `STUDIO_DESKTOP_PORT`       | Force the local Studio port (fails if it is busy)         |
| `STUDIO_DESKTOP_USER_DATA`  | Override the Application Support data directory           |
| `STUDIO_DESKTOP_URL`        | Load an existing Studio URL and skip spawning the sidecar |

## Signing and distribution

The default build uses **ad-hoc signing** (`mac.identity: '-'`). This is not an Apple
Developer ID signature and the app is **not notarized**: it runs locally, but files
downloaded by another machine will still be blocked by Gatekeeper. For those copies,
right-click the app and choose **Open**, or run:

```bash
xattr -dr com.apple.quarantine "/Applications/NebulaGraph Studio.app"
```

A future Developer ID release needs:

- `CSC_LINK` and `CSC_KEY_PASSWORD` for a Developer ID Application certificate;
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (or the App Store Connect
  API key variables) for notarization;
- removing `com.apple.security.cs.disable-library-validation` from
  `resources/entitlements.mac.plist`;
- signing `Contents/Resources/server/studio` with the same identity (it is currently
  linker-signed ad-hoc by the Go toolchain).

## Architecture notes

- `src/main.mjs` owns the lifecycle: single-instance lock, port selection, sidecar
  startup, splash window, navigation, quit handling, and the `--smoke-test` mode.
- `src/server/manager.mjs` renders the user config, spawns the Go binary, waits for
  `/api-studio/health/ready`, rotates server output, and tears the process down with
  SIGTERM then SIGKILL.
- `src/server/config.mjs` keeps `7001` stable, generates the 32-byte auth passphrase,
  and quotes YAML paths safely.
- The renderer uses a persistent `persist:studio` session. External links open in the
  default browser; new Electron windows are denied; only clipboard permissions are
  granted.
- `--smoke-test` starts the backend with a temporary data directory, renders `/login`,
  captures `smoke-login.png`, prints a `DESKTOP_SMOKE_RESULT` JSON line, and exits.
  `pnpm desktop:verify` uses this to validate a packaged build end to end.

## Current limitations

- Apple Silicon only; Intel/universal builds and Windows/Linux packaging are not wired.
- No auto-update and no CI packaging yet.
- Graphd TLS/SSO are not configurable from the desktop UI; the generated config keeps
  SSO disabled and does not set graphd TLS files.
- Existing Docker/Linux Studio data is not migrated.
