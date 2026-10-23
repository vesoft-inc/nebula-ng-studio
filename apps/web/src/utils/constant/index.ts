// Compatibility facade; implementation lives in ui-components.
export {
  VisualEditorType,
  GraphTypeAction,
  SchemaItemType,
  EmptyResultId,
  DecimalTypePattern,
  ListTypePattern,
  DEFAULT_SCHEMA_PATH,
  ForwardEdgePattern,
  BackwardEdgePattern,
  UndirectedEdgePattern,
} from '@vesoft-inc/ui-components/utilities';

export enum AppTarget {
  Studio = 'STUDIO',
  Gui = 'GUI',
}

export const LANG_KEY = 'studio-lng';
