# Studio Server frontend adapters

This guide covers the TypeScript service adapters. Backend implementation constraints belong to [Studio Server](STUDIO-SERVER.md).

The sole entry is `@vesoft-inc/studio-ui/adapters/studio-server`. [Factories and Options](../../packages/studio-ui/src/adapters/studio-server/index.ts) implement public domain services without runtime UI imports. Axios is an optional peer for this entry; other entries import neither its types nor its code.

| Factory                                | Protocol and optional capabilities                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| createStudioServerConsoleServices      | execute → `/nebula/console/execGql`, query → `/gql/exec`; no protocol mapping for getSessionId/cancelQuery |
| createStudioServerSchemaServices       | GQL and Schema switching; importDataset=true enables sample import, layouts enables cleanup                |
| createStudioServerSchemaEditorServices | GQL; sketches=true enables drafts, layouts enables layout persistence                                      |
| createStudioServerExplorerServices     | Snapshot CRUD; optional snapshotVersion and settings `{ appKey, personalKey? }`                            |
| createStudioServerIconServices         | Remote icon group/item CRUD, not a UI icon component collection                                            |

Factories issue no initial requests and create no clients/interceptors. Unconfigured optional capabilities expose no service methods. `http` must include the API prefix and return AxiosResponse; adapters extract ServerResponse. Schema/SchemaEditor/Explorer default `backgroundHttp` to http: configuration reads and layout reads/writes use it; settings saves and cleanup deletes use the regular client. Both clients share parsing, authentication, and session cancellation, with separate notification policies.

## Responses and cancellation

All methods forward QueryOptions.signal. Queued or multi-step operations check cancellation again before sending. queryTimeout goes into the query body timeout in milliseconds, not Axios's network timeout. Preserve business code/message; transport failures reject.

Studio Server may return standard business errors with HTTP 404. The host normalizes these so missing configuration can use defaults and missing snapshots return ErrNotFound. Cancellation, network failures, timeouts, and nonstandard bodies still reject. This example preserves large integers and validates business responses; Web's existing policy needs no duplicate interceptor.

```ts
import axios from 'axios';
import { JSONBig } from '@vesoft-inc/studio-core/graph';

// Keep this client stable within the host session; configure authentication and errors here.
const http = axios.create({
  baseURL: '/api-studio',
  transformResponse: [
    (data, headers) => {
      const contentType = String(headers.get('content-type') ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      return typeof data === 'string' && contentType === 'application/json' ? JSONBig.parse(data) : data;
    },
  ],
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (!axios.isAxiosError<unknown>(error)) return Promise.reject(error);
    const response = error.response;
    const body = response?.data;
    if (
      response &&
      body !== null &&
      typeof body === 'object' &&
      'code' in body &&
      typeof body.code === 'number' &&
      Number.isFinite(body.code) &&
      body.code !== 0 &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
      // Handle session expiry before returning the business response; this example shows no toast.
      return response;
    }
    return Promise.reject(error);
  }
);
```

## Persistence

- Schema layout identity contains address/username and optional namespace; SchemaEditor also fixes schemaPath. Factories copy identity and settings keys. Create new instances when identity changes.
- Without namespace, retain `studio-schema-layout-v1` keys and v1 documents. With namespace, add an encoded key segment consistently across reads, migration, and cleanup; do not migrate old data.
- Layout reads have a two-second deadline. Ordinary optional read failures return null; empty saves, oversized keys, or unconfirmed writes return false. Cancellation rejects and stops subsequent steps; it is not successful persistence.
- SchemaEditor services own write queues; Schema services own cleanup records. Delete only records verified to belong to the current identity/Schema, and allow retry after failure. Serialization applies within one instance, not across tabs or clients.
- Explorer settings loads return only persisted groups; UI merges defaults. Web may merge them in its wrapper when it needs a complete value. No personalKey means no personal configuration request.

## Web ownership

[StudioServerAdapters](../../apps/web/src/services/studioServer.ts) caches services by identity/Schema within the session, preserving layout queues across routes. Session invalidation cancels old requests and clears caches. A persistent SchemaController selects the current service at operation start through [schemaCatalog](../../apps/web/src/services/schemaCatalog.ts), rather than retaining the identity from before login.

[fetcher](../../apps/web/src/services/fetcher.ts) retains large-integer parsing, session expiry, and silent-request policy. GQL wrappers keep errTip/errMsgInterceptor outside public QueryOptions. Web development uses an exact source alias only for this adapter entry; artifact mode uses package exports. GUI has its own protocol.

Regressions: [services](../../packages/studio-ui/src/adapters/studio-server/services.test.ts), [config](../../packages/studio-ui/src/adapters/studio-server/config.test.ts), [layout](../../packages/studio-ui/src/adapters/studio-server/layout.test.ts), [Web sessions](../../apps/web/src/services/studioServer.test.ts).
