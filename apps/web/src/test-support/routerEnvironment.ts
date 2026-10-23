import { transferableAbortController } from 'node:util';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom supplies DOM signals while Request comes from Node's native fetch.
// Use a matching pair so data-router navigation exercises the real Request API.
beforeEach(() => {
  const controller = transferableAbortController();
  vi.stubGlobal('AbortController', controller.constructor);
  vi.stubGlobal('AbortSignal', controller.signal.constructor);
});
afterEach(() => vi.unstubAllGlobals());
