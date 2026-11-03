// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Fragment, StrictMode, useEffect, useMemo } from 'react';
import { UiProvider } from './provider';
import { SchemaProvider } from './schema/context';
import SchemaController from './schema/SchemaController';
import GraphTypeList from './schema/GraphTypeList';
import { ExplorerSession, type ExplorerSessionProps } from './explorer/ExplorerSession';
import SnapshotList from './explorer/Snapshots';
import { StudioShell } from './shell/StudioShell';
import type { QueryExecutor } from './shared/query';
import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { SnapshotServices } from './explorer/services';
// jsdom cannot initialize WebGL; these tests exercise composition and list navigation.
vi.mock('./graph/utils/layouts', () => ({ default: {} }));

const execute: QueryExecutor = async <T extends object>(gql: string): Promise<ServerResponse<T>> => ({
  code: 0,
  message: '',
  data: {
    tables:
      gql === 'SHOW CURRENT_SCHEMA' || gql === 'SHOW SCHEMAS'
        ? [{ name: 'demo', path: '/demo', owner: 'user' }]
        : gql === 'SHOW GRAPH TYPES'
          ? [{ graph_type: 'people', owner: 'user', schema: '/demo', entities: [] }]
          : gql === 'SHOW GRAPHS'
            ? [{ name: 'demo', graph_type: 'people' }]
            : [],
  } as unknown as T,
});

function SnapshotsHost({
  onOpen,
  ...props
}: Omit<ExplorerSessionProps, 'children'> & { onOpen?: (id: string) => void }) {
  return (
    <ExplorerSession {...props}>
      <SnapshotList onOpen={onOpen} />
    </ExplorerSession>
  );
}
function SchemaHost() {
  const controller = useMemo(() => new SchemaController({ execute }), []);
  useEffect(() => () => controller.destroy(), [controller]);
  return (
    <SchemaProvider value={controller}>
      <GraphTypeList />
    </SchemaProvider>
  );
}

afterEach(cleanup);

describe('standalone business workbenches', () => {
  it('composes Schema with the shell without a router or application stores', async () => {
    render(
      <StrictMode>
        <UiProvider locale="en_US">
          <StudioShell headerProps={{ logo: 'Consumer' }}>
            <SchemaHost />
          </StudioShell>
        </UiProvider>
      </StrictMode>
    );
    expect(await screen.findByText('people')).toBeTruthy();
    expect(screen.getByText('Consumer')).toBeTruthy();
  });

  it('opens a snapshot through the consumer callback without a router', async () => {
    const onOpen = vi.fn();
    render(
      <StrictMode>
        <UiProvider locale="en_US">
          <SnapshotsHost
            onOpen={onOpen}
            services={{
              execute,
              snapshots: {
                list: async () => ({
                  code: 0,
                  message: '',
                  data: {
                    total: 1,
                    page: 1,
                    pageSize: 9,
                    items: [
                      {
                        id: 'snapshot-1',
                        name: 'Saved exploration',
                        graph: 'demo',
                        graph_type: 'people',
                        created_at: '',
                        updated_at: '',
                        schemaPath: '/demo',
                      },
                    ],
                  },
                }),
                create: vi.fn(),
                read: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
              },
            }}
          />
        </UiProvider>
      </StrictMode>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Saved exploration' }));
    expect(onOpen).toHaveBeenCalledWith('snapshot-1');
  });

  it('keeps snapshot filters when searching from a later page and paging the results', async () => {
    let delayNextPage = false;
    let completePage: () => void = () => {};
    const list = vi.fn<SnapshotServices['list']>(async ({ page, pageSize, filter }) => {
      const { name } = JSON.parse(filter!);
      const response = {
        code: 0,
        message: '',
        data: {
          total: 27,
          page,
          pageSize,
          items: [
            {
              id: `${name || 'all'}-${page}`,
              name: `${name || 'all'}-${page}`,
              graph: 'demo',
              graph_type: 'people',
              created_at: '',
              updated_at: '',
              schemaPath: '/demo',
            },
          ],
        },
      };
      if (delayNextPage) {
        delayNextPage = false;
        return new Promise<typeof response>((resolve) => {
          completePage = () => resolve(response);
        });
      }
      return response;
    });
    render(
      <UiProvider locale="en_US">
        <SnapshotsHost
          services={{
            execute,
            snapshots: { list, create: vi.fn(), read: vi.fn(), update: vi.fn(), delete: vi.fn() },
          }}
        />
      </UiProvider>
    );
    await screen.findByText('all-1');
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await screen.findByText('all-2');

    fireEvent.change(screen.getByRole('textbox', { name: 'Exploration Name' }), { target: { value: 'needle' } });
    await screen.findByText('needle-1');
    expect(list).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'page 1' }).getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    await screen.findByText('needle-2');
    expect(JSON.parse(list.mock.lastCall![0].filter!)).toEqual({ name: 'needle', schema_path: '/demo' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Exploration Name' }), { target: { value: '' } });
    await screen.findByText('all-1');
    expect(JSON.parse(list.mock.lastCall![0].filter!)).toEqual({ schema_path: '/demo' });

    delayNextPage = true;
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Exploration Name' }), { target: { value: 'latest' } });
    await screen.findByText('latest-1');
    await act(async () => completePage());
    expect(screen.getByText('latest-1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'page 1' }).getAttribute('aria-current')).toBe('page');
  });

  it.each([false, true])('starts a fresh snapshot search after switching Schema (StrictMode=%s)', async (strict) => {
    let schemaPath = '/a';
    const query: QueryExecutor = async <T extends object>(gql: string) => {
      if (gql.startsWith('SESSION SET SCHEMA')) schemaPath = '/b';
      if (gql === 'SHOW CURRENT_SCHEMA' || gql === 'SHOW SCHEMAS') {
        const paths = gql === 'SHOW CURRENT_SCHEMA' ? [schemaPath] : ['/a', '/b'];
        return {
          code: 0,
          message: '',
          data: { tables: paths.map((path) => ({ name: path.slice(1), path, owner: 'user' })) } as unknown as T,
        };
      }
      return execute<T>(gql);
    };
    const list = vi.fn<SnapshotServices['list']>(async ({ page, pageSize, filter }) => {
      const { name, schema_path } = JSON.parse(filter!);
      return {
        code: 0,
        message: '',
        data: {
          total: 27,
          page,
          pageSize,
          items: [
            {
              id: `${schema_path}-${name || 'all'}-${page}`,
              name: `${schema_path}-${name || 'all'}-${page}`,
              graph: 'demo',
              graph_type: 'people',
              created_at: '',
              updated_at: '',
              schemaPath: schema_path,
            },
          ],
        },
      };
    });
    const Wrapper = strict ? StrictMode : Fragment;
    render(
      <Wrapper>
        <UiProvider locale="en_US">
          <SnapshotsHost
            services={{
              execute: query,
              snapshots: { list, create: vi.fn(), read: vi.fn(), update: vi.fn(), delete: vi.fn() },
            }}
          />
        </UiProvider>
      </Wrapper>
    );
    await screen.findByText('/a-all-1');
    fireEvent.change(screen.getByRole('textbox', { name: 'Exploration Name' }), { target: { value: 'needle' } });
    await screen.findByText('/a-needle-1');
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    await screen.findByText('/a-needle-3');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Schema' }));
    fireEvent.click(await screen.findByRole('option', { name: '/b' }));
    await waitFor(() => {
      const requests = list.mock.calls
        .map(([request]) => request)
        .filter((request) => JSON.parse(request.filter!).schema_path === '/b');
      expect(requests).toHaveLength(1);
      expect(requests[0].page).toBe(1);
      expect(JSON.parse(requests[0].filter!)).toEqual({ schema_path: '/b' });
    });
    expect(await screen.findByText('/b-all-1')).toBeTruthy();
    expect((screen.getByRole('textbox', { name: 'Exploration Name' }) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'page 1' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows custom initial settings and preserves them when another setting changes without a settings service', async () => {
    render(
      <UiProvider locale="en_US">
        <SnapshotsHost
          initialSettings={{ queryTimeout: 45, maxRowsLimit: 500, maxNeighborsLimit: 800 }}
          services={{
            execute,
            snapshots: {
              list: async () => ({ code: 0, message: '', data: { total: 0, page: 1, pageSize: 9, items: [] } }),
              create: vi.fn(),
              read: vi.fn(),
              update: vi.fn(),
              delete: vi.fn(),
            },
          }}
        />
      </UiProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Explorer settings' }));
    const timeout = screen.getByDisplayValue('45');
    expect(screen.getByDisplayValue('500')).toBeTruthy();
    expect(screen.getByDisplayValue('800')).toBeTruthy();
    fireEvent.change(timeout, { target: { value: '60' } });
    fireEvent.blur(timeout);
    await waitFor(() => expect(screen.getByDisplayValue('60')).toBeTruthy());
    expect(screen.getByDisplayValue('500')).toBeTruthy();
    expect(screen.getByDisplayValue('800')).toBeTruthy();
  });
});
