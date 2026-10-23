import type { SchemaServices } from '@vesoft-inc/ui-components/schema/model';
import { changeSchema, execGql, importDataParams } from './nebula';
import { sweepStaleGraphTypeLayouts } from './schemaLayout';

export function createSchemaServices(
  getIdentity: () => { address?: string; username?: string } | undefined
): SchemaServices {
  return {
    execute: execGql,
    switchSchema: changeSchema,
    importDataset: importDataParams,
    sweepLayouts: (schemaPath, names) => sweepStaleGraphTypeLayouts({ ...getIdentity(), schemaPath }, names),
  };
}
