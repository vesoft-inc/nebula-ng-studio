import { createFileRoute } from '@tanstack/react-router';
import { SchemaSession } from './-Session';
export const Route = createFileRoute('/_app/_schema')({
  staticData: { section: 'schema-manager' },
  component: SchemaSession,
});
