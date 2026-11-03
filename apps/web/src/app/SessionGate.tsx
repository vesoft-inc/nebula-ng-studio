import { Fragment, useEffect, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, useLocation } from '@tanstack/react-router';
import { PageLoading } from '@vesoft-inc/studio-ui-internal';
import { commonStore } from './session';

export const SessionGate = observer(function SessionGate({ children }: { children: ReactNode }) {
  const { href, pathname } = useLocation();
  useEffect(() => {
    void commonStore.initializeSession();
  }, []);

  if (commonStore.sessionStatus === 'idle' || commonStore.sessionStatus === 'checking') return <PageLoading />;
  if (!commonStore.isLogin) {
    // The previous layout can still render while the login navigation is settling.
    if (/^\/login\/?$/i.test(pathname)) return null;
    return <Navigate replace to="/login" search={{ redirect: href }} />;
  }
  // Changing identity disposes all page-owned controllers, even if the URL stays the same.
  return <Fragment key={commonStore.sessionRevision}>{children}</Fragment>;
});
