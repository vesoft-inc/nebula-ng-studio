import { createFileRoute, Navigate } from '@tanstack/react-router';
import { SchemaLayout } from './-Layout';
export const Route = createFileRoute('/_app/_schema/schema-manager')({
  component: SchemaLayout,
  notFoundComponent: () => <Navigate to="/schema-manager/graphtype" replace />,
});
