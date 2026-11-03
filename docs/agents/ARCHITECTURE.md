# Architecture

## Code and artifact boundaries

| Unit                 | Owns                                                                          | Build and consumption constraints                                                                                 |
| -------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `studio-core`        | Database protocols and utilities                                              | Root, `contracts`, and `graph` have no DOM dependency; isolate platform entries                                   |
| `studio-ui-internal` | Business UI, Controllers, canvases, editors                                   | Consumed by Web/GUI in this repository; fine-grained entries carry no external compatibility promise              |
| `studio-ui`          | Public Props, service contracts, scopes, binding code                         | Bundle internal and workspace force-graph implementations; artifacts must not reference them as external packages |
| `force-graph`        | Rendering engine                                                              | Core remains independent; public UI bundles the engine                                                            |
| Web/GUI              | Pages, authentication, sessions, HTTP clients, error policy, identity binding | Web reuses Studio Server adapters; GUI has its own protocol                                                       |
| Studio Server        | HTTP API, Graphd sessions, Studio persistence, static assets                  | HTTP definitions live in `apps/server/restapi`                                                                    |

`studio-ui/src/internal` binds public contracts to internal implementations; it does not duplicate business logic.

## Type ownership

| Content                                                                     | Owner                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Schema/GQL/entity protocols, domain enums, `PropertyTypeDefinition`         | `studio-core/contracts`                                              |
| Snapshot, filter, icon DTOs and pure snapshot codecs                        | UI `/contracts`, without React/MobX/DOM dependencies                 |
| Editor models, display constants, `ConsoleResult.destroy()`, `PlanNodeData` | Internal UI; execution plan presentation operates on a protocol copy |
| HTTP paths and configuration/layout protocols                               | `studio-ui/adapters/studio-server`                                   |
| HTTP clients, authentication, sessions, error messages                      | Host applications, outside core and UI Controllers                   |

## Public surface

- Use explicit package `exports` and named symbol allowlists. The public package has no source condition, wildcard entry, `/model`, or general utility collection. Core/internal separate the development `source` condition from default `dist` entries.
- New public components need a concrete reuse case, an independent interface, and a verifiable lifecycle. Prefer necessary Props/events; do not inherit internal Props containing Controllers.
- Check both JavaScript and declaration dependency graphs. `import type` does not isolate declarations. Contracts, locales, and adapters must not load workbenches, Monaco, the graph engine, or styles through barrel exports.
- Build all entries together to share the Provider chunk. Preserve CSS, fonts, images, Monaco workers, and `new URL(..., import.meta.url)` paths. The UI baseline is browser React 19 / MUI 7.

Enforcement: [exports and dependencies](../../packages/studio-ui/package.json), [symbol allowlist](../../packages/studio-ui/public-api.json), [API report](../../packages/studio-ui/etc/studio-ui.api.md), and each shared package's `scripts/check-boundaries.mjs`.
