import { describe, expect, it, vi } from 'vitest';
import { IconCatalog } from './IconCatalog';
import { IconGroupType } from './constants';
import type { IconCatalogService } from './iconService';
import { isObservableArray } from 'mobx';

function apiService(): IconCatalogService {
  const groups = {
    code: 0,
    message: '',
    data: { items: [{ id: 'group', name: 'Pictures', type: 'img', create_time: 1, update_time: 2 }] },
  };
  const icons = {
    code: 0,
    message: '',
    data: {
      items: [
        { id: 'icon', name: 'Picture', groupId: 'group', icon: 'data:image/png;base64,dGVzdA==', create_time: 1 },
      ],
    },
  };
  return {
    getIconGroupList: vi.fn(async () => groups),
    getIconGroupItemList: vi.fn(async () => icons),
    addIconGroup: vi.fn(),
    updateIconGroup: vi.fn(),
    deleteIconGroup: vi.fn(),
    addIconGroupItem: vi.fn(async () => ({ code: 0, message: '', data: { id: 'added-icon' } })),
    deleteIconGroupItem: vi.fn(),
  };
}

describe('IconCatalog API records', () => {
  it('accepts raw responses and adds the catalog display fields', async () => {
    const service = apiService();
    const catalog = new IconCatalog(service);
    try {
      await catalog.initIconGroupList(IconGroupType.Img);
      await catalog.selectGroup({ type: IconGroupType.Img, groupId: 'group' });
      const group = catalog.imgGroup.serverGroupList[0];
      expect(group).toMatchObject({ id: 'group', name: 'Pictures', editable: true });
      expect(isObservableArray(group.icons)).toBe(true);
      expect(group.icons[0]).toMatchObject({ id: 'icon', category: 'group', groupId: 'group' });
      const response = await service.getIconGroupItemList('group');
      expect(response.data!.items[0]).not.toHaveProperty('category');
    } finally {
      catalog.clear();
    }
  });

  it('adds a new icon with the group display category', async () => {
    const catalog = new IconCatalog(apiService());
    try {
      catalog.imgGroup.serverGroupList.replace(await catalog.fetchIconGroupList(IconGroupType.Img));
      const group = catalog.imgGroup.serverGroupList[0];
      await catalog.addIcon({ group, name: 'New picture', icon: 'data:image/png;base64,dGVzdA==' });
      expect(group.icons[0]).toMatchObject({ id: 'added-icon', name: 'New picture', category: 'group' });
    } finally {
      catalog.clear();
    }
  });

  it('keeps display metadata supplied by existing service adapters', async () => {
    const service = apiService();
    const icon = {
      id: 'icon',
      name: 'Picture',
      groupId: 'group',
      icon: 'data:image/png;base64,dGVzdA==',
      category: 'custom-category',
      categoryCN: '自定义分类',
    };
    vi.spyOn(service, 'getIconGroupItemList').mockResolvedValue({ code: 0, message: '', data: { items: [icon] } });
    const catalog = new IconCatalog(service);
    try {
      catalog.imgGroup.serverGroupList.replace(await catalog.fetchIconGroupList(IconGroupType.Img));
      await catalog.selectGroup({ type: IconGroupType.Img, groupId: 'group' });
      expect(catalog.imgGroup.serverGroupList[0].icons[0]).toMatchObject(icon);
    } finally {
      catalog.clear();
    }
  });
});

describe('IconCatalog session cleanup', () => {
  it('does not restore old icons or create a group after its session is cleared', async () => {
    let resolve!: (value: Awaited<ReturnType<IconCatalogService['getIconGroupList']>>) => void;
    const service = {
      getIconGroupList: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      ),
      addIconGroup: vi.fn(),
    } as unknown as IconCatalogService;
    const catalog = new IconCatalog(service);
    const pending = catalog.initIconGroupList(IconGroupType.Img);
    catalog.clear();
    resolve({ code: 499, message: '' });
    await pending;
    expect(catalog.imgGroup.initailized).toBe(false);
    expect(catalog.imgGroup.serverGroupList).toHaveLength(0);
    expect(service.addIconGroup).not.toHaveBeenCalled();
  });

  it('ignores a group creation finishing after cleanup', async () => {
    let resolve!: (value: Awaited<ReturnType<IconCatalogService['addIconGroup']>>) => void;
    const service = {
      addIconGroup: vi.fn(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      ),
    } as unknown as IconCatalogService;
    const catalog = new IconCatalog(service);
    const pending = catalog.addNewGroup(IconGroupType.Img);
    catalog.clear();
    resolve({ code: 0, message: '', data: { id: 'old-session-group' } });
    await pending;
    expect(catalog.imgGroup.currentGroupId).toBeUndefined();
    expect(catalog.imgGroup.serverGroupList).toHaveLength(0);
  });
});
