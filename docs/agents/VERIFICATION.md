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

Web/GUI each maintain their own generated `routeTree.gen.ts`. Generate them with `pnpm --filter nebula-studio routes:generate` or `pnpm --filter nebula-gui routes:generate`; each app's lint:types includes generation. Do not edit the trees manually. Prefix route helpers/tests with `-` to exclude them from the route tree.

## Browser regression

Build the two frontend hosts with the Vite commands above, then run `pnpm test:e2e:install` and `pnpm test:e2e`. Playwright serves their dist directories on loopback ports 4174 and 4175. Use `pnpm test:e2e --project=web` or `--project=gui` for one host. CI typechecks the suite and retains failure traces under `test-results/`.

Each browser test owns its HTTP fixture. Web exercises the deployed `/studio` base path and Studio Server envelopes. The GUI fixture authenticates requests with a distinct token for each login and rejects expired tokens. Delay responses explicitly for cancellation and session switches. Verify persisted changes through a fresh read after navigation or reload.

Explorer and Schema Editor are Web routes. The GUI suite covers the Console and its native REST protocol.

| Area                                  | Browser regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explorer lists and handoff            | Create, rename, delete, paginate and search snapshots. Switch Schema during a pending search. Verify settings and snapshots through a fresh read, plus Console handoff and dirty navigation. [Lists](../../e2e/web/explorer-list.spec.ts), [Snapshots](../../e2e/web/explorer.spec.ts), [Handoff](../../e2e/web/handoff.spec.ts)                                                                                                                                                                                     |
| Explorer panels and canvas            | Run node, relationship and path queries. Verify filters and display properties, Canvas2D hit testing, group selection and dragging, undo/redo, search and neighbor expansion, all eight layouts, zoom, panning, minimap, fullscreen, type styling, selected and full exports, and icon group and file operations. [Panels](../../e2e/web/explorer-panels.spec.ts), [Canvas](../../e2e/web/explorer-canvas.spec.ts), [Visuals](../../e2e/web/explorer-visuals.spec.ts), [Icons](../../e2e/web/explorer-icons.spec.ts) |
| Explorer database editing             | Check node and edge DML, failed writes, primary key locking, reversed endpoints, insert readback, and delete confirmation. [Editing](../../e2e/web/explorer-edit.spec.ts)                                                                                                                                                                                                                                                                                                                                            |
| Schema Editor canvas and forms        | Drag nodes and handles, connect and delete edges, create a self-loop, duplicate a node, change the viewport, switch between canvas and table, and verify DDL and persisted layout. [Canvas](../../e2e/web/schema-canvas.spec.ts), [Sketch and submission](../../e2e/web/schema-editor.spec.ts)                                                                                                                                                                                                                       |
| Schema property and constraint matrix | Check all `PropertyDataType` values on both nodes and edges through DDL submission and fresh metadata. Cross all edge directions with all multi-edge key modes, and verify composite primary key and DECIMAL validation. [Types](../../e2e/web/schema-types.spec.ts), [Constraints](../../e2e/web/schema-constraints.spec.ts)                                                                                                                                                                                        |

Canvas tests use mouse input and rendered pixels or SVG geometry for targets. Layout tests check characteristic node arrangements and restore fixed geometry up to pan and zoom. The Force case covers CPU fallback when Chromium cannot create a WebGL context. Canvas pixel checks distinguish hidden nodes from translucent ones. Schema fixtures route DDL by schema and GraphType and check both the updated and adjacent GraphTypes on a fresh read.

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
