import { createRootRoute, Navigate, Outlet } from '@tanstack/react-router';
import { PageError } from '@studio/app/PageError';
export const Route = createRootRoute({
  component: Outlet,
  errorComponent: PageError,
  notFoundComponent: () => <Navigate to="/console" replace />,
});
