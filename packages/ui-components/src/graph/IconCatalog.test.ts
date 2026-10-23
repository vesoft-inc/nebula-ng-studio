import { describe, expect, it, vi } from 'vitest';
import { IconCatalog } from './IconCatalog';
import { IconGroupType } from './constants';
import type { IconCatalogService } from './iconService';

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
