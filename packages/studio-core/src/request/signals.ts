type AbortSignalLike = Pick<AbortSignal, 'aborted'> &
  Partial<Pick<AbortSignal, 'addEventListener' | 'removeEventListener'>>;

/** Combine per-request and session cancellation, without retaining listeners after a request settles. */
export function mergeAbortSignals(...signals: (AbortSignalLike | undefined)[]) {
  const controller = new AbortController();
  const activeSignals = signals.filter((signal): signal is AbortSignalLike => !!signal);
  const dispose = () => activeSignals.forEach((signal) => signal.removeEventListener?.('abort', abort));
  const abort = () => {
    controller.abort();
    dispose();
  };
  if (activeSignals.some((signal) => signal.aborted)) abort();
  else activeSignals.forEach((signal) => signal.addEventListener?.('abort', abort, { once: true }));
  return { signal: controller.signal, dispose };
}
