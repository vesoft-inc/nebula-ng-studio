import { GQL_KEYWORDS, GQL_PROCEDURES } from './keywords';
const highlightKeywords = [...GQL_KEYWORDS, ...GQL_KEYWORDS.map((key) => key.toLowerCase()), ...GQL_PROCEDURES];
import type { languages } from 'monaco-editor';

export const GQL_HIGHLIGHT_CONFIG: languages.IMonarchLanguage = {
  keywords: highlightKeywords,
  operators: [
    '=',
    '!=',
    '<>',
    '<',
    '<=',
    '>',
    '>=',
    '+',
    '-',
    '*',
    '/',
    '%',
    '+=',
    '|=',
    'AND',
    'OR',
    'NOT',
    'XOR',
    'IN',
    'CONTAINS',
    'STARTS',
    'ENDS',
    'WITH',
    'IS',
    'LIKE',
    'REGEXP',
    'BETWEEN',
  ],
  functions: [
    'count',
    'sum',
    'avg',
    'max',
    'min',
    'std',
    'collect',
    'size',
    'head',
    'last',
    'tail',
    'reverse',
    'keys',
    'labels',
    'nodes',
    'relationships',
    'startNode',
    'endNode',
    'type',
    'id',
    'properties',
    'exists',
    'coalesce',
    'toString',
    'toInteger',
    'toFloat',
    'toBool',
    'round',
    'abs',
    'length',
    'read_csv',
  ],
  constants: ['TRUE', 'FALSE', 'NULL', 'true', 'false', 'null'],
  analyticKeywords: [
    'VALUE',
    'NODE',
    'TABLE',
    'FILE',
    'ACTIVE_SET',
    'PROCEDURE',
    'RETURNS',
    'SUBMIT',
    'CALL',
    'THEN',
    'FOR',
    'PATH',
    'UPDATE',
    'REPLACE',
    'APPEND',
    'INTO',
    'WHILE',
    'IF',
    'ELSE',
    'ELSEIF',
    'BREAK',
    'CONTINUE',
    'FORMAT',
    'OPTIONS',
    'INCLUDE_HEADER',
    'TYPED',
    'DISTRIBUTED',
    'TEMPORARY',
    'PRIMARY',
    'KEY',
    'LABEL',
    'LOG_INFO',
    'RECORD',
    'TUPLE',
    'CAST',
  ],
  dataTypes: ['INT', 'INT64', 'DOUBLE', 'STRING', 'BOOL', 'LIST', 'RECORD', 'CSV', 'PARQUET'],
  aggregators: ['SumAgg', 'MinAgg', 'MaxAgg', 'AvgAgg', 'OrAgg', 'AndAgg', 'ListAgg', 'TopKAgg', 'MapAgg'],

  tokenizer: {
    root: [
      [/('''|""")/, 'string.quoted.triple-quote.gql'],

      // Single quoted strings
      [/'([^'\\]|\\.)*'/, 'string.quoted.single.gql'],

      // Double quoted strings
      [/"([^"\\]|\\.)*"/, 'string.quoted.double.gql'],

      // Backtick quoted identifiers
      [/`([^`\\]|\\.)*`/, 'string.quoted.other.gql'],

      // Boolean and null constants
      [/\b(TRUE|FALSE|NULL|true|false|null)\b/, 'constant.language.boolean.gql'],

      // Numeric literals (integers and floats)
      [/\b\d+(\.\d+)?([eE][+-]?\d+)?\b/, 'constant.numeric.gql'],

      // Hexadecimal numbers
      [/\b0[xX][0-9a-fA-F]+\b/, 'constant.numeric.gql'],

      // Path expressions with direction arrows
      [/(-\[[\w\s:]*\]->|<-\[[\w\s:]*\]-|-\[[\w\s:]*\]-)/, 'meta.path.gql'],

      // Node aggregator references (node.@variable)
      [/\.@[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.other.aggregator.gql'],

      // Global aggregator references (@variable)
      [/@[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.other.global.gql'],

      // Property access patterns
      [/\.[a-zA-Z_][a-zA-Z0-9_]*/, 'meta.path.gql'],

      // Node patterns with labels
      [/\([a-zA-Z_][a-zA-Z0-9_]*:[a-zA-Z_][a-zA-Z0-9_]*\)/, 'entity.name.type.gql'],

      // Simple node patterns
      [/\([a-zA-Z_][a-zA-Z0-9_]*\)/, 'entity.name.type.gql'],

      // Edge type patterns in brackets
      [/\[:[a-zA-Z_][a-zA-Z0-9_]*\]/, 'entity.name.type.gql'],
      [/\[[a-zA-Z_][a-zA-Z0-9_]*\]/, 'entity.name.type.gql'],

      // File URI patterns
      [/(file|s3|gcs):\/\/[^\s"'`]+/, 'string.other.uri.gql'],

      // Temporary graph references (#graph_name)
      [/#[a-zA-Z_][a-zA-Z0-9_]*/, 'entity.name.graph.gql'],

      // Variables (starting with $)
      [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.other.gql'],

      // Comments (must come before operators to avoid conflict)
      [/\/\/.*$/, 'comment.line.gql'],
      [/\/\*/, 'comment.block.gql', '@comment'],

      // Comparison and logical operators
      [/(<>|<=|>=|!=|=|<|>)/, 'keyword.operator.gql'],
      [/(\+|\-|\*|\/|%)/, 'keyword.operator.gql'],

      // Aggregator type patterns (SumAgg<TYPE>)
      [/[a-zA-Z_][a-zA-Z0-9_]*Agg\s*<[^>]+>/, 'support.class.aggregator.gql'],

      // Function calls (must come before general identifiers)
      [
        /[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/,
        {
          cases: {
            '@functions': 'support.function.gql',
            '@default': 'entity.name.function.gql',
          },
        },
      ],

      // Keywords and identifiers
      [
        /[a-zA-Z_][a-zA-Z0-9_]*/,
        {
          cases: {
            '@keywords': 'keyword.control.gql',
            '@operators': 'keyword.operator.gql',
            '@constants': 'constant.language.boolean.gql',
            '@analyticKeywords': 'keyword.control.analytic.gql',
            '@dataTypes': 'support.type.gql',
            '@aggregators': 'support.class.gql',
            '@default': 'entity.name.predicate.gql',
          },
        },
      ],

      // Punctuation
      [/[{}()\[\]]/, 'punctuation.definition.gql'],
      [/[;,.]/, 'punctuation.separator.gql'],

      // Whitespace
      [/\s+/, 'white'],
    ],

    comment: [
      [/[^\/*]+/, 'comment.block.gql'],
      [/\/\*/, 'comment.block.gql', '@push'],
      [/\*\//, 'comment.block.gql', '@pop'],
      [/[\/*]/, 'comment.block.gql'],
    ],
  },
};
