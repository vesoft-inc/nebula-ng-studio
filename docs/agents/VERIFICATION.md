# Verification and generation

## Packages and API

Run the changed domain's behavior tests and package lint:types. Entry/dependency changes also require source and dist boundary checks. Shared implementation changes cover affected public UI and hosts; do not add migration comparison tests.

```sh
# Source checks need no prior build; all three shared packages provide check:boundaries.
pnpm --filter @vesoft-inc/studio-ui check:boundaries

# Turbo builds core/graph engine → internal → public UI.
pnpm build:studio-ui
pnpm --filter @vesoft-inc/studio-core check:boundaries --dist
pnpm --filter @vesoft-inc/studio-ui-internal check:boundaries --dist
pnpm --filter @vesoft-inc/studio-ui check:boundaries --dist
pnpm --filter @vesoft-inc/studio-ui check:api
```

Public API changes update `package.json.exports`, `public-api.json`, TSDoc, and the owning guide. Regenerate declarations before `update:api`, review the report, then run `check:api`. Do not edit reports manually; CI does not accept changes automatically.

## Frontend builds and routes

```sh
pnpm --filter nebula-studio exec vite build
pnpm --filter nebula-gui exec vite build
# Build dependencies before checking package artifact resolution.
STUDIO_UI_INTERNAL_DIST=1 pnpm --filter nebula-studio exec vite build
STUDIO_UI_INTERNAL_DIST=1 pnpm --filter nebula-gui exec vite build
```

Root `pnpm build` / Web `build` runs copy:server, replacing `apps/server/assets/public`. Use the Vite commands above for frontend-only verification. Builds do not produce installation packages.

Generate Web `routeTree.gen.ts` with `pnpm --filter nebula-studio routes:generate`; lint:types already includes it. Do not edit it manually. Prefix route helpers/tests with `-` to exclude them from the route tree.

## Development and Server

Web `pnpm dev` starts only the frontend and proxies `/api` to `127.0.0.1:7001`; run `pnpm dev:server` separately. `/api-studio/health` confirms only Server availability; Server establishes the Graphd connection. GUI `pnpm dev:gui` uses its own protocol and GUI_API_TARGET.

See [CONTRIBUTING](../../CONTRIBUTING.md) for Go tests, scratch-directory generation with pinned goctl, mockgen, and optional Graphd integration. Handlers contain manual customizations; never overwrite them through in-place regeneration. Delivery/version changes run `pnpm test:release-policy`.

## Documentation

For documentation changes, check links, commands, and Markdown. Validate changed code examples directly. Markdown is ignored by default, so check it explicitly:

```sh
pnpm exec prettier --check --ignore-path /dev/null AGENTS.md 'docs/agents/*.md'
git diff --check
```

General PR checks follow [CONTRIBUTING](../../CONTRIBUTING.md) and [CI](../../.github/workflows/ci.yml).
