import { makeAutoObservable, observable, runInAction } from 'mobx';
import type { IGraph, Snapshot, SnapshotData } from '../graph/types/index';
import type { ExplorerServices } from './services';
import { EXPLORER_DEFAULT_SETTINGS, type ExplorerSettings } from '../shared/Settings/constants';
import { safeParse } from '../graph/helpers';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { GraphWorkspaceStore } from '../graph/stores/workspace';
import type { Settings4GraphStore } from '../shared/Settings/constants';
import { migrateSnapshotEdgeIds, SerializedSnapshotGraphData } from '../graph/utils/base/migrateSnapshotEdgeIds';
import type { ISchemaItem } from '../schema/types';
import type SchemaStore from '../schema/SchemaController';
import {
  exportSnapshotTransfer,
  SNAPSHOT_SET_FIELDS as AttrSet,
  SNAPSHOT_ARRAY_FIELDS as AttrArray,
} from './snapshotTransfer';

export { exportSnapshotTransfer } from './snapshotTransfer';

/**
 * SnapShot Store Data Structure
 * nodes: NodeObject[];
 * links: LinkObject[];
 * nodesSelected: NodeObject[];
 * linksSelected: LinkObject[];
 * nowDataMap: Record<string, NodeObject | LinkObject>;
 */
export class ExplorerStore {
  snapshots = observable.array<Snapshot>([], { deep: false });
  currentPage = 1;
  pageSize = 9;
  total = 0;
  graphItems = observable.array<IGraph>([]);
  graphWorkspace!: GraphWorkspaceStore;
  loading?: boolean;

  // Global settings
  settings: Settings4GraphStore;

  constructor({
    settings,
    schemaStore,
    services,
  }: {
    settings: Settings4GraphStore;
    schemaStore: SchemaStore;
    services: ExplorerServices;
  }) {
    this.schemaStore = schemaStore;
    this.services = services;
    const { appConfigForm, personalConfigForm } = EXPLORER_DEFAULT_SETTINGS;
    this.settingsGroups = {
      appConfigForm: {
        queryTimeout: settings.queryTimeout ?? appConfigForm.queryTimeout,
        maxRowsLimit: settings.maxRowsLimit ?? appConfigForm.maxRowsLimit,
        maxNeighborsLimit: settings.maxNeighborsLimit ?? appConfigForm.maxNeighborsLimit,
      },
      personalConfigForm: {
        displayPropertiesOnHover: settings.displayPropertiesOnHover ?? personalConfigForm.displayPropertiesOnHover,
        highlightNeighborsOnHover: settings.highlightNeighborsOnHover ?? personalConfigForm.highlightNeighborsOnHover,
      },
    };
    this.settings = { ...settings, ...this.settingsGroups.appConfigForm, ...this.settingsGroups.personalConfigForm };
    makeAutoObservable<this, 'abort'>(this, {
      schemaStore: false,
      services: false,
      abort: false,
      snapshots: observable.shallow,
      graphWorkspace: observable.ref,
      settings: observable.shallow,
    });
  }

  schemaStore: SchemaStore;
  services: ExplorerServices;
  private generation = 0;
  private listVersion = 0;
  private settingsVersion = 0;
  private abort = new AbortController();
  settingsLoading = false;
  settingsGroups: ExplorerSettings;

  get currentSchema() {
    return this.schemaStore.currentSchema;
  }

  updateSettings = (fn: (prev: Settings4GraphStore) => Settings4GraphStore) => {
    this.settings = fn({ ...this.settings });
    this.graphWorkspace?.updateSettings(this.settings);
  };

  updateGraphItems = (items: IGraph[]) => {
    this.graphItems.replace(items);
  };

  getGraphItems = async () => {
    const generation = this.generation;
    const path = this.currentSchema.path;
    const res = await this.services.execute<{ tables: IGraph[] }>('SHOW GRAPHS', { signal: this.abort.signal });
    if (res.code === 0) {
      if (generation === this.generation && path === this.currentSchema.path)
        this.updateGraphItems(res.data?.tables || []);
    }
  };

  getSchemaItems = async () => {
    const generation = this.generation;
    const res = await this.services.execute<{ tables: ISchemaItem[] }>('SHOW SCHEMAS', { signal: this.abort.signal });
    if (res.code === 0) {
      if (generation === this.generation) this.schemaStore.updateSchemas(res.data?.tables || []);
    }
  };

  getCurrentSchema = () => this.schemaStore.refreshCurrentSchema();

  getSnapshots = async (
    page: number,
    filter?: {
      graph?: string;
      name?: string;
    }
  ) => {
    const schemaPath = this.currentSchema?.path;
    if (!schemaPath) return;

    const version = ++this.listVersion;
    const generation = this.generation;
    this.updateLoading(true);
    const res = await this.services.snapshots
      .list(
        {
          page,
          pageSize: this.pageSize,
          filter: JSON.stringify({
            ...filter,
            schema_path: schemaPath,
          }),
        },
        { signal: this.abort.signal }
      )
      .finally(() => {
        if (version === this.listVersion && generation === this.generation) this.updateLoading(false);
      });
    if (version !== this.listVersion || generation !== this.generation || schemaPath !== this.currentSchema.path)
      return;
    if (res.code === 0) {
      runInAction(() => {
        this.currentPage = Math.max(1, page);
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
    try {
      const snapshotDetail = await this.getSnapshotDetail(snapshotId);
      if (this.graphWorkspace !== graphWorkspace || !snapshotDetail) return;
      const { schemaPath } = snapshotDetail;
      if (!schemaPath) throw new Error('Snapshot schema is missing');

      // A queued switch may still change the session, even when the current path already matches.
      if (this.currentSchema.path !== schemaPath || this.schemaStore.switchingSchema) {
        const res = await this.schemaStore.switchSchema(schemaPath);
        if (res.code !== 0) throw new Error('Failed to restore snapshot schema');
        this.services.onSchemaChanged?.(schemaPath);
      }
      if (this.graphWorkspace !== graphWorkspace) return;

      // SAFETY: the detail API serializes `SnapshotData` as a JSON string while `Snapshot.data` is typed as parsed data.
      const data = this.importSnapshotTransfer(snapshotDetail.data as unknown as string);
      graphWorkspace.initSnapShot({
        ...snapshotDetail,
        data,
      });
    } finally {
      if (this.graphWorkspace === graphWorkspace) {
        this.updateLoading(false);
        graphWorkspace.setRestoreState('ready');
      }
    }
  };

  addSnapshot = async (data: { name: string; graph: string; graph_type: string }) => {
    const res = await this.services.snapshots.create({
      ...data,
      schema_path: this.currentSchema?.path ?? '',
    });
    if (res.code !== 0 || !res.data) {
      return;
    }
    return res.data;
  };

  editSnapshot = async (snapshot: Omit<Snapshot, 'data'>) => {
    const res = await this.services.snapshots.update(snapshot);
    return res;
  };

  deleteSnapshot = async (id: string) => {
    const res = await this.services.snapshots.delete(id);
    const flag = res.code === 0;
    if (flag) {
      // Keep the Console "one snapshot per result" mapping from pointing at a deleted snapshot.
      this.services.onSnapshotDeleted?.(id);
    }
    return flag;
  };

  getSnapshotDetail = async (id: string) => {
    const res = await this.services.snapshots.read(id, { signal: this.abort.signal });
    if (res.code !== 0 || !res.data) {
      return;
    }
    return res.data;
  };

  saveSnapShotDetail = async (snapshot: Snapshot) => {
    const data = this.exportSnapshotTransfer(snapshot.data!);
    const res = await this.services.snapshots.update({
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
    ((data.imagesCache ?? []) as unknown as [string, string | HTMLImageElement][]).forEach((item) => {
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

  /** Serialize snapshot data. Same function as the module export; kept on the instance for existing callers. */
  exportSnapshotTransfer = (data: SnapshotData) => exportSnapshotTransfer(data, this.services.snapshotVersion);

  loadSettings = async () => {
    if (!this.services.settings) return;
    const generation = this.generation;
    const version = ++this.settingsVersion;
    this.settingsLoading = true;
    try {
      const settings = await this.services.settings.load();
      if (generation !== this.generation || version !== this.settingsVersion) return;
      runInAction(() => {
        this.settingsGroups = {
          appConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.appConfigForm, ...settings.appConfigForm },
          personalConfigForm: { ...EXPLORER_DEFAULT_SETTINGS.personalConfigForm, ...settings.personalConfigForm },
        };
        this.updateSettings((prev) => ({
          ...prev,
          ...this.settingsGroups.appConfigForm,
          ...this.settingsGroups.personalConfigForm,
        }));
      });
    } finally {
      if (generation === this.generation && version === this.settingsVersion)
        runInAction(() => {
          this.settingsLoading = false;
        });
    }
  };

  setSettingsGroup = <K extends keyof ExplorerSettings>(key: K, value: ExplorerSettings[K]) => {
    this.settingsGroups = { ...this.settingsGroups, [key]: value };
    this.updateSettings((prev) => ({ ...prev, ...value }));
  };

  saveSettings = () => this.services.settings?.save(this.settingsGroups);

  destroy = () => {
    this.generation += 1;
    this.listVersion += 1;
    this.settingsVersion += 1;
    this.abort.abort();
    this.abort = new AbortController();
    this.settingsLoading = false;
    this.updateGraphWorkspace(undefined);
    this.snapshots.clear();
    this.graphItems.clear();
    this.currentPage = 1;
    this.total = 0;
    this.loading = false;
  };
}
