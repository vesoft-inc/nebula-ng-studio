import { describe, expect, it } from 'vitest';
import { schemaRouteView, schemaViewPath, type SchemaRoute } from './schemaRoutes';

describe('Schema route adapters', () => {
  it.each([
    ['schemas', '/schema-list', { type: 'schemas' }],
    ['graph-types', '/schema-manager/graphtype', { type: 'graph-types' }],
    ['graphs', '/schema-manager/graphs', { type: 'graphs' }],
    ['sketches', '/schema-manager/graphtype/sketch', { type: 'sketches' }],
    ['create', '/schema-manager/graphtype/create', { type: 'editor', mode: 'create' }],
    ['sketch', '/schema-manager/graphtype/sketch/42', { type: 'editor', mode: 'sketch', sketchId: 42 }],
  ] as const)('maps %s to its workbench view', (route, path, expected) => {
    expect(schemaRouteView(route, path)).toEqual(expected);
    expect(schemaViewPath(expected)).toBe(path);
  });

  it.each(['book-type', '电影类型', 'name/with slash', 'name?x#y%z', 'literal%2Fslash'])(
    'decodes resource names exactly once: %j',
    (name) => {
      const graph = { type: 'graph', name } as const;
      const edit = { type: 'editor', mode: 'edit', graphTypeName: name } as const;
      const view = { type: 'editor', mode: 'readonly', graphTypeName: name } as const;
      expect(schemaRouteView('graph', schemaViewPath(graph))).toEqual(graph);
      expect(schemaRouteView('edit', schemaViewPath(edit))).toEqual(edit);
      expect(schemaRouteView('view', schemaViewPath(view))).toEqual(view);
    }
  );

  it.each(['not-a-number', '0', '-1', '1.5', 'Infinity', '1e3', '9007199254740992'])('rejects sketch id %j', (id) => {
    expect(schemaRouteView('sketch', `/schema-manager/graphtype/sketch/${id}`)).toBeNull();
  });

  it.each([
    ['edit', '/schema-manager/unknown/edit/books'],
    ['edit', '/schema-manager/graphtype/edit/%'],
    ['edit', '/schema-manager/graphtype/edit/%E0%A4%A'],
    ['edit', '/schema-manager/graphtype/edit/books/extra'],
    ['create', '/schema-manager/graphtype/create/extra'],
    ['graph', '/schema-manager/graphs/'],
  ])('rejects an invalid %s route: %s', (route, path) => {
    expect(schemaRouteView(route as SchemaRoute, path)).toBeNull();
  });
});
