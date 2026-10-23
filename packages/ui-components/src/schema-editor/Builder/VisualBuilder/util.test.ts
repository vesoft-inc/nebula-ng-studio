import { describe, expect, it } from 'vitest';
import { cloneDeep } from 'lodash';
import { IEdgeTypeItem, INodeTypeItem, IProperty } from '../../../schema/types';
import { MultiEdgeKeyMode, PropertyDataType } from '@vesoft-inc/utils';
import { getEdgeTypeFormValues, getNodeTypeFormValues, getPropertyModel } from '../formValues';
import { generateAlterGraphTypeGQL, generateCreateGraphTypeGQL, parsePropertyDataType } from './util';

const createGraphType = (nodeTypeList: INodeTypeItem[], edgeTypeList: IEdgeTypeItem[] = []) =>
  generateCreateGraphTypeGQL({ graphTypeName: 'people', nodeTypeList, edgeTypeList });

describe('graph type DDL generation', () => {
  it('omits the primary key clause when no property is selected as a key', () => {
    const person = new INodeTypeItem({
      name: 'person',
      labels: ['Person'],
      properties: [
        new IProperty({ name: 'name', type: PropertyDataType.STRING, isPrimaryKey: false }),
        new IProperty({ name: 'age', type: PropertyDataType.INT64 }),
      ],
    });

    expect(createGraphType([person])).toBe(
      'CREATE GRAPH TYPE `people` AS {\n  NODE `person` (LABEL `Person` {`name` STRING,`age` INT64})\n}'
    );
  });

  it('keeps the selected primary key and property modifiers', () => {
    const person = new INodeTypeItem({
      name: 'person',
      labels: ['Person'],
      properties: [
        new IProperty({ name: 'id', type: PropertyDataType.INT64, nullable: false, isPrimaryKey: true }),
        new IProperty({ name: 'name', type: PropertyDataType.STRING, default: 'Anonymous' }),
      ],
    });

    expect(createGraphType([person])).toBe(
      'CREATE GRAPH TYPE `people` AS {\n' +
        "  NODE `person` (LABEL `Person` {`id` INT64 NOT NULL,`name` STRING DEFAULT 'Anonymous', PRIMARY KEY(`id`)})\n}"
    );
  });

  it('includes only selected properties in a composite primary key', () => {
    const person = new INodeTypeItem({
      name: 'person',
      properties: [
        new IProperty({ name: 'tenant id', type: PropertyDataType.INT64, isPrimaryKey: true }),
        new IProperty({ name: 'name', type: PropertyDataType.STRING }),
        new IProperty({ name: 'user id', type: PropertyDataType.INT64, isPrimaryKey: true }),
      ],
    });

    expect(createGraphType([person])).toContain('PRIMARY KEY(`tenant id`,`user id`)');
  });

  it('does not add an empty property block or key to a propertyless node', () => {
    const person = new INodeTypeItem({ name: 'person', labels: ['Person'] });

    expect(createGraphType([person])).toBe('CREATE GRAPH TYPE `people` AS {\n  NODE `person` (LABEL `Person` )\n}');
  });

  it('preserves multiple node and edge labels', () => {
    const person = new INodeTypeItem({ name: 'person', labels: ['Person', 'Employee'] });
    const knows = new IEdgeTypeItem({
      name: 'knows',
      labels: ['Knows', 'Contact'],
      srcNode: person,
      dstNode: person,
    });

    expect(createGraphType([person], [knows])).toBe(
      'CREATE GRAPH TYPE `people` AS {\n' +
        '  NODE `person` (LABELS `Person`&`Employee` ),\n' +
        '  EDGE `knows` (`person`)-[LABELS `Knows`&`Contact` {}]->(`person`)\n}'
    );
  });

  it('omits the primary key clause when adding a node to an existing graph type', () => {
    const person = new INodeTypeItem({
      name: 'person',
      labels: ['Person'],
      properties: [new IProperty({ name: 'name', type: PropertyDataType.STRING })],
    });
    const original = { graphTypeName: 'people', nodeTypeList: [], edgeTypeList: [] };

    expect(generateAlterGraphTypeGQL(original, { ...original, nodeTypeList: [person] })).toBe(
      'ALTER GRAPH TYPE `people` {\n  ADD NODE `person` (LABEL `Person` {`name` STRING})\n}'
    );
  });
});

type PropertyOperation = 'create' | 'add-type' | 'add-property' | 'modify-property';

const generatePropertyChange = (entity: 'node' | 'edge', operation: PropertyOperation, property: IProperty): string => {
  const node = new INodeTypeItem({
    name: 'person',
    labels: ['Person', 'Employee'],
    properties: [new IProperty({ name: 'id', type: PropertyDataType.INT64, isPrimaryKey: true })],
  });
  const edge = new IEdgeTypeItem({ name: 'knows', srcNode: node, dstNode: node, labels: ['Knows', 'Contact'] });
  const original = { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [edge] };
  if (operation === 'modify-property') {
    const previous = new IProperty({
      id: property.id,
      name: property.name,
      type: property.type,
      nullable: property.nullable,
      default: property.default,
      decimalPrecision: 1,
      decimalScale: 0,
    });
    (entity === 'node' ? node : edge).properties.push(previous);
  }
  // Exercise the same detached form values and identity-preserving models as the editors.
  const currentNode = cloneDeep(node);
  currentNode.updateValues(new INodeTypeItem(getNodeTypeFormValues(node)));
  const edgeValues = getEdgeTypeFormValues(edge);
  const currentEdge = cloneDeep(edge);
  currentEdge.updateValues(
    new IEdgeTypeItem({
      ...edgeValues,
      properties: edgeValues.properties.map((item) => new IProperty(item)),
    })
  );
  const target = entity === 'node' ? currentNode : currentEdge;
  target.properties = target.properties.filter((item) => item.id !== property.id).concat(property);
  const current = { ...original, nodeTypeList: [currentNode], edgeTypeList: [currentEdge] };
  if (operation === 'create') return generateCreateGraphTypeGQL(current);
  if (operation === 'add-type') {
    if (entity === 'node') original.nodeTypeList = [];
    original.edgeTypeList = [];
  }
  return generateAlterGraphTypeGQL(original, current);
};

// RHF number inputs also produce strings, including an empty string after clearing.
const decimalProperty = (precision?: number | string, scale?: number | string) =>
  new IProperty({
    name: 'amount',
    type: PropertyDataType.DECIMAL,
    decimalPrecision: precision as number | undefined,
    decimalScale: scale as number | undefined,
    nullable: false,
    default: '0M',
  });

describe.each(['node', 'edge'] as const)('%s property DDL parity', (entity) => {
  describe.each(['create', 'add-type', 'add-property', 'modify-property'] as const)('%s', (operation) => {
    it.each([
      { precision: 12, scale: 3, type: 'DECIMAL(12, 3)' },
      { precision: 12, scale: 0, type: 'DECIMAL(12, 0)' },
      { precision: 3, scale: 3, type: 'DECIMAL(3, 3)' },
      { precision: 256, scale: 128, type: 'DECIMAL(256, 128)' },
      { precision: undefined, scale: undefined, type: 'DECIMAL' },
      { precision: 12, scale: undefined, type: 'DECIMAL(12, 0)' },
      { precision: undefined, scale: 3, type: 'DECIMAL(10, 3)' },
      { precision: undefined, scale: 0, type: 'DECIMAL(10, 0)' },
      { precision: '12', scale: '3', type: 'DECIMAL(12, 3)' },
      { precision: '12', scale: '0', type: 'DECIMAL(12, 0)' },
      { precision: '', scale: '', type: 'DECIMAL' },
      { precision: 12, scale: '', type: 'DECIMAL(12, 0)' },
      { precision: '', scale: 3, type: 'DECIMAL(10, 3)' },
    ])('preserves $type from precision=$precision scale=$scale', ({ precision, scale, type }) => {
      const ddl = generatePropertyChange(entity, operation, decimalProperty(precision, scale));

      expect(ddl).toContain(`\`amount\` ${type} NOT NULL DEFAULT 0M`);
      expect(ddl.match(/`amount`/g)).toHaveLength(1);
      if (operation === 'create' || operation === 'add-type') {
        expect(ddl).toContain(entity === 'node' ? 'LABELS `Person`&`Employee`' : 'LABELS `Knows`&`Contact`');
        if (entity === 'node') expect(ddl).toContain('PRIMARY KEY(`id`)');
      } else {
        expect(ddl).toContain(operation === 'add-property' ? 'ADD PROPERTIES' : 'MODIFY PROPERTIES');
      }
    });
  });
});

describe('shared property serialization regressions', () => {
  it.each([undefined, '', '10', 10])(
    'does not emit no-op DECIMAL modifications or empty ALTER clauses for precision=%s',
    (precision) => {
      const node = new INodeTypeItem({ name: 'person', properties: [decimalProperty(precision)] });
      const edge = new IEdgeTypeItem({
        name: 'knows',
        srcNode: node,
        dstNode: node,
        properties: [decimalProperty(precision)],
      });
      const original = { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [edge] };
      const current = cloneDeep(original);
      current.nodeTypeList[0].properties = current.nodeTypeList[0].properties.map(getPropertyModel);
      current.edgeTypeList[0].properties = current.edgeTypeList[0].properties.map(getPropertyModel);
      expect(generateAlterGraphTypeGQL(original, current)).toBe('');
      current.nodeTypeList[0].properties.push(new IProperty({ name: 'extra' }));
      expect(generateAlterGraphTypeGQL(original, current)).toBe(
        'ALTER GRAPH TYPE `people` {\n  ALTER NODE `person` ADD PROPERTIES {`extra` STRING}\n}'
      );
    }
  );

  it.each([
    { property: { type: PropertyDataType.STRING, default: 'Anonymous' }, ddl: "STRING DEFAULT 'Anonymous'" },
    { property: { type: PropertyDataType.INT64, default: '0', nullable: false }, ddl: 'INT64 NOT NULL DEFAULT 0' },
    { property: { type: PropertyDataType.BOOL, default: 'FALSE' }, ddl: 'BOOL DEFAULT FALSE' },
    { property: { type: PropertyDataType.LIST, itemType: PropertyDataType.INT32 }, ddl: 'LIST<INT32>' },
    { property: { type: PropertyDataType.LIST }, ddl: 'LIST<STRING>' },
    { property: { type: PropertyDataType.SET, itemType: PropertyDataType.INT32 }, ddl: 'SET<INT32>' },
    { property: { type: PropertyDataType.SET }, ddl: 'SET<STRING>' },
    {
      property: { type: PropertyDataType.MAP, keyType: PropertyDataType.INT32, valueType: PropertyDataType.BOOL },
      ddl: 'MAP<INT32, BOOL>',
    },
    { property: { type: PropertyDataType.MAP }, ddl: 'MAP<STRING, STRING>' },
    { property: { type: PropertyDataType.VECTOR, dimensionCount: 7 }, ddl: 'VECTOR<7, FLOAT>' },
    { property: { type: PropertyDataType.VECTOR }, ddl: 'VECTOR<1, FLOAT>' },
    { property: { type: PropertyDataType.GEOGRAPHY_POINT }, ddl: 'GEOGRAPHY(Point)' },
  ])('keeps node and edge output identical for $ddl', ({ property, ddl }) => {
    const expected = `\`value\` ${ddl}`;
    for (const entity of ['node', 'edge'] as const) {
      for (const operation of ['create', 'add-type', 'add-property'] as const) {
        expect(generatePropertyChange(entity, operation, new IProperty({ name: 'value', ...property }))).toContain(
          expected
        );
      }
    }
  });

  it.each(['node', 'edge'] as const)('retains explicit DECIMAL metadata when reopening a %s', (entity) => {
    const property = new IProperty({ name: 'amount', ...parsePropertyDataType('DECIMAL(12, 0)') });

    expect(generatePropertyChange(entity, 'add-type', property)).toContain('`amount` DECIMAL(12, 0)');
  });

  it.each([undefined, true, false])('preserves DECIMAL nullable=%s without inventing a default', (nullable) => {
    for (const entity of ['node', 'edge'] as const) {
      const property = new IProperty({ ...decimalProperty(12, 0), nullable, default: undefined });
      const ddl = generatePropertyChange(entity, 'create', property);

      expect(ddl).toContain(`\`amount\` DECIMAL(12, 0)${nullable === false ? ' NOT NULL' : ''}`);
      expect(ddl).not.toContain('DEFAULT');
      if (nullable !== false) expect(ddl).not.toContain('NOT NULL');
    }
  });

  it('does not emit ALTER for untouched DECIMAL properties after a form round trip', () => {
    const node = new INodeTypeItem({ name: 'person', properties: [decimalProperty(12, 0)] });
    const edge = new IEdgeTypeItem({
      name: 'knows',
      srcNode: node,
      dstNode: node,
      properties: [decimalProperty(12, 3)],
    });
    const original = { graphTypeName: 'people', nodeTypeList: [node], edgeTypeList: [edge] };
    const currentNode = cloneDeep(node);
    currentNode.updateValues(new INodeTypeItem(getNodeTypeFormValues(node)));
    const edgeValues = getEdgeTypeFormValues(edge);
    const currentEdge = cloneDeep(edge);
    currentEdge.updateValues(
      new IEdgeTypeItem({ ...edgeValues, properties: edgeValues.properties.map((item) => new IProperty(item)) })
    );

    expect(
      generateAlterGraphTypeGQL(original, {
        ...original,
        nodeTypeList: [currentNode],
        edgeTypeList: [currentEdge],
      })
    ).toBe('');
  });

  it('does not leak obsolete DECIMAL parameters after changing a property type', () => {
    for (const entity of ['node', 'edge'] as const) {
      const property = decimalProperty(12, 3);
      property.type = PropertyDataType.INT64;
      property.default = '0';
      const ddl = generatePropertyChange(entity, 'create', property);

      expect(ddl).toContain('`amount` INT64 NOT NULL DEFAULT 0');
      expect(ddl).not.toContain('DECIMAL');
    }
  });

  it('preserves a new DECIMAL primary key without adding a default or nullable constraint', () => {
    const node = new INodeTypeItem({
      name: 'payment',
      properties: [
        new IProperty({
          name: 'amount',
          type: PropertyDataType.DECIMAL,
          decimalPrecision: 12,
          decimalScale: 0,
          isPrimaryKey: true,
        }),
      ],
    });

    expect(createGraphType([node])).toContain('{`amount` DECIMAL(12, 0), PRIMARY KEY(`amount`)}');
  });

  it('preserves a new DECIMAL multiedge key', () => {
    const node = new INodeTypeItem({ name: 'person', properties: [new IProperty({ name: 'id', isPrimaryKey: true })] });
    const edge = new IEdgeTypeItem({
      name: 'knows',
      srcNode: node,
      dstNode: node,
      multiEdgeKeyMode: MultiEdgeKeyMode.Customize,
      properties: [
        new IProperty({
          name: 'amount',
          type: PropertyDataType.DECIMAL,
          decimalPrecision: 12,
          decimalScale: 0,
          multiEdgeKey: true,
        }),
      ],
    });

    expect(createGraphType([node], [edge])).toContain('{`amount` DECIMAL(12, 0),MULTIEDGE KEY(`amount`)}');
  });
});
