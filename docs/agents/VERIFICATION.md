# Verification and generation

## Packages and API

Run behavior tests and `lint:types` for the changed domain and affected hosts. For package entry or dependency changes, check all three packages from source before building, then check the artifacts.

```sh
pnpm --filter @vesoft-inc/studio-core check:boundaries
pnpm --filter @vesoft-inc/studio-ui-internal check:boundaries
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

Web/GUI each maintain their own generated `routeTree.gen.ts`. Generate them with `pnpm --filter nebula-studio routes:generate` or `pnpm --filter nebula-gui routes:generate`; each app's lint:types includes generation. Do not edit the trees manually. Prefix route helpers/tests with `-` to exclude them from the route tree.

## Browser regression

Build Web and GUI with Vite, then run `pnpm test:e2e:install`, `pnpm test:e2e:types` and `pnpm test:e2e`. Playwright serves the built apps on loopback with mocked HTTP. Web exercises the `/studio` deployment prefix and Studio Server responses. GUI exercises its native Console protocol. Use `--project=web` or `--project=gui` to select a host, and `pnpm test:e2e --list` to list current scenarios.

The [advisory browser workflow](../../.github/workflows/browser-regression.yml) runs on pull requests, pushes to `main`, and the exact commit selected for release. The public CI gate and release candidate can proceed while it runs. Failures produce a warning and job summary, with available screenshots and traces retained in the `browser-regression` artifact for seven days. Keep the advisory job outside the branch's required status checks.

- Match fixture responses to the identity and resource in the actual request. Delay selected responses to exercise cancellation, session changes and recovery.
- Verify saved data through a fresh read after navigation or reload. Use the live suite to check real persistence independently of the fixture.
- Drive the canvas with mouse input. Assert the rendered result using geometry, opacity or decoded image pixels so the test detects a wrong layout, missing entity or blank export.

Run `pnpm test:e2e:live` separately against English-language test deployments. Missing configuration reports the affected scenarios as skipped. Live tracing, screenshots and video are disabled.

| Deployment | Configuration                                                                                                                                                                                          | Optional scenario                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web        | `STUDIO_INTEGRATION_BASE_URL` (deployed Web URL including its prefix), `STUDIO_INTEGRATION_GRAPHD_ADDRESS` (host and port), `STUDIO_INTEGRATION_GRAPHD_USERNAME`, `STUDIO_INTEGRATION_GRAPHD_PASSWORD` | Set `STUDIO_INTEGRATION_WRITE_SCHEMA` to a dedicated test schema with permission to create and drop graphs and graph types. The Explorer scenario also needs Studio snapshot storage. `STUDIO_INTEGRATION_GRAPH_TYPE` enables the existing graph-list readback case with the specified graph type. |
| GUI        | `GUI_INTEGRATION_BASE_URL` (deployment root before `/ui/console`), `GUI_INTEGRATION_USERNAME`, `GUI_INTEGRATION_PASSWORD`                                                                              | Set `GUI_INTEGRATION_LONG_QUERY` to a cancellable read-only query for the test account to exercise remote cancellation.                                                                                                                                                                            |

The [Web live workflows](../../e2e/live/deployments.spec.ts) submit a GraphType from the Schema canvas and check Graphd metadata in separate Studio Server requests. They also query a temporary graph through Console, save a selection in Explorer and verify its schema, nodes, directed edge and selection from a new page. The tests use unique names and clean up the resources they create.

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
