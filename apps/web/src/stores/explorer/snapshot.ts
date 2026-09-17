import { makeAutoObservable, observable, ObservableSet, runInAction } from 'mobx';
import { DisplayedPropertyItem, IGraph, RawEntityType, Snapshot, SnapshotData } from '@studio/interfaces/explorer';
import {
  addSnapshot,
  deleteSnapshot,
  getSnapshotDetail,
  fetchSnapshots,
  updateSnapShot,
} from '@studio/services/explorer';
import { execGql } from '@studio/services';
import { safeParse } from '@studio/utils/explorer/helper';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { GraphWorkspaceStore } from '../graph/workspace';
import type { Settings4GraphStore } from '@studio/components/Settings/constants';
import { migrateSnapshotEdgeIds, SerializedSnapshotGraphData } from '@studio/utils/graph/base/migrateSnapshotEdgeIds';
import type { RootStore } from '..';
import type { ISchemaItem } from '@studio/interfaces';

function createSet<T extends string>(items: T[]): Set<T> {
  return new Set(items);
}

const AttrSet = createSet(['nodes', 'links', 'nodesSelected', 'linksSelected']);
const AttrArray = Array.from(['displayedNodePropertyItems', 'displayedEdgePropertyItems', 'filterList']);

/**
 * SnapShot Store Data Structure
 * nodes: NodeObject[];
 * links: LinkObject[];
 * nodesSelected: NodeObject[];
 * linksSelected: LinkObject[];
 * nowDataMap: Record<string, NodeObject | LinkObject>;
 */
export class ExplorerStore {
  rootStore: RootStore;
  snapshots = observable.array<Snapshot>([], { deep: false });
  currentPage = 1;
  pageSize = 9;
  total = 0;
  graphItems = observable.array<IGraph>([]);
  graphWorkspace!: GraphWorkspaceStore;
  loading?: boolean;

  // Global settings
  settings: Settings4GraphStore;

  constructor({ rootStore, settings }: { rootStore: RootStore; settings: Settings4GraphStore }) {
    makeAutoObservable(this, {
      rootStore: false,
      snapshots: observable.shallow,
      graphWorkspace: observable.ref,
      settings: observable.shallow,
    });
    this.rootStore = rootStore;
    this.settings = settings;
  }

  get currentSchema() {
    return this.rootStore.schemaStore.currentSchema;
  }

  updateSettings = (fn: (prev: Settings4GraphStore) => Settings4GraphStore) => {
    this.settings = fn({ ...this.settings });
    this.graphWorkspace?.updateSettings(this.settings);
  };

  updateGraphItems = (items: IGraph[]) => {
    this.graphItems.replace(items);
  };

  getGraphItems = async () => {
    const res = await execGql<{ tables: IGraph[] }>('SHOW GRAPHS');
    if (res.code === 0) {
      this.updateGraphItems(res.data?.tables || []);
    }
  };

  getSchemaItems = async () => {
    const res = await execGql<{ tables: ISchemaItem[] }>('SHOW SCHEMAS');
    if (res.code === 0) {
      this.rootStore.schemaStore.updateSchemas(res.data?.tables || []);
    }
  };

  getCurrentSchema = async () => {
    const initialSchemaPath = this.currentSchema?.path;
    const res = await execGql<{ tables: ISchemaItem[] }>('SHOW CURRENT_SCHEMA');
    const currentSchema = res.data?.tables?.[0];
    if (res.code === 0 && currentSchema && this.currentSchema?.path === initialSchemaPath) {
      this.rootStore.schemaStore.updateCurrentSchame(currentSchema);
    }
  };

  getSnapshots = async (
    page: number,
    filter?: {
      graph?: string;
      name?: string;
    }
  ) => {
    const schemaPath = this.currentSchema?.path;
    if (!schemaPath) return;

    this.updateLoading(true);
    const res = await fetchSnapshots({
      page,
      pageSize: this.pageSize,
      filter: JSON.stringify({
        ...filter,
        schema_path: schemaPath,
      }),
    });
    this.updateLoading(false);
    if (res.code === 0) {
      runInAction(() => {
        this.snapshots.replace(res.data?.items || []);
        this.total = res.data?.total || 0;
      });
    }
  };

  updatePage = (page: number) => {
    this.currentPage = page;
  };

  updateGraphWorkspace = (graphWorkspace?: GraphWorkspaceStore) => {
    if (this.graphWorkspace && this.graphWorkspace !== graphWorkspace) {
      this.graphWorkspace.destroy();
    }
    this.graphWorkspace = graphWorkspace!;
  };

  updateLoading = (loading: boolean) => {
    this.loading = loading;
  };

  openSnapshot = async (snapshotId: string, graphWorkspace: GraphWorkspaceStore) => {
    this.updateGraphWorkspace(graphWorkspace);
    this.updateLoading(true);
    // Keep the canvas gated on the screenshot restore instead of flashing the empty state while
    // the payload is fetched, parsed and applied.
    graphWorkspace.setRestoreState('restoring');
    const snapshotDetail = await this.getSnapshotDetail(snapshotId).finally(() => this.updateLoading(false));
    if (this.graphWorkspace !== graphWorkspace) return;
    try {
      if (snapshotDetail) {
        // SAFETY: the detail API serializes `SnapshotData` as a JSON string while `Snapshot.data` is typed as parsed data.
        const data = this.importSnapshotTransfer(snapshotDetail.data as unknown as string);
        graphWorkspace.initSnapShot({
          ...snapshotDetail,
          data,
        });
      }
    } finally {
      graphWorkspace.setRestoreState('ready');
    }
  };

  addSnapshot = async (data: { name: string; graph: string; graph_type: string }) => {
    const res = await addSnapshot({
      ...data,
      schema_path: this.currentSchema?.path ?? '',
    });
    if (res.code !== 0 || !res.data) {
      return;
    }
    return res.data;
  };

  editSnapshot = async (snapshot: Omit<Snapshot, 'data'>) => {
    const res = await updateSnapShot(snapshot);
    return res;
  };

  deleteSnapshot = async (id: string) => {
    const res = await deleteSnapshot(id);
    const flag = res.code === 0;
    if (flag) {
      // Keep the Console "one snapshot per result" mapping from pointing at a deleted snapshot.
      this.rootStore?.consoleStore?.removeResultSnapshotsBySnapshotId(id);
    }
    return flag;
  };

  getSnapshotDetail = async (id: string) => {
    const res = await getSnapshotDetail(id);
    if (res.code !== 0 || !res.data) {
      return;
    }
    return res.data;
  };

  saveSnapShotDetail = async (snapshot: Snapshot) => {
    const data = this.exportSnapshotTransfer(snapshot.data!);
    const res = await updateSnapShot({
      ...snapshot,
      data: JSON.stringify(data),
    });
    return res;
  };

  /**
   * transfer snapshot data from jsonstring to SnapshotData
   * @param dataStr
   * @returns
   */
  importSnapshotTransfer = (dataStr: string) => {
    const [data, err] = safeParse<SnapshotData>(dataStr) || ({} as SnapshotData);
    if (err) {
      // console.error('importSnapshotTransfer error', err);
      return;
    }
    // SAFETY: `safeParse` yields the serialized shape (string endpoints/ids) that must be migrated before use.
    migrateSnapshotEdgeIds(data as unknown as SerializedSnapshotGraphData);

    // handle imagesCache
    // SAFETY: the serialized form is an array of [key, src] tuples, not the runtime Map.
    (data.imagesCache as unknown as [string, string | HTMLImageElement][]).forEach((item) => {
      if (Array.isArray(item) && item.length !== 2) {
        return;
      }
      if (typeof item[1] === 'string') {
        const img = new Image();
        img.src = item[1];
        item[1] = img;
      }
    });

    // handle nodes & links
    Array.from(AttrSet).forEach((key) => {
      // SAFETY: serialized sets are stored as id arrays until rebuilt below.
      const items = data[key] as unknown as Array<string>;
      // SAFETY: `nowDataMap` is a plain object of serialized entries until rebuilt below.
      const nowDataMap = data.nowDataMap as unknown as Record<string, NodeObject | LinkObject>;
      if (items?.length) {
        if (key === 'nodes' || key === 'nodesSelected') {
          // @ts-expect-error
          data[key] = observable.set<NodeObject>(items.map((id) => nowDataMap?.[id] as NodeObject).filter(Boolean), {
            deep: false,
          });
        }
        if (key === 'links' || key === 'linksSelected') {
          // @ts-expect-error
          data[key] = observable.set<LinkObject>(items.map((id) => nowDataMap?.[id] as LinkObject).filter(Boolean), {
            deep: false,
          });
        }
      }
    });

    // make link's node string=>object
    data.links?.forEach((link) => {
      // SAFETY: link endpoints are serialized as ids resolved through the serialized `nowDataMap` object.
      const nowDataMap = data.nowDataMap as unknown as Record<string, NodeObject>;
      link.source = nowDataMap[link.source as string] || ({} as NodeObject);
      link.target = nowDataMap[link.target as string] || ({} as NodeObject);
    });

    // handle nowDataMap
    data.nowDataMap = new Map<string, NodeObject | LinkObject>(Object.entries(data.nowDataMap));

    // handle ObservableArray
    AttrArray.forEach((key) => {
      const items = (data[key as keyof SnapshotData] || []) as unknown;
      // @ts-expect-error
      data[key] = observable.array(items, {
        deep: false,
      });
    });
    return data;
  };

  /**
   * before save/download snapshot, make all attributes in data can be serialized
   */
  exportSnapshotTransfer = (data: SnapshotData) => {
    // node id may be number 0, check it
    // SAFETY: the exported object is assembled dynamically and is only consumed by `JSON.stringify`.
    const ret = {
      version: process.env.VERSION,
    } as Record<string, unknown>;

    // handle nowDataMap
    const { nowDataMap } = data;
    const dataMap = Array.from(nowDataMap.entries()).reduce(
      (dataMap: Record<string, NodeObject | LinkObject>, item: [string, NodeObject | LinkObject]) => {
        const [key, value] = item;
        dataMap[key] = { ...value };
        if (value.data.type === RawEntityType.EDGE) {
          dataMap[key].target = (nowDataMap.get(key)?.target as NodeObject).id;
          dataMap[key].source = (nowDataMap.get(key)?.source as NodeObject).id;
        }
        return dataMap;
      },
      {} as Record<string, NodeObject | LinkObject>
    );
    ret.nowDataMap = dataMap;

    // handle imagesCache
    const { imagesCache } = data;
    if (imagesCache) {
      ret.imagesCache = Array.from(imagesCache).map(([key, img]) => [
        key,
        img instanceof HTMLImageElement ? img.src : img,
      ]);
    }
    // handle ObservableSet
    Array.from(AttrSet).forEach((key) => {
      ret[key] = Array.from(data[key] as ObservableSet).map((i) => i.id);
    });

    // handle ObservableArray
    AttrArray.forEach((key) => {
      ret[key] = Array.from(data[key as keyof SnapshotData] as Array<DisplayedPropertyItem>);
    });

    return ret;
  };

  destroy = () => {
    this.updateGraphWorkspace(undefined);
    this.snapshots.clear();
    this.graphItems.clear();
    this.currentPage = 1;
    this.total = 0;
    this.loading = false;
  };
}
