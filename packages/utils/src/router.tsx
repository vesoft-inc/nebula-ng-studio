import { useLayoutEffect } from 'react';
import { observable, makeObservable } from 'mobx';
import { createBrowserRouter } from 'react-router-dom';
import type { BrowserRouterProps, RouteObject } from 'react-router-dom';
import type { Router, RouterNavigateOptions, RouterState, To } from '@remix-run/router';

export interface BrowserRouterPropsWithStore extends BrowserRouterProps {
  store?: RouterStore;
  routes: RouteObject[];
}

export function useBrowserRouter({ basename, future, window, store, routes }: BrowserRouterPropsWithStore) {
  const router = createBrowserRouter(routes, {
    window,
    basename,
    future,
  });

  useLayoutEffect(() => {
    store?.updateRouter(router);
    return router.subscribe((state) => {
      store?.updateState(state);
    });
  }, [router, store]);

  return router;
}

export class RouterStore {
  router?: Router;
  state?: RouterState;

  constructor() {
    makeObservable(this, {
      state: observable.ref,
      router: observable.ref,
    });
  }

  updateRouter = (router: Router) => {
    this.router = router;
  };

  updateState = (state: RouterState) => {
    this.state = state;
  };

  push = (to: To | null, opts?: RouterNavigateOptions) => this.router?.navigate(to, opts);
  go = (step: number) => this.router?.navigate(step);
  replace = (to: To | null, opts?: RouterNavigateOptions) =>
    this.router?.navigate(to, {
      ...opts,
      replace: true,
    });
  back = () => this.router?.navigate(-1);
  forward = () => this.router?.navigate(1);
}
