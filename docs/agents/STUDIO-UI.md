# studio-ui: public contracts

Exact Props and service signatures live in [services.ts](../../packages/studio-ui/src/services.ts), the [public entries](../../packages/studio-ui/public-api.json), and the [API report](../../packages/studio-ui/etc/studio-ui.api.md).

## Component granularity

| Entry                                                           | Composition unit                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Root                                                            | `UiProvider`: theme, locale, instance modals; `StudioProvider`: domain services and scope                     |
| `/console`                                                      | `ConsoleWorkbench`                                                                                            |
| `/schema`                                                       | `SchemaList`, `GraphTypeList`, `GraphList`, `GraphInfo`, `CreateGraphDialog`, `SchemaTree`, `SchemaTreePanel` |
| `/schema-editor`                                                | `SchemaEditorWorkbench`, `SketchList`                                                                         |
| `/explorer`                                                     | `SnapshotList`, `ExplorerGraph` for a specific `snapshotId`                                                   |
| `/editor`                                                       | Controlled `GqlEditor` and `GqlViewer`; the handle exposes only `focus()`                                     |
| `/contracts`, `/locales/zh_CN`, `/locales/en_US`, `/styles.css` | Plain DTOs/codecs, static locales, required styles                                                            |
| `/adapters/studio-server`                                       | [Five optional service factories](STUDIO-SERVER.md), not re-exported by root or component entries             |

## Provider lifecycle

- The host defines `scopeKey` for the user, database, and connection session. It is not parsed into API or storage keys. Keep it and the mounted Provider stable across page changes.
- Domain state is lazy. Services are identified by reference: replacing a dependency cancels and rebuilds its state; unrelated domains or a new outer `services` container do not trigger a rebuild.
- Console text, results, query state, and snapshot associations survive page changes; unmounting a page releases view resources. Provider unmount, scope changes, or dependency replacement dispose old state; Schema changes clear the query context. Explorer/SchemaEditor do not add automatic drafts across pages.
- `schemaPath` represents a successfully selected remote Schema. The host switches remotely before updating Props. A component switch notifies the host through Provider `onSchemaChange`; changing Props does not perform the remote switch.
- Each Provider permits one active instance of each workbench; a tree may coexist with distinct lists/details. Page callbacks expire on unmount, while Schema synchronization follows the scope lifecycle.
- `UiProvider` disables CSS baseline by default and owns its modals. Import `/styles.css` once. Monaco themes apply to the entire page; editors must use a consistent mode.

Evidence: [provider.test.tsx](../../packages/studio-ui/src/provider.test.tsx), [scope.ts](../../packages/studio-ui/src/internal/scope.ts).

## SchemaTree and SchemaTreePanel

| Behavior       | SchemaTree                          | SchemaTreePanel                                                                                                                 |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dependencies   | `UiProvider` plus host data/actions | `StudioProvider.services.schema` and shared Schema state                                                                        |
| Initialization | Host loads data                     | Loads the Schema list; discovers the current Schema if absent; merges identical in-flight metadata requests                     |
| Selection      | Host supplies node keys             | Semantic `SchemaTreeSelection`; omitted selected is uncontrolled, null clears, another Schema is not highlighted                |
| Expansion      | Host loads children                 | Loads categories/entities/properties on expansion; defaults to `showDetail=false`, `collapsed=false`                            |
| Creation       | Host composes actions               | Handles Schema creation and the Graph dialog; Graph success refreshes shared lists and closes the dialog without changing pages |

Panel `collapsed=true` uses the selector's fixed heading. Schema creation attempts a refresh before `onSchemaCreated`; refresh failure does not undo successful creation. Creation does not switch Schema or navigate by default. Missing GraphType creation or view-all callbacks hide those actions. Loading failures offer local retry; creation failures retain the form; cancellation shows no failure message.

Schema changes clear selection, expansion, and dialogs. Unmount stops page callbacks but retains shared data. A pending remote Schema switch still synchronizes the active scope after page unmount; identity/service replacement invalidates it. Consumers need no `observer`. See [Panel regressions](../../packages/studio-ui/src/schema-tree-panel.test.tsx).

## Explorer and handoff

- `ExplorerGraph.onDirtyChange` informs the host. The host blocks navigation/browser close and supplies `blocker.state/proceed/reset`; the component provides no fallback navigation or blocker.
- With Console `onOpenSnapshot`, the scope reuses or creates a snapshot and emits only `{ snapshotId }`. Deletion clears Console associations. See [internal integration](STUDIO-UI-INTERNAL.md).
- Creation uses `schema_path`; reads use optional `schemaPath` and serialized `data`. Resolve ownership from details, then the confirmed list entry with the same ID, then a verification query under the current Schema.
- Verification calls `list({ page: 1, pageSize: 1, filter: JSON.stringify({ id, schema_path }) })`; the service must apply both filters. Reject restoration if ownership cannot be verified. Do not assume the current Schema owns the snapshot; sharing across Schemas requires details to return the actual owner.

## Queries and errors

`execute` handles user/warning queries; `query` handles metadata. Public `QueryOptions` contains only cancellation and a timeout in milliseconds; components convert UI settings from seconds. Optional `getSessionId/cancelQuery` provides server cancellation; client cancellation cannot undo submitted writes.

Business failures preserve `code/message`; transport failures may reject. Console creates results for business failures but does not guarantee a visible message for network rejection. Explorer already shows local open/save errors. Hosts choose error presentation per operation; components have no universal deduplication. [Studio Server adapters](STUDIO-SERVER.md) additionally require HTTP business-error normalization.
