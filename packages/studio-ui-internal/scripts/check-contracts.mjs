import ts from 'typescript';
import { resolve, relative } from 'node:path';
import { readFileSync } from 'node:fs';

/** Check the real public contract entry and its complete declaration graph. */
export function checkContracts(root, dist) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const entry = pkg.exports['./contracts'];
  const program = ts.createProgram({
    rootNames: [resolve(root, dist ? entry.types : entry.source)],
    options: {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      customConditions: dist ? [] : ['source'],
      lib: ['lib.es2021.d.ts'],
      types: [],
      esModuleInterop: true,
      skipLibCheck: false,
    },
  });
  const errors = ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  for (const file of program.getSourceFiles()) {
    if (/[/\\](mobx(?:-react(?:-lite)?)?|react(?:-dom)?|force-graph)[/\\]/.test(file.fileName)) {
      errors.push(`Pure contracts reach a runtime dependency: ${relative(root, file.fileName)}`);
    }
  }
  return errors.map((error) => `Contracts: ${error}`);
}
