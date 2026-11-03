import { mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import type { QueryOptions } from '@vesoft-inc/studio-ui-internal/console/model';

/** Capture the session before asynchronous work queues or waits for another operation. */
export async function inSession<T>(
  signal: AbortSignal,
  options: QueryOptions | undefined,
  call: (request: QueryOptions) => Promise<T>
): Promise<T> {
  const combined = mergeAbortSignals(signal, options?.signal);
  try {
    if (combined.signal.aborted) throw new DOMException('Session expired', 'AbortError');
    const result = await call({ ...options, signal: combined.signal });
    if (combined.signal.aborted) throw new DOMException('Session expired', 'AbortError');
    return result;
  } finally {
    combined.dispose();
  }
}

/** Request lifetime is independent of stores, so the transport never imports application state. */
class SessionRequests {
  private controller = new AbortController();
  private onExpired?: () => void;

  get signal() {
    return this.controller.signal;
  }

  reset = () => {
    this.controller.abort();
    this.controller = new AbortController();
  };

  subscribe = (onExpired: () => void) => {
    this.onExpired = onExpired;
    return () => {
      if (this.onExpired === onExpired) this.onExpired = undefined;
    };
  };

  expire = (signal: AbortSignal) => {
    // A response from a previous connection must not invalidate the new one.
    if (signal !== this.signal || signal.aborted) return;
    this.reset();
    this.onExpired?.();
  };
}

export const sessionRequests = new SessionRequests();
