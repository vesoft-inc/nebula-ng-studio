import { en_US } from '@vesoft-inc/ui-components/locales/en_US';

const resources = { ...en_US, app: { pageLoadFailed: 'Unable to load this page.', reload: 'Reload' } };
export type Resource = typeof resources;
export default resources;
