import { describe, expect, it } from 'vitest';

import { EdgeDirectionType, GraphEntityType, PropertyDataType } from '@vesoft-inc/utils';
import type { DescEdgeTypeResult, DescGraphTypeResult, DescNodeTypeResult } from '@vesoft-inc/utils';

import {
  buildDeleteGql,
  buildEntityMeta,
  buildInsertEdgeGql,
  buildInsertNodeGql,
  buildReadBackEdgeGql,
  buildReadBackNodeGql,
  buildSetPropertiesGql,
  encodeAssignments,
  encodePropertyLiteral,
  getEditableProperties,
  getEligibleEdgeTypeOptions,
  getInitialFormValues,
  isNullLike,
  validateEntityValues,
} from './dml';
import type { EntityMeta } from './dml';

const GRAPH = 'basketballplayer';

const nodeProperty = (overrides: Partial<DescNodeTypeResult>): DescNodeTypeResult => ({
  type_name: 'player',
  type: GraphEntityType.Node,
  property_name: 'id',
  data_type: PropertyDataType.STRING,
  primary_key: '',
  nullable: true,
  default: 'NULL',
  ...overrides,
});

const edgeProperty = (overrides: Partial<DescEdgeTypeResult>): DescEdgeTypeResult => ({
  type_name: 'serve',
  type: GraphEntityType.Edge,
  property_name: 'start_year',
  data_type: PropertyDataType.INT64,
  multi_edge_key: '',
  nullable: true,
  default: 'NULL',
  ...overrides,
});

const playerType: DescGraphTypeResult = {
  entity_type: GraphEntityType.Node,
  type_name: 'player',
  labels: ['player'],
  'primary_key/multiedge_key': ['id'],
  properties: ['id', 'name', 'age'],
  propertyInfos: [
    nodeProperty({ property_name: 'id', primary_key: 'Y', nullable: false, default: '' }),
    nodeProperty({ property_name: 'name' }),
    nodeProperty({ property_name: 'age', data_type: PropertyDataType.INT64 }),
  ],
};

const teamType: DescGraphTypeResult = {
  entity_type: GraphEntityType.Node,
  type_name: 'team',
  labels: ['team'],
  'primary_key/multiedge_key': ['id'],
  properties: ['id', 'name'],
  propertyInfos: [
    nodeProperty({ type_name: 'team', property_name: 'id', primary_key: 'Y', nullable: false, default: '' }),
    nodeProperty({ type_name: 'team', property_name: 'name' }),
  ],
};

const serveType: DescGraphTypeResult = {
  entity_type: GraphEntityType.Edge,
  type_name: 'serve',
  labels: ['serve'],
  'primary_key/multiedge_key': ['start_year', 'end_year'],
  properties: ['start_year', 'end_year'],
  type_pattern: '(player)-[serve]->(team)',
  propertyInfos: [
    edgeProperty({ property_name: 'start_year', multi_edge_key: 'Y', nullable: false, default: '' }),
    edgeProperty({ property_name: 'end_year', multi_edge_key: 'Y', nullable: false, default: '' }),
  ],
};

const followType: DescGraphTypeResult = {
  entity_type: GraphEntityType.Edge,
  type_name: 'follow',
  labels: ['follow'],
  'primary_key/multiedge_key': 'Auto',
  properties: ['degree'],
  type_pattern: '(player)-[follow]->(player)',
  propertyInfos: [edgeProperty({ type_name: 'follow', property_name: 'degree' })],
};

const playerMeta = buildEntityMeta(playerType, GRAPH);
const serveMeta = buildEntityMeta(serveType, GRAPH);
const followMeta = buildEntityMeta(followType, GRAPH);

describe('isNullLike', () => {
  it('treats empty and NULL as null', () => {
    expect(isNullLike(undefined)).toBe(true);
    expect(isNullLike(null)).toBe(true);
    expect(isNullLike('')).toBe(true);
    expect(isNullLike('  ')).toBe(true);
    expect(isNullLike('null')).toBe(true);
    expect(isNullLike('NULL')).toBe(true);
    expect(isNullLike('0')).toBe(false);
    expect(isNullLike('false')).toBe(false);
  });
});

describe('encodePropertyLiteral', () => {
  it('quotes and escapes strings', () => {
    expect(encodePropertyLiteral('Neo', PropertyDataType.STRING)).toBe('"Neo"');
    expect(encodePropertyLiteral('a"b', PropertyDataType.STRING)).toBe('"a\\"b"');
    expect(encodePropertyLiteral('a\\b', PropertyDataType.STRING)).toBe('"a\\\\b"');
    expect(encodePropertyLiteral('a\nb', PropertyDataType.STRING)).toBe('"a\\nb"');
  });

  it('encodes numbers, booleans and dates', () => {
    expect(encodePropertyLiteral('42', PropertyDataType.INT32)).toBe('42');
    expect(encodePropertyLiteral('9223372036854775807', PropertyDataType.INT64)).toBe('9223372036854775807');
    expect(encodePropertyLiteral('1.5', PropertyDataType.DOUBLE)).toBe('1.5');
    expect(encodePropertyLiteral('true', PropertyDataType.BOOL)).toBe('true');
    expect(encodePropertyLiteral('False', PropertyDataType.BOOL)).toBe('false');
    expect(encodePropertyLiteral('2024-01-02', PropertyDataType.DATE)).toBe('date("2024-01-02")');
    expect(encodePropertyLiteral('10:00:00', PropertyDataType.LOCAL_TIME)).toBe('local_time("10:00:00")');
    expect(encodePropertyLiteral('2024-01-02 10:00:00', PropertyDataType.LOCAL_DATETIME)).toBe(
      'local_datetime("2024-01-02 10:00:00")'
    );
    expect(encodePropertyLiteral('2024-01-02T10:00:00', PropertyDataType.ZONED_DATETIME)).toBe(
      'zoned_datetime("2024-01-02T10:00:00")'
    );
  });

  it('keeps raw literal types verbatim and nulls as NULL', () => {
    expect(encodePropertyLiteral('LIST[1,2]', PropertyDataType.LIST)).toBe('LIST[1,2]');
    expect(encodePropertyLiteral('', PropertyDataType.STRING)).toBe('NULL');
    expect(encodePropertyLiteral(undefined, PropertyDataType.INT64)).toBe('NULL');
  });
});

describe('validateEntityValues', () => {
  it('requires NOT NULL properties when adding', () => {
    const errors = validateEntityValues(playerMeta, { id: '', name: 'x', age: '' }, 'add');
    expect(errors).toEqual({ id: 'required' });
  });

  it('ignores empty nullable properties when adding', () => {
    const errors = validateEntityValues(playerMeta, { id: 'player999', name: '', age: '' }, 'add');
    expect(errors).toEqual({});
  });

  it('rejects invalid typed values', () => {
    expect(validateEntityValues(playerMeta, { id: 'p1', age: 'abc' }, 'add')).toEqual({ age: 'invalidInt' });
    expect(validateEntityValues(playerMeta, { id: 'p1', age: '99999999999999999999' }, 'add')).toEqual({
      age: 'invalidInt',
    });
    const boolMeta = buildEntityMeta(
      {
        ...playerType,
        propertyInfos: [
          nodeProperty({ property_name: 'id', primary_key: 'Y', nullable: false }),
          nodeProperty({ property_name: 'is_hot', data_type: PropertyDataType.BOOL }),
        ],
      },
      GRAPH
    );
    expect(validateEntityValues(boolMeta, { id: 'p1', is_hot: 'yes' }, 'add')).toEqual({ is_hot: 'invalidBool' });
  });

  it('skips identity properties while editing', () => {
    const errors = validateEntityValues(playerMeta, { id: '', name: '' }, 'edit');
    expect(errors).toEqual({});
  });

  it('requires NOT NULL multi-edge keys when adding edges', () => {
    const errors = validateEntityValues(serveMeta, { start_year: '2020' }, 'add');
    expect(errors).toEqual({ end_year: 'required' });
  });
});

describe('getEditableProperties', () => {
  it('excludes identity properties', () => {
    expect(getEditableProperties(playerMeta).map((item) => item.property_name)).toEqual(['name', 'age']);
    // `serve` only carries multi-edge key properties, so nothing can be updated.
    expect(getEditableProperties(serveMeta)).toEqual([]);
    expect(getEditableProperties(followMeta).map((item) => item.property_name)).toEqual(['degree']);
  });
});

describe('getInitialFormValues', () => {
  it('uses declared defaults when adding', () => {
    const meta = buildEntityMeta(
      {
        ...playerType,
        propertyInfos: [
          nodeProperty({ property_name: 'id', primary_key: 'Y', nullable: false, default: '' }),
          nodeProperty({ property_name: 'name', default: '"unknown"' }),
        ],
      },
      GRAPH
    );
    expect(getInitialFormValues(meta)).toEqual({ id: '', name: '"unknown"' });
  });

  it('prefers existing values when editing', () => {
    expect(getInitialFormValues(playerMeta, { id: 'player999', age: 31, name: null }, 'edit')).toEqual({
      id: 'player999',
      name: '',
      age: '31',
    });
  });
});

describe('buildInsertNodeGql', () => {
  it('binds the element type and omits null properties', () => {
    expect(buildInsertNodeGql({ meta: playerMeta, values: { id: 'player999', name: 'Neo', age: '' } })).toBe(
      'USE `basketballplayer` INSERT (@`player`{`id`: "player999", `name`: "Neo"})'
    );
  });

  it('never inserts through a label that several node types share', () => {
    // `movie` declares Actor / Director / User with the same `Person` label; `(:Person{...})`
    // is rejected by the server with `NC009`.
    const actorMeta: EntityMeta = {
      graph: 'movie',
      type_name: 'Actor',
      labels: ['Person'],
      entityType: GraphEntityType.Node,
      properties: [
        { property_name: 'id', data_type: PropertyDataType.INT64, nullable: false, isKey: true },
        { property_name: 'name', data_type: PropertyDataType.STRING, nullable: true, isKey: false },
      ],
    };
    const gql = buildInsertNodeGql({ meta: actorMeta, values: { id: '900001', name: 'probe' } });
    expect(gql).toBe('USE `movie` INSERT (@`Actor`{`id`: 900001, `name`: "probe"})');
    expect(gql).not.toContain('(:`Person`');
  });

  it('ignores declared labels entirely', () => {
    expect(buildInsertNodeGql({ meta: { ...playerMeta, labels: ['player', 'AllStar'] }, values: { id: 'p1' } })).toBe(
      'USE `basketballplayer` INSERT (@`player`{`id`: "p1"})'
    );
    expect(buildInsertNodeGql({ meta: { ...playerMeta, labels: [] }, values: { id: 'p1' } })).toBe(
      'USE `basketballplayer` INSERT (@`player`{`id`: "p1"})'
    );
  });
});

describe('buildInsertEdgeGql', () => {
  it('binds both endpoints and inserts a directed edge', () => {
    expect(
      buildInsertEdgeGql({
        meta: serveMeta,
        src: { id: '11', typeName: 'player' },
        dst: { id: '22', typeName: 'team' },
        values: { start_year: '2020', end_year: '2024' },
        directed: true,
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11), (b@`team` where element_id(b) = 22) ' +
        'INSERT (a)-[@`serve`{`start_year`: 2020, `end_year`: 2024}]->(b)'
    );
  });

  it('uses the undirected template and allows an empty property map', () => {
    expect(
      buildInsertEdgeGql({
        meta: followMeta,
        src: { id: '11', typeName: 'player' },
        dst: { id: '22', typeName: 'player' },
        values: { degree: '' },
        directed: false,
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11), (b@`player` where element_id(b) = 22) ' +
        'INSERT (a)~[@`follow`{}]~(b)'
    );
  });
});

describe('buildSetPropertiesGql', () => {
  it('only touches properties present in the submitted diff', () => {
    expect(
      buildSetPropertiesGql({
        meta: playerMeta,
        ref: { entityType: GraphEntityType.Node, elementId: '11' },
        values: { name: 'Neo' },
      })
    ).toBe('USE `basketballplayer` MATCH (v@`player` where element_id(v) = 11) SET v.`name` = "Neo"');
  });

  it('leaves absent properties untouched even when other values are cleared', () => {
    expect(encodeAssignments(playerMeta, { age: '' }, { skipKeys: true, includeNull: true })).toEqual([
      ['age', 'NULL'],
    ]);
  });

  it('skips identity properties and writes cleared ones as NULL', () => {
    expect(
      buildSetPropertiesGql({
        meta: playerMeta,
        ref: { entityType: GraphEntityType.Node, elementId: '11' },
        values: { id: 'changed-but-ignored', name: 'Neo', age: '' },
      })
    ).toBe('USE `basketballplayer` MATCH (v@`player` where element_id(v) = 11) SET v.`name` = "Neo", v.`age` = NULL');
  });

  it('updates edges through the e alias and disambiguates by rank', () => {
    expect(
      buildSetPropertiesGql({
        meta: {
          ...serveMeta,
          properties: [
            ...serveMeta.properties,
            {
              property_name: 'season',
              data_type: PropertyDataType.STRING,
              nullable: true,
              default: 'NULL',
              isKey: false,
            },
          ],
        },
        ref: {
          entityType: GraphEntityType.Edge,
          srcId: '11',
          dstId: '22',
          srcTypeName: 'player',
          dstTypeName: 'team',
          rank: 123,
          directed: true,
        },
        values: { season: '2024' },
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11)-[e@`serve` where multiedge_id(e) = 123]->' +
        '(b@`team` where element_id(b) = 22) SET e.`season` = "2024"'
    );
  });

  it('omits the rank condition for rank 0', () => {
    expect(
      buildSetPropertiesGql({
        meta: followMeta,
        ref: {
          entityType: GraphEntityType.Edge,
          srcId: '11',
          dstId: '22',
          srcTypeName: 'player',
          dstTypeName: 'player',
          rank: 0,
          directed: true,
        },
        values: { degree: '3' },
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11)-[e@`follow`]->(b@`player` where element_id(b) = 22) ' +
        'SET e.`degree` = 3'
    );
  });
});

describe('buildDeleteGql', () => {
  it('detach deletes nodes', () => {
    expect(buildDeleteGql({ meta: playerMeta, ref: { entityType: GraphEntityType.Node, elementId: '11' } })).toBe(
      'USE `basketballplayer` MATCH (v@`player` where element_id(v) = 11) DETACH DELETE v'
    );
  });

  it('deletes edges without detaching nodes', () => {
    expect(
      buildDeleteGql({
        meta: followMeta,
        ref: {
          entityType: GraphEntityType.Edge,
          srcId: '11',
          dstId: '22',
          srcTypeName: 'player',
          dstTypeName: 'player',
          rank: 987654,
          directed: true,
        },
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11)-[e@`follow` where multiedge_id(e) = 987654]->' +
        '(b@`player` where element_id(b) = 22) DELETE e'
    );
  });
});

describe('read back builders', () => {
  it('reads a node back by its primary key', () => {
    expect(buildReadBackNodeGql({ meta: playerMeta, values: { id: 'player999' } })).toBe(
      'USE `basketballplayer` MATCH (v@`player` where v.`id` = "player999") RETURN v LIMIT 1'
    );
  });

  it('returns undefined when the type has no primary key property', () => {
    expect(buildReadBackNodeGql({ meta: { ...playerMeta, properties: [] }, values: {} })).toBeUndefined();
  });

  it('reads an edge back with its endpoints and multi-edge key conditions', () => {
    expect(
      buildReadBackEdgeGql({
        meta: serveMeta,
        src: { id: '11', typeName: 'player' },
        dst: { id: '22', typeName: 'team' },
        values: { start_year: '2020', end_year: '2024' },
        directed: true,
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11)-[e@`serve` where e.`start_year` = 2020 AND e.`end_year` = 2024]->' +
        '(b@`team` where element_id(b) = 22) RETURN a, e, b'
    );
  });

  it('omits key conditions for auto ranked edges', () => {
    expect(
      buildReadBackEdgeGql({
        meta: followMeta,
        src: { id: '11', typeName: 'player' },
        dst: { id: '22', typeName: 'player' },
        values: { degree: '1' },
        directed: true,
      })
    ).toBe(
      'USE `basketballplayer` MATCH (a@`player` where element_id(a) = 11)-[e@`follow`]->(b@`player` where element_id(b) = 22) RETURN a, e, b'
    );
  });
});

describe('getEligibleEdgeTypeOptions', () => {
  const edgeTypes = [serveType, followType];

  it('matches endpoints in the selected order', () => {
    const options = getEligibleEdgeTypeOptions({
      graph: GRAPH,
      edgeTypes,
      sourceTypeName: 'player',
      targetTypeName: 'team',
    });
    expect(options.map((option) => [option.meta.type_name, option.reversed, option.directed])).toEqual([
      ['serve', false, true],
    ]);
  });

  it('flags reversed selection for directed edges', () => {
    const options = getEligibleEdgeTypeOptions({
      graph: GRAPH,
      edgeTypes,
      sourceTypeName: 'team',
      targetTypeName: 'player',
    });
    expect(options.map((option) => [option.meta.type_name, option.reversed])).toEqual([['serve', true]]);
  });

  it('supports backward declared patterns', () => {
    const backwardType: DescGraphTypeResult = { ...serveType, type_pattern: '(team)<-[serve]-(player)' };
    const options = getEligibleEdgeTypeOptions({
      graph: GRAPH,
      edgeTypes: [backwardType],
      sourceTypeName: 'player',
      targetTypeName: 'team',
    });
    expect(options.map((option) => [option.meta.type_name, option.reversed])).toEqual([['serve', false]]);
  });

  it('matches undirected patterns in either order', () => {
    const undirectedType: DescGraphTypeResult = {
      ...followType,
      type_pattern: '(player)~[follow]~(player)',
    };
    const options = getEligibleEdgeTypeOptions({
      graph: GRAPH,
      edgeTypes: [undirectedType],
      sourceTypeName: 'player',
      targetTypeName: 'player',
    });
    expect(options.map((option) => [option.meta.type_name, option.directed])).toEqual([['follow', false]]);
  });

  it('excludes unrelated endpoint pairs', () => {
    const options = getEligibleEdgeTypeOptions({
      graph: GRAPH,
      edgeTypes,
      sourceTypeName: 'team',
      targetTypeName: 'team',
    });
    expect(options).toEqual([]);
    expect(teamType.type_name).toBe('team');
    expect(EdgeDirectionType.Forward).toBeDefined();
  });
});
