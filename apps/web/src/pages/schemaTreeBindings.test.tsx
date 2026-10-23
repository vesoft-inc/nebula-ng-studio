// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadSchemaTreeNode, useSchemaTreeBindings } from './schemaTreeBindings';
import { commonStore, schemaStore } from '@studio/stores/session';
import { SchemaItemType } from '@studio/utils/constant';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@studio/stores/useModal', () => ({ useModal: () => ({ message: { success: vi.fn() } }) }));
vi.mock('@studio/stores/session', () => ({
  commonStore: { userInfo: { curSchemaPath: '/a' }, setSchemaPath: vi.fn() },
  schemaStore: {
    currentSchema: { path: '/a' },
    schemas: [],
    switchingSchema: false,
    switchSchema: vi.fn(),
    updateGraphTypeDetailBySchema: vi.fn(),
    updateEntityTypeDescsBySchema: vi.fn(),
  },
}));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

it('switches Console Schema through the session lifecycle without a browser reload', async () => {
  vi.mocked(schemaStore.switchSchema).mockResolvedValueOnce({ code: 0, message: '' });
  const { result } = renderHook(() => useSchemaTreeBindings(true));
  await expect(result.current.selector.onSwitchSchema({ path: '/b', name: 'b', owner: '' })).resolves.toBe(true);
  expect(commonStore.setSchemaPath).toHaveBeenCalledWith('/b');
  expect(navigate).not.toHaveBeenCalled();
});

it('keeps the current session Schema when a switch fails', async () => {
  vi.mocked(schemaStore.switchSchema).mockResolvedValueOnce({ code: 500, message: 'failed' });
  const { result } = renderHook(() => useSchemaTreeBindings(true));
  await expect(result.current.selector.onSwitchSchema({ path: '/b', name: 'b', owner: '' })).resolves.toBe(false);
  expect(commonStore.setSchemaPath).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

it('loads names containing separators from node data instead of splitting presentation keys', async () => {
  await loadSchemaTreeNode(
    {
      key: 'GraphTypeDescItem-book-type',
      rawData: {
        type: SchemaItemType.GraphTypeDescItem,
        graphType: { graph_type: 'book-type' },
      },
    } as Parameters<typeof loadSchemaTreeNode>[0],
    true
  );
  expect(schemaStore.updateGraphTypeDetailBySchema).toHaveBeenCalledWith('book-type');
  await loadSchemaTreeNode(
    {
      key: 'EntityTypeDescItem-book-type-book-node',
      rawData: {
        type: SchemaItemType.EntityTypeDescItem,
        entity: { graph_type_name: 'book-type', type_name: 'book-node' },
      },
    } as Parameters<typeof loadSchemaTreeNode>[0],
    true
  );
  expect(schemaStore.updateEntityTypeDescsBySchema).toHaveBeenCalledWith('book-type', 'book-node');
});
