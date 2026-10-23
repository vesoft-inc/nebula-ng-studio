import { makeObservable, observable, runInAction } from 'mobx';
import { IconGroupType } from '@studio/utils/explorer/constant';
import { IconGroup, IconItem } from '@studio/interfaces/explorer';
import {
  addIconGroup,
  addIconGroupItem,
  deleteIconGroup,
  deleteIconGroupItem,
  getIconGroupItemList,
  getIconGroupList,
  updateIconGroup,
} from '@studio/services/explorer';

// import service from '@app/config/service';
import iconCategory from '@studio/assets/icon-category.json?raw';

const OfficialPrefix = 'official';

export class IconGroupStore {
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

  constructor() {
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
    const initIconGroupList: IconItem[][] = JSON.parse(iconCategory);
    return initIconGroupList.reduce((ret: IconGroup[], group: IconItem[], idx: number) => {
      ret.push({
        id: `${OfficialPrefix}-${idx}`,
        name: group[0].category,
        nameCN: group[0].categoryCN,
        icons: observable.array(
          group.map((item) => ({
            ...item,
            id: `${item.category}-${item.name}`,
            icon: item.icon,
          }))
        ),
        editable: false,
      });
      return ret;
    }, [] as IconGroup[]);
  };

  fetchIconGroupList = async (type: IconGroupType): Promise<IconGroup[]> => {
    const res = await getIconGroupList(type);
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
    const typeGroup = this[`${type}Group`];
    if (typeGroup.initailized) {
      return;
    }

    const [officalGroupList, serverGroupList] = await Promise.all([
      this.fetchOfficialIconGroupList(type),
      this.fetchIconGroupList(type),
    ]);
    runInAction(() => {
      typeGroup.officalGroupList.replace(officalGroupList);
      typeGroup.serverGroupList.replace(serverGroupList);
      typeGroup.currentGroupId = officalGroupList[0]?.id || serverGroupList[0]?.id;
      typeGroup.initailized = true;
    });

    const nextGroup = officalGroupList[0] || serverGroupList[0];
    if (!nextGroup) {
      this.addNewGroup(type);
    } else if (nextGroup?.icons?.length === 0) {
      this.selectGroup({ type, groupId: nextGroup.id });
    }
  };

  addNewGroup = async (type: IconGroupType) => {
    const groupName = 'new_group';
    const res = await addIconGroup({ name: groupName, type });
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
    const res = await deleteIconGroup(group.id);
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
    const res = await updateIconGroup({ id: group.id, name });
    const groupId = res?.data?.id;
    groupId &&
      runInAction(() => {
        group.name = name;
      });
  };

  selectGroup = async ({ type, groupId }: { type: IconGroupType; groupId?: string }) => {
    if (!groupId || groupId.startsWith(OfficialPrefix)) {
      runInAction(() => {
        this[`${type}Group`].currentGroupId = groupId;
      });
      return;
    }

    const res = await getIconGroupItemList(groupId);
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
    const res = await addIconGroupItem({ groupId: group.id, name, icon });
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
    const res = await deleteIconGroupItem({
      groupId: group.id,
      iconId: icon.id,
    });
    const iconId = res?.data?.id;
    iconId &&
      runInAction(() => {
        group.icons.remove(icon);
      });
  };

  clear = () => {
    (['svg', 'img'] as const).forEach((type) => {
      const group = this[`${type}Group`];
      group.officalGroupList.clear();
      group.serverGroupList.clear();
      group.currentGroupId = undefined;
      group.initailized = false;
    });
  };
}
