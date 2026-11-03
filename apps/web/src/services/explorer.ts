import {
  createStudioServerExplorerServices,
  createStudioServerIconServices,
} from '@vesoft-inc/studio-ui/adapters/studio-server';
import { fetcher, backgroundFetcher } from './fetcher';

/** Handoffs own their error message; keep their transport silent. */
export const backgroundSnapshotServices = createStudioServerExplorerServices({ http: backgroundFetcher }).snapshots;
export const studioIconServices = createStudioServerIconServices({ http: fetcher });
