import { IconCatalog } from '@vesoft-inc/ui-components/graph/resources';
import {
  addIconGroup,
  addIconGroupItem,
  deleteIconGroup,
  deleteIconGroupItem,
  getIconGroupItemList,
  getIconGroupList,
  updateIconGroup,
} from '@studio/services/explorer';

export class IconGroupStore extends IconCatalog {
  constructor() {
    super({
      addIconGroup,
      addIconGroupItem,
      deleteIconGroup,
      deleteIconGroupItem,
      getIconGroupItemList,
      getIconGroupList,
      updateIconGroup,
    });
  }
}
