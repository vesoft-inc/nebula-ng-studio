import type monaco from 'monaco-editor';

export const gqlTheme = {
  dark: {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Keywords (MATCH, WHERE, RETURN, etc.)
      { token: 'keyword.control.gql', foreground: '#69AEFF' },
      // Analytic DSL keywords (VALUE, NODE, PROCEDURE, etc.)
      { token: 'keyword.control.analytic.gql', foreground: '#69AEFF' },
      // Path expressions (-[knows]->, .property)
      { token: 'meta.path.gql', foreground: '#BCABFF' },
      // Property names and predicates
      { token: 'entity.name.predicate.gql', foreground: '#BCABFF' },
      // Functions
      { token: 'entity.name.function.gql', foreground: '#BCABFF' },
      // Operators (=, !=, +, -, etc.)
      { token: 'keyword.operator.gql', foreground: '#7FDBCA' },
      // String literals
      { token: 'string.quoted.single.gql', foreground: '#FFFAC7' },
      { token: 'string.quoted.double.gql', foreground: '#FFFAC7' },
      { token: 'string.quoted.other.gql', foreground: '#FFFAC7' },
      { token: 'string.quoted.triple-quote.gql', foreground: '#FFFAC7' },
      // File URIs (s3://, file://, gcs://)
      { token: 'string.other.uri.gql', foreground: '#7FDBCA' },
      // Numbers
      { token: 'constant.numeric.gql', foreground: '#F78C6C' },
      // Boolean and null constants
      { token: 'constant.language.boolean.gql', foreground: '#FFCB8B' },
      // Variables ($param)
      { token: 'variable.other.gql', foreground: '#FFCB8B' },
      // Node aggregator references (node.@variable)
      { token: 'variable.other.aggregator.gql', foreground: '#FFCB8B' },
      // Global aggregator references (@variable)
      { token: 'variable.other.global.gql', foreground: '#FFCB8B' },
      // Node and edge types
      { token: 'entity.name.type.gql', foreground: '#ADDB67' },
      // Temporary graph references (#graph_name)
      { token: 'entity.name.graph.gql', foreground: '#ADDB67' },
      // Comments
      { token: 'comment.line.gql', foreground: '#637777', fontStyle: 'italic' },
      { token: 'comment.block.gql', foreground: '#637777', fontStyle: 'italic' },
      // Punctuation
      { token: 'punctuation.definition.gql', foreground: '#5F7E97' },
      { token: 'punctuation.separator.gql', foreground: '#5F7E97' },
    ],
    colors: {},
  } satisfies monaco.editor.IStandaloneThemeData,
  light: {
    base: 'vs',
    inherit: true,
    rules: [
      // Keywords (MATCH, WHERE, RETURN, etc.)
      { token: 'keyword.control.gql', foreground: '#005ECC' },
      // Analytic DSL keywords (VALUE, NODE, PROCEDURE, etc.)
      { token: 'keyword.control.analytic.gql', foreground: '#005ECC' },
      // Path expressions (-[knows]->, .property)
      { token: 'meta.path.gql', foreground: '#7256E4' },
      // Property names and predicates
      { token: 'entity.name.predicate.gql', foreground: '#7256E4' },
      // Functions
      { token: 'entity.name.function.gql', foreground: '#7256E4' },
      // Operators (=, !=, +, -, etc.)
      { token: 'keyword.operator.gql', foreground: '#03A08B' },
      // String literals
      { token: 'string.quoted.single.gql', foreground: '#9F951D' },
      { token: 'string.quoted.double.gql', foreground: '#9F951D' },
      { token: 'string.quoted.other.gql', foreground: '#9F951D' },
      { token: 'string.quoted.triple-quote.gql', foreground: '#9F951D' },
      // File URIs (s3://, file://, gcs://)
      { token: 'string.other.uri.gql', foreground: '#03A08B' },
      // Numbers
      { token: 'constant.numeric.gql', foreground: '#FF6F00' },
      // Boolean and null constants
      { token: 'constant.language.boolean.gql', foreground: '#BC5454' },
      // Variables ($param)
      { token: 'variable.other.gql', foreground: '#BC5454' },
      // Node aggregator references (node.@variable)
      { token: 'variable.other.aggregator.gql', foreground: '#BC5454' },
      // Global aggregator references (@variable)
      { token: 'variable.other.global.gql', foreground: '#BC5454' },
      // Node and edge types
      { token: 'entity.name.type.gql', foreground: '#6DA505' },
      // Temporary graph references (#graph_name)
      { token: 'entity.name.graph.gql', foreground: '#6DA505' },
      // Comments
      { token: 'comment.line.gql', foreground: '#989FB1', fontStyle: 'italic' },
      { token: 'comment.block.gql', foreground: '#989FB1', fontStyle: 'italic' },
      // Punctuation
      { token: 'punctuation.definition.gql', foreground: '#403F53' },
      { token: 'punctuation.separator.gql', foreground: '#403F53' },
    ],
    colors: {},
  } satisfies monaco.editor.IStandaloneThemeData,
};
