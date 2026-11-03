# studio-core

| Entry        | Capabilities                                                        | Environment       |
| ------------ | ------------------------------------------------------------------- | ----------------- |
| Root         | `createUuid`, `safeArray`, `groupArray`, `hexToRgba`                | No DOM            |
| `/contracts` | Response, Schema, GQL, graph protocols, domain enums                | No DOM/React/MobX |
| `/graph`     | Edge identity, GQL name escaping, type parameters, DECIMAL, JSONBig | No DOM/React/MobX |
| `/request`   | `parseResponseBody`, `RequestQueue`, `mergeAbortSignals`            | HTTP/AbortSignal  |
| `/browser`   | `LocalStorageUtil`                                                  | Browser           |
| `/crypto`    | Existing credential encryption protocol                             | Web Crypto/Base64 |

The root does not aggregate subentries. There is no RouterStore, HTTP client, or Axios configuration extension. CSV downloads belong to internal `/utilities`.

`parsePropertyDataType` returns plain `PropertyTypeDefinition`, without editor IDs, styles, or clone methods. `GQLResultPlanInfo` excludes display groups and time percentages; internal `PlanNodeData` owns those fields.

Source and built root/contracts/graph entries undergo complete declaration graph checks with ES-only libraries and Bundler/NodeNext resolution. Required third-party source types ship in dependencies. Call `dispose()` on combined cancellation signals to release listeners.

References: [exports](../../packages/studio-core/package.json), [source entries](../../packages/studio-core/src), [cross-platform encryption tests](../../packages/studio-core/src/crypto.cross.test.ts), [boundary checker](../../packages/studio-core/scripts/check-boundaries.mjs).
