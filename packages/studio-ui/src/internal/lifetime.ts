import { mergeAbortSignals } from '@vesoft-inc/studio-core/request';
import type { QueryOptions } from '../services';

export class Lifetime {
  private abort = new AbortController();
  constructor(private isScopeActive: () => boolean) {}

  get active() {
    return !this.abort.signal.aborted && this.isScopeActive();
  }
  get signal() {
    return this.abort.signal;
  }
  assertActive() {
    if (!this.active) throw new DOMException('Studio scope was disposed', 'AbortError');
  }
  dispose() {
    this.abort.abort();
  }

  async request<T>(call: (options: QueryOptions) => Promise<T>, options?: QueryOptions): Promise<T> {
    this.assertActive();
    const combined = mergeAbortSignals(this.abort.signal, options?.signal);
    try {
      const result = await call({ signal: combined.signal, queryTimeout: options?.queryTimeout });
      this.assertActive();
      if (combined.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      return result;
    } finally {
      combined.dispose();
    }
  }
}
