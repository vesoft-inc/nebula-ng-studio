# studio-ui-internal: implementation contracts

Exact entries live in [package.json](../../packages/studio-ui-internal/package.json) and [entries](../../packages/studio-ui-internal/src/entries). `src/shared` holds UI shared across domains; business code lives in console/schema/schema-editor/explorer/graph.

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

Separate editor selection from writes: `selectItem()` selects; `commitNodeChanges()` / `commitEdgeChanges()` commit. Live panels commit onChange; dialogs commit on confirmation. Compatibility setters remain, but new code must not save implicitly through selection reactions. `useLayoutPersistence` owns autosave subscriptions, timers, and unmount submission; the service owns the persistence queue.

## Snapshots and runtime

| Boundary            | Types                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Service/persistence | `SnapshotRecord` with optional JSON string data, `SnapshotMetadata`, `SnapshotPayload`, `FilterDefinition`     |
| Canvas/history      | `OpenedSnapshot`, `GraphRuntimeState`, `GraphHistoryFrame`; preserve entity references and index-copy behavior |
| Icons               | Raw `IconGroupRecord/IconItemRecord`; plain catalog `IconGroupData/IconItemData`                               |

Legacy `Snapshot`/`SnapshotData` mean `OpenedSnapshot`/`GraphRuntimeState`, not JSON DTOs. Read generic runtime collections with `Array.from()`. Existing snapshotTransfer exports and Controller import/export methods remain.

Codecs create no images, observables, or canvases. Decode migrates legacy edge IDs; restoration uses entity-index string keys as canvas IDs and binds duplicate edge endpoints once. Preserve raw IDs, endpoints, and property encodings in `data.value`. Runtime conversion belongs at load/save/handoff boundaries, not in frame loops.

`openSnapshot()` reads, verifies/switches Schema, decodes, restores, and loads metadata. `restoreSnapshot()` only applies state/history; `loadGraphTypeDetails()` queries explicitly. Legacy `initSnapShot()` still combines them. Switching or disposal invalidates old metadata. Ownership rules are in the [public contract](STUDIO-UI.md).

The renderer observes the identities of hidden and dimmed entities. Graph queries, property edits and history restores re-evaluate active rules while retaining unrelated manual dismissals. Edges disappear when an endpoint is hidden, including before the renderer resolves endpoint IDs into objects.

GUI Console sends a positive query deadline in milliseconds through `X-Request-Timeout`. Its `/gql` body contains only `gql`. Axios uses the host transport timeout. Web sends the query deadline in the Studio Server request body.

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
