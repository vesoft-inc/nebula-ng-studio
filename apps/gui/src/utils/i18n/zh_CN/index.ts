import type { Resource } from '../en_US';
import i18n_zh_CN from '@studio/utils/i18n/zh_CN/';
import gui from './gui';
import explorer from '@studio/utils/i18n/zh_CN/explorer';

const resource: Resource = { gui, ...i18n_zh_CN, explorer };

export default resource;
