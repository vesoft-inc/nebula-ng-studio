import i18n_en_US from '@studio/utils/i18n/en_US/';
import gui from './gui';
import explorer from '@studio/utils/i18n/en_US/explorer';

export type Resource = typeof resource;
const resource = { gui, ...i18n_en_US, explorer };

export default resource;
