import { describe, expect, it } from 'vitest';
import { PropertyDataType } from '@vesoft-inc/studio-core/contracts';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem, IProperty } from '../../schema/types';
import {
  getNewNodeTypes,
  getNodePrimaryKeyError,
  getNodePrimaryKeyPropertyIssues,
  validateGraphTypePrimaryKeys,
  validateGraphTypeDecimals,
} from './validation';

const node = (name: string, properties: Partial<IProperty>[] = []) =>
  new INodeTypeItem({ name, properties: properties.map((property) => new IProperty(property)) });
const key = { name: 'id', type: PropertyDataType.STRING, isPrimaryKey: true };

describe('DECIMAL schema validation', () => {
  it.each([0, 257, 1.2, NaN, Infinity])(
    'checks ordinary node and edge properties with precision %s',
    (decimalPrecision) => {
      const property = new IProperty({ name: 'amount', type: PropertyDataType.DECIMAL, decimalPrecision });
      const person = node('Person', [key, property]);
      const edge = new IEdgeTypeItem({ name: 'Pays', properties: [property] });
      expect(validateGraphTypeDecimals([person], [edge])).toHaveLength(2);
    }
  );
  it('rejects malformed sketch type signatures instead of defaulting them', () => {
    const person = node('Person', [key, { name: 'amount', type: 'DECIMAL(bad)' as PropertyDataType }]);
    expect(validateGraphTypeDecimals([person], [])).toHaveLength(1);
  });
  it('treats omitted DECIMAL key parameters and explicit defaults as equivalent', () => {
    const original = node('Person', [{ ...key, type: PropertyDataType.DECIMAL }]);
    const current = new INodeTypeItem(original);
    current.properties[0].decimalPrecision = 10;
    current.properties[0].decimalScale = 0;
    expect(getNodePrimaryKeyError(current, original)).toBeNull();
  });
});

describe('node primary key validation', () => {
  it.each([
    { property: { ...key, name: ' ' }, reason: 'nodePrimaryKeyNameRequired' },
    { property: { ...key, nullable: true }, reason: 'nodePrimaryKeyNullable' },
    { property: { ...key, default: '0' }, reason: 'nodePrimaryKeyDefault' },
    ...[
      PropertyDataType.LIST,
      PropertyDataType.SET,
      PropertyDataType.MAP,
      PropertyDataType.VECTOR,
      PropertyDataType.GEOGRAPHY,
      PropertyDataType.GEOGRAPHY_ANY,
      PropertyDataType.GEOGRAPHY_POINT,
      PropertyDataType.GEOGRAPHY_LINESTRING,
      PropertyDataType.GEOGRAPHY_POLYGON,
    ].map((type) => ({ property: { ...key, type }, reason: 'nodePrimaryKeyTypeUnsupported' })),
  ])('returns a specific reason for $property.type: $reason', ({ property, reason }) => {
    const person = node('Person', [property]);
    expect(getNodePrimaryKeyPropertyIssues(person)).toEqual([{ property: person.properties[0], index: 0, reason }]);
  });

  it('reports all constraints for all selected members without including regular properties', () => {
    const person = node('Person', [
      { name: '', nullable: true, default: '0', type: PropertyDataType.LIST },
      key,
      { ...key, name: '', nullable: true, default: '0', type: PropertyDataType.LIST },
      { ...key, name: 'tenant', nullable: true },
    ]);
    expect(getNodePrimaryKeyPropertyIssues(person).map(({ index, reason }) => [index, reason])).toEqual([
      [2, 'nodePrimaryKeyNameRequired'],
      [2, 'nodePrimaryKeyNullable'],
      [2, 'nodePrimaryKeyDefault'],
      [2, 'nodePrimaryKeyTypeUnsupported'],
      [3, 'nodePrimaryKeyNullable'],
    ]);
  });

  it.each([{ properties: [] }, { properties: [{ name: 'name' }] }])(
    'requires a key even when the node has properties: %j',
    ({ properties }) => {
      expect(getNodePrimaryKeyError(node('Person', properties))).toBe('nodePrimaryKeyRequired');
    }
  );

  it('accepts a single key without an explicit NOT NULL modifier', () => {
    expect(getNodePrimaryKeyError(node('Person', [key]))).toBeNull();
  });

  it('accepts a composite key as one primary key definition', () => {
    expect(getNodePrimaryKeyError(node('Person', [key, { ...key, name: 'tenant' }]))).toBeNull();
  });

  it.each([
    { ...key, name: '' },
    { ...key, name: ' ' },
    { ...key, nullable: true },
    { ...key, default: '0' },
    { ...key, type: PropertyDataType.LIST },
    { ...key, type: PropertyDataType.SET },
    { ...key, type: PropertyDataType.MAP },
    { ...key, type: PropertyDataType.VECTOR },
    { ...key, type: PropertyDataType.GEOGRAPHY_POINT },
  ])('rejects an invalid key property: %j', (property) => {
    expect(getNodePrimaryKeyError(node('Person', [property]))).toBe('nodePrimaryKeyInvalid');
  });

  it('validates every selected property, not just the first composite key member', () => {
    expect(getNodePrimaryKeyError(node('Person', [key, { ...key, name: 'tenant', nullable: true }]))).toBe(
      'nodePrimaryKeyInvalid'
    );
  });
});

describe('submission validation scope', () => {
  const person = node('Person');
  const team = node('Team', [key]);
  const original = { id: person.id, name: person.name };

  it.each([GraphTypeBuildMode.Create, GraphTypeBuildMode.Sketch])('validates all nodes in %s', (mode) => {
    expect(validateGraphTypePrimaryKeys({ mode, nodeTypeList: [person, team] })).toEqual([
      { node: person, error: 'nodePrimaryKeyRequired' },
    ]);
  });

  it('matches ADD NODE identity by either id or name, exactly like the DDL generator', () => {
    const rebuiltPerson = node('Person');
    const renamedPerson = new INodeTypeItem({ id: person.id, name: 'Human' });
    expect(getNewNodeTypes([original], [rebuiltPerson, renamedPerson, team])).toEqual([team]);
  });

  it('validates existing and newly added nodes when editing', () => {
    const added = node('Project');
    expect(
      validateGraphTypePrimaryKeys({
        mode: GraphTypeBuildMode.Edit,
        nodeTypeList: [person, added],
        originalNodeTypeList: [person],
        graphTypeName: 'people',
        originalGraphTypeName: 'people',
      })
    ).toEqual([
      { node: person, error: 'nodePrimaryKeyRequired' },
      { node: added, error: 'nodePrimaryKeyRequired' },
    ]);
  });

  it.each(['uncheck', 'delete', 'replace', 'add', 'type', 'nullable', 'default'])(
    'rejects an existing key mutation: %s',
    (change) => {
      const original = node('Person', [key, { name: 'email' }]);
      const current = new INodeTypeItem(original);
      switch (change) {
        case 'uncheck':
          current.properties[0].isPrimaryKey = false;
          break;
        case 'delete':
          current.properties.shift();
          break;
        case 'replace':
          current.properties[0].isPrimaryKey = false;
          current.properties[1].isPrimaryKey = true;
          break;
        case 'add':
          current.properties[1].isPrimaryKey = true;
          break;
        case 'type':
          current.properties[0].type = PropertyDataType.INT64;
          break;
        case 'nullable':
          current.properties[0].nullable = true;
          break;
        case 'default':
          current.properties[0].default = '0';
          break;
      }
      expect(
        validateGraphTypePrimaryKeys({
          mode: GraphTypeBuildMode.Edit,
          originalNodeTypeList: [original],
          nodeTypeList: [current],
        })
      ).toEqual([{ node: current, error: 'nodePrimaryKeyImmutable' }]);
    }
  );

  it('permits property additions, a key rename, and key reordering without redefining the key', () => {
    const original = node('Person', [key, { ...key, name: 'tenant' }]);
    const current = new INodeTypeItem(original);
    current.properties[0].name = 'person_id';
    current.properties.reverse();
    current.properties.push(new IProperty({ name: 'email' }));
    expect(getNodePrimaryKeyError(current, original)).toBeNull();
  });

  it('does not block a pure graph-type rename on unrelated draft nodes', () => {
    expect(
      validateGraphTypePrimaryKeys({
        mode: GraphTypeBuildMode.Edit,
        nodeTypeList: [person],
        graphTypeName: 'renamed',
        originalGraphTypeName: 'people',
      })
    ).toEqual([]);
  });

  it('does not block a deletion or readonly mode', () => {
    expect(
      validateGraphTypePrimaryKeys({
        mode: GraphTypeBuildMode.Edit,
        originalNodeTypeList: [person],
        nodeTypeList: [],
      })
    ).toEqual([]);
    expect(validateGraphTypePrimaryKeys({ mode: GraphTypeBuildMode.Readonly, nodeTypeList: [person] })).toEqual([]);
  });
});
