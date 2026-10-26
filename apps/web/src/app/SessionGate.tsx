import { Fragment, useEffect, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, useLocation } from 'react-router-dom';
import { PageLoading } from '@vesoft-inc/ui-components';
import { commonStore } from './session';
import { loginPath } from './paths';

export const SessionGate = observer(function SessionGate({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    void commonStore.initializeSession();
  }, []);

  if (commonStore.sessionStatus === 'idle' || commonStore.sessionStatus === 'checking') return <PageLoading />;
  if (!commonStore.isLogin) return <Navigate replace to={loginPath(`${pathname}${search}${hash}`)} />;
  // Changing identity disposes all page-owned controllers, even if the URL stays the same.
  return <Fragment key={commonStore.sessionRevision}>{children}</Fragment>;
});
