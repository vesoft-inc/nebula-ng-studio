import { createFileRoute } from '@tanstack/react-router';
import Login from './-Page';
export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: Login,
});
