import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = resolve(root, 'src');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const dependencies = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies ?? {})]);
const errors = [];
async function files(directory) {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((item) =>
        item.isDirectory() ? files(resolve(directory, item.name)) : [resolve(directory, item.name)]
      )
    )
  ).flat();
}
for (const file of await files(sourceRoot)) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const report = (node, message) => {
    errors.push(
      `${relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${message}`
    );
  };
  const visit = (node) => {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')
    )
      specifier = node.arguments[0];
    if (specifier && ts.isStringLiteral(specifier)) {
      const name = specifier.text;
      if (/^@vesoft-inc\/studio-ui(?:-internal)?(?:\/|$)/.test(name))
        report(node, 'UI packages must not be dependencies of core.');
      if (name.startsWith('.')) {
        if (relative(sourceRoot, resolve(dirname(file), name)).startsWith('..'))
          report(node, 'Imports must stay within core sources.');
      } else {
        const dependency = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
        if (!dependencies.has(dependency)) report(node, `Undeclared runtime dependency: ${name}`);
        if (
          ['axios', 'mobx', 'react', 'react-dom', 'react-router', 'react-router-dom', '@remix-run/router'].includes(
            dependency
          )
        )
          report(node, 'Transport clients, application state and routing belong to the host.');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const expectedEntries = ['.', './contracts', './graph', './request', './browser', './crypto'];
if (JSON.stringify(Object.keys(pkg.exports).sort()) !== JSON.stringify(expectedEntries.sort()))
  errors.push('Unexpected public entries.');
for (const [name, entry] of Object.entries(pkg.exports)) {
  for (const target of process.argv.includes('--dist') ? Object.values(entry) : [entry.source]) {
    try {
      await access(resolve(root, target));
    } catch {
      errors.push(`Missing export ${name}: ${target}`);
    }
  }
}
// Compile the real public entries and follow their complete type dependencies.
for (const dist of process.argv.includes('--dist') ? [false, true] : [false]) {
  const field = dist ? 'types' : 'source';
  const portableEntries = ['.', './contracts', './graph'];
  for (const nodeNext of [false, true]) {
    const program = ts.createProgram({
      rootNames: portableEntries.map((name) => resolve(root, pkg.exports[name][field])),
      options: {
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2021,
        module: nodeNext ? ts.ModuleKind.NodeNext : ts.ModuleKind.ESNext,
        moduleResolution: nodeNext ? ts.ModuleResolutionKind.NodeNext : ts.ModuleResolutionKind.Bundler,
        customConditions: dist ? [] : ['source'],
        lib: ['lib.es2021.d.ts'],
        types: [],
        esModuleInterop: true,
        skipLibCheck: false,
      },
    });
    const label = `${dist ? 'dist' : 'source'}/${nodeNext ? 'NodeNext' : 'Bundler'}`;
    errors.push(
      ...ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => `${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
    );
    for (const file of program.getSourceFiles()) {
      if (/(?:[/\\](?:mobx|react|react-dom|@remix-run|axios)[/\\]|lib\.(?:dom|webworker)[.])/i.test(file.fileName))
        errors.push(`${label}: Portable entries reach platform dependency ${relative(root, file.fileName)}`);
    }
  }
  const platform = ts.createProgram({
    rootNames: ['./request', './browser', './crypto'].map((name) => resolve(root, pkg.exports[name][field])),
    options: {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      customConditions: dist ? [] : ['source'],
      lib: ['lib.esnext.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      esModuleInterop: true,
      skipLibCheck: false,
    },
  });
  errors.push(
    ...ts
      .getPreEmitDiagnostics(platform)
      .map(
        (diagnostic) =>
          `${dist ? 'dist' : 'source'}/platform: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
      )
  );
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Core entries, portable contracts, and platform boundaries are valid.');
