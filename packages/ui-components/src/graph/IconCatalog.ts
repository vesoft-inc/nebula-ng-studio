import { makeObservable, observable, runInAction } from 'mobx';
import { IconGroupType } from './constants';
import { IconGroup, IconItem } from './types/index';
import type { IconCatalogService } from './iconService';

// import service from '@app/config/service';
import iconCategory from './assets/icon-category.json';

const OfficialPrefix = 'official';

export class IconCatalog {
  private generation = 0;

  svgGroup = {
    officalGroupList: observable.array<IconGroup>([]),
    serverGroupList: observable.array<IconGroup>([]),
    currentGroupId: undefined as string | undefined,
    initailized: false,
  };

  imgGroup = {
    officalGroupList: observable.array<IconGroup>([]),
    serverGroupList: observable.array<IconGroup>([]),
    currentGroupId: undefined as string | undefined,
    initailized: false,
  };

  constructor(public readonly service?: IconCatalogService) {
    makeObservable(this, {
      svgGroup: observable.deep,
      imgGroup: observable.deep,
    });
  }

  fetchOfficialIconGroupList = async (type: IconGroupType): Promise<IconGroup[]> => {
    // only `svg` type need to fetch official icon group list
    if (type !== IconGroupType.SVG) {
      return [];
    }
    const initIconGroupList = iconCategory;
    return initIconGroupList.reduce((ret: IconGroup[], group, idx: number) => {
      ret.push({
        id: `${OfficialPrefix}-${idx}`,
        name: group[0].category,
        nameCN: group[0].categoryCN,
        icons: observable.array(
          group.map((item) => ({
            ...item,
            id: `${item.category}-${item.name}`,
            groupId: `${OfficialPrefix}-${idx}`,
            icon: item.icon,
          }))
        ),
        editable: false,
      });
      return ret;
    }, [] as IconGroup[]);
  };

  fetchIconGroupList = async (type: IconGroupType): Promise<IconGroup[]> => {
    const res = await this.service?.getIconGroupList(type);
    if (!res?.data?.items?.length) {
      return [];
    }
    return res.data.items.map((item: IconGroup) => ({
      id: item.id,
      name: item.name,
      editable: true,
      icons: observable.array([]),
    }));
  };

  initIconGroupList = async (type: IconGroupType) => {
    const generation = this.generation;
    const typeGroup = this[`${type}Group`];
    if (typeGroup.initailized) {
      return;
    }

    const [officalGroupList, serverGroupList] = await Promise.all([
      this.fetchOfficialIconGroupList(type),
      this.fetchIconGroupList(type),
    ]);
    if (generation !== this.generation) return;
    runInAction(() => {
      typeGroup.officalGroupList.replace(officalGroupList);
      typeGroup.serverGroupList.replace(serverGroupList);
      typeGroup.currentGroupId = officalGroupList[0]?.id || serverGroupList[0]?.id;
      typeGroup.initailized = true;
    });

    const nextGroup = officalGroupList[0] || serverGroupList[0];
    if (!nextGroup && this.service) {
      this.addNewGroup(type);
    } else if (nextGroup?.icons?.length === 0) {
      this.selectGroup({ type, groupId: nextGroup.id });
    }
  };

  addNewGroup = async (type: IconGroupType) => {
    const generation = this.generation;
    const groupName = 'new_group';
    const res = await this.service?.addIconGroup({ name: groupName, type });
    if (generation !== this.generation) return;
    const groupId = res?.data?.id;
    groupId &&
      runInAction(() => {
        this[`${type}Group`].serverGroupList.push({
          id: groupId,
          name: groupName,
          editable: true,
          icons: observable.array([]),
        });
        this[`${type}Group`].currentGroupId = groupId;
      });

    return groupId;
  };

  deleteGroup = async ({ type, group }: { type: IconGroupType; group: IconGroup }) => {
    const generation = this.generation;
    const res = await this.service?.deleteIconGroup(group.id);
    if (generation !== this.generation) return;
    const groupId = res?.data?.id;

    if (!groupId) {
      return;
    }

    const typeGroup = this[`${type}Group`];
    const idx = typeGroup.serverGroupList.findIndex((item) => item.id === groupId);
    const nextGroupId =
      typeGroup.serverGroupList[idx - 1]?.id || typeGroup.officalGroupList[typeGroup.officalGroupList.length - 1]?.id;
    runInAction(() => {
      typeGroup.serverGroupList.remove(group);
    });
    this.selectGroup({ type, groupId: nextGroupId });
  };

  updateGroupName = async ({ group, name }: { group: IconGroup; name: string }) => {
    const generation = this.generation;
    const res = await this.service?.updateIconGroup({ id: group.id, name });
    if (generation !== this.generation) return;
    const groupId = res?.data?.id;
    groupId &&
      runInAction(() => {
        group.name = name;
      });
  };

  selectGroup = async ({ type, groupId }: { type: IconGroupType; groupId?: string }) => {
    const generation = this.generation;
    if (!groupId || groupId.startsWith(OfficialPrefix)) {
      runInAction(() => {
        this[`${type}Group`].currentGroupId = groupId;
      });
      return;
    }

    const res = await this.service?.getIconGroupItemList(groupId);
    if (generation !== this.generation) return;
    Array.isArray(res?.data?.items) &&
      runInAction(() => {
        const typeGroup = this[`${type}Group`];
        const targetGroup = typeGroup.serverGroupList.find((item) => item.id === groupId);
        if (targetGroup && res?.data?.items) {
          targetGroup.icons.replace(res.data.items);
        }
        typeGroup.currentGroupId = groupId;
      });
  };

  addIcon = async ({ group, name, icon }: { group: IconGroup; name: string; icon: string }) => {
    const generation = this.generation;
    const res = await this.service?.addIconGroupItem({ groupId: group.id, name, icon });
    if (generation !== this.generation) return;
    const iconId = res?.data?.id;
    iconId &&
      runInAction(() => {
        group.icons.push({
          id: iconId,
          name,
          icon,
          groupId: group.id,
        } as IconItem);
      });
  };

  deleteIcon = async ({ group, icon }: { group: IconGroup; icon: IconItem }) => {
    const generation = this.generation;
    const res = await this.service?.deleteIconGroupItem({
      groupId: group.id,
      iconId: icon.id,
    });
    if (generation !== this.generation) return;
    const iconId = res?.data?.id;
    iconId &&
      runInAction(() => {
        group.icons.remove(icon);
      });
  };

  clear = () => {
    this.generation += 1;
    (['svg', 'img'] as const).forEach((type) => {
      const group = this[`${type}Group`];
      group.officalGroupList.clear();
      group.serverGroupList.clear();
      group.currentGroupId = undefined;
      group.initailized = false;
    });
  };
}
