import type { SchemaServices } from '@vesoft-inc/studio-ui-internal/schema/model';
import type { StudioServerAdapters } from './studioServer';

export function createSchemaServices(
  getIdentity: () => { address?: string; username?: string } | undefined,
  adapters: StudioServerAdapters
): SchemaServices {
  return {
    execute: (gql, options) => adapters.schema(getIdentity()).execute(gql, options),
    switchSchema: (path) => adapters.schema(getIdentity()).switchSchema!(path),
    importDataset: (dataset) => adapters.schema(getIdentity()).importDataset!(dataset),
    sweepLayouts: (path, names) => adapters.schema(getIdentity()).sweepLayouts?.(path, names) ?? Promise.resolve(),
  };
}
