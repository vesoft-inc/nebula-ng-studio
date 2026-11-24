# studio-ui-internal: implementation contracts

## Composition and ownership

| Domain       | Composition                                                                            | Ownership                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console      | `ConsoleWorkbench`, or ConsoleProvider + Composer/Toolbar/Results                      | Pass either services or an existing Controller. The workbench disposes the Controller it creates. A host-owned Controller survives page changes; the host clears it on logout.         |
| Schema       | SchemaProvider + lists/tree/details/dialogs; index forms use IndexQueryProvider        | Views share SchemaController; navigation returns to the host through events                                                                                                            |
| SchemaEditor | Workbench, or SchemaEditorProvider + canvas/forms/DDL/sketches                         | Manual composition calls initSchemaStore first; the owner calls destroy. layouts/sketches are optional                                                                                 |
| Explorer     | ExplorerSession + SnapshotList or ExplorerGraph; finer components use ExplorerProvider | Pass an Explorer Controller, or services with an optional shared SchemaController and initial settings. The session initializes Explorer and disposes only the Controllers it creates. |
| Graph        | `/graph` views, `/graph/model` workspace, `/graph/resources` icon catalog              | Canvas owns synchronization/highlighting; GraphStore owns filtering; SchemaController owns catalog synchronization                                                                     |
| Shell        | Header/Navigation/Login/Connection components                                          | Host owns branding, authentication, SSO, navigation; forms manage only their own submission                                                                                            |

`useSchemaTreeBindings` does not initialize data; load explicitly through onReady or the layout. Use UiProvider and call it inside observer. Notify the host only after a successful switch. Refresh failure does not invalidate creation; unmount/Controller replacement stops old follow-up refreshes and callbacks.

`selectItem()` changes the selection. Live panels call `commitNodeChanges()` or `commitEdgeChanges()` on change. Dialogs commit on confirmation. `useLayoutPersistence` owns autosave subscriptions, timers, and the final save on unmount. The service owns the write queue.

GUI Console sends a positive query deadline in milliseconds through `X-Request-Timeout`. Its `/gql` body contains only `gql`. Axios uses the host transport timeout. Web sends the query deadline in the Studio Server request body.

## Snapshots and runtime

| Boundary            | Types                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Service/persistence | `SnapshotRecord` with optional JSON string data, `SnapshotMetadata`, `SnapshotPayload`, `FilterDefinition`     |
| Canvas/history      | `OpenedSnapshot`, `GraphRuntimeState`, `GraphHistoryFrame`; preserve entity references and index-copy behavior |
| Icons               | Raw `IconGroupRecord/IconItemRecord`; plain catalog `IconGroupData/IconItemData`                               |

Snapshot codecs operate on plain data. Decoding migrates legacy edge IDs. Restoration uses entity-index string keys as canvas IDs and binds duplicate edge endpoints once. Preserve raw IDs, endpoints, and property encodings in `data.value`. Convert between persisted and runtime data on load, save, or handoff.

`openSnapshot()` verifies the owning Schema, switches if needed, and applies the decoded state and history through `restoreSnapshot()`. It starts `loadGraphTypeDetails()` in the background when the snapshot names a graph type. Switching workspaces or disposing one invalidates its pending metadata reads. [Snapshot ownership](STUDIO-UI.md#explorer-and-handoff)

Reapply active filters on graph queries, property edits and history restores, preserving unrelated manual dismissals. Hide an edge when either endpoint is hidden, including while the renderer still holds endpoint IDs.

For Explorer's GPU layout, check that the browser can create a WebGL context with the required extensions. Fall back to CPU layout when that check fails and release the loading overlay when layout ends. [Layout regression](../../e2e/web/explorer-visuals.spec.ts)

On the Schema canvas, let React Flow hit-test overlapping handles. Configure one to start and the other to end a connection, and use the reported source and target IDs. [Connection regression](../../e2e/web/schema-canvas.spec.ts)

## Console → Explorer

`ensureExplorerSnapshot` in `/integrations/console-explorer` receives Console/Schema Controllers, snapshot read/create services, version, Schema fallback, and a cancellation signal:

- Reuse valid associations; recreate only on `ErrNotFound`. Serialize graph data before awaiting metadata; fill graph type and Schema information at creation and record the association.
- Return null for data that cannot be explored. Throw service failures; an empty message delegates localized fallback text to the host. Check cancellation at each async stage to prevent late associations/navigation.
- Do not load ExplorerController or introduce reverse imports from business modules. Web's [-exploreResult.ts](../../apps/web/src/routes/_app/console/-exploreResult.ts) is the host adapter.

## Provider and resources

- Web and GUI pass their i18n instance directly to UiProvider. ThemeWrapper tracks the host theme and supplies the CSS baseline and style injection order. Fill missing Vesoft colors according to the MUI theme mode without mutating the input. Custom i18n loads uiResources from `/locales`. Internal CSS baseline defaults to enabled; disable as needed. Use renderGlobalModal=false if the host already renders it.
- React uses the current Provider's useModal; HTTP/session modules use the same host modalStore injected into that Provider. Import `/styles.css` once. Monaco themes apply to the entire page.
- IconCatalog creates reactive collections and display fields at the catalog boundary; missing category falls back to groupId. Services need not fabricate icons/editable/category. Built-in icons work offline.
- `IProperty`, node/edge models, LINE_STYLE, ToolNodeColor, ConsoleResult, and plan display fields stay in UI. CSV download lives in `shared/download.ts`, exported by `/utilities`, and handles BOM, filenames, and error messages.
