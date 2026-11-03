import { createFileRoute } from '@tanstack/react-router';
import ConsolePage from './-Page';
export const Route = createFileRoute('/_app/console')({ staticData: { section: 'console' }, component: ConsolePage });
