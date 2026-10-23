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
