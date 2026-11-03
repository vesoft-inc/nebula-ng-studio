import { IconCatalog } from '@vesoft-inc/studio-ui-internal/graph/resources';
import { studioIconServices } from '@studio/services/explorer';

export class IconGroupStore extends IconCatalog {
  constructor() {
    super(studioIconServices);
  }
}
