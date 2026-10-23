import type { SchemaEditorServices } from '@vesoft-inc/ui-components/schema-editor/model';
import { execGql } from './nebula';
import { createSketch, deleteSketch, getSketchById, getSketchList } from './sketch';
import {
  readGraphTypeLayout,
  writeGraphTypeLayout,
  migrateGraphTypeLayout,
  type SchemaLayoutIdentity,
} from './schemaLayout';

/** Capture the identity when opening an editor so late saves keep their original scope. */
export function createSchemaEditorServices(
  identity: Omit<SchemaLayoutIdentity, 'graphTypeName'>
): SchemaEditorServices {
  return {
    execute: execGql,
    layouts: {
      read: (graphTypeName) => readGraphTypeLayout({ ...identity, graphTypeName }),
      write: (graphTypeName, layout) => writeGraphTypeLayout({ ...identity, graphTypeName }, layout),
      migrate: (from, to, layout) =>
        migrateGraphTypeLayout({ ...identity, graphTypeName: from }, { ...identity, graphTypeName: to }, layout),
    },
    sketches: { create: createSketch, read: getSketchById, list: getSketchList, delete: deleteSketch },
  };
}
