import { describe, expect, it, vi } from 'vitest';
import { mergeAbortSignals } from './signals';

describe('mergeAbortSignals', () => {
  it('cancels only the requested operation and still cancels siblings when the session ends', () => {
    const session = new AbortController();
    const request = new AbortController();
    const first = mergeAbortSignals(session.signal, request.signal);
    const second = mergeAbortSignals(session.signal);
    request.abort();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(session.signal.aborted).toBe(false);
    session.abort();
    expect(second.signal.aborted).toBe(true);
  });

  it('removes source listeners when the request settles or is aborted', () => {
    const session = new AbortController();
    const request = new AbortController();
    const removeSession = vi.spyOn(session.signal, 'removeEventListener');
    const removeRequest = vi.spyOn(request.signal, 'removeEventListener');
    const merged = mergeAbortSignals(session.signal, request.signal);
    merged.dispose();
    expect(removeSession).toHaveBeenCalledOnce();
    expect(removeRequest).toHaveBeenCalledOnce();
    session.abort();
    expect(merged.signal.aborted).toBe(false);
  });

  it('starts aborted when any source is already cancelled', () => {
    const session = new AbortController();
    session.abort();
    expect(mergeAbortSignals(undefined, session.signal).signal.aborted).toBe(true);
  });
});
