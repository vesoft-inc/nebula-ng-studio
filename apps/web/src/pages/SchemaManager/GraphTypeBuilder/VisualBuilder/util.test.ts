import { describe, expect, it } from 'vitest';
import { IEdgeTypeItem, INodeTypeItem, IProperty } from '@studio/interfaces';
import { PropertyDataType } from '@vesoft-inc/utils';
import { generateAlterGraphTypeGQL, generateCreateGraphTypeGQL } from './util';

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
