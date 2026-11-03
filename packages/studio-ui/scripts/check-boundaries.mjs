import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const surface = JSON.parse(await readFile(resolve(root, 'public-api.json'), 'utf8'));
const dist = process.argv.includes('--dist');
const errors = [];
const equal = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const forbiddenPackages =
  /^(?:@vesoft-inc\/(?:studio-ui-internal|force-graph)|@tanstack\/(?:react-router|router-core)|react-router(?:-dom)?)(?:\/|$)/;
const runtimeTypes =
  /(?:^|\/)(?:mobx(?:-react-lite)?|monaco-editor|force-graph|@tanstack\/(?:react-router|router-core)|react-router(?:-dom)?)(?:\/|$)/;
if (!equal(Object.keys(pkg.exports), [...Object.keys(surface), './styles.css']))
  errors.push('Public entry list differs from public-api.json.');
if (Object.keys(pkg.exports).some((name) => name.includes('*'))) errors.push('Wildcard exports are not supported.');
if (Object.values(pkg.exports).some((entry) => 'source' in entry))
  errors.push('External consumers must use built exports.');
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies }))
  if (forbiddenPackages.test(name)) errors.push(`Forbidden installed dependency: ${name}`);

const sourceProgram = ts.createProgram({
  rootNames: [...Object.values(surface).map((entry) => resolve(root, entry.source)), resolve(root, 'src/env.d.ts')],
  options: {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    customConditions: ['source'],
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    skipLibCheck: true,
  },
});
const checker = sourceProgram.getTypeChecker();
for (const [name, spec] of Object.entries(surface)) {
  const source = sourceProgram.getSourceFile(resolve(root, spec.source));
  const module = source && checker.getSymbolAtLocation(source);
  const actual = module ? checker.getExportsOfModule(module).map((symbol) => symbol.name) : [];
  if (!equal(actual, spec.exports))
    errors.push(`${name}: exported symbols differ from the explicit allowlist. Actual: ${actual.join(', ')}`);
  if (source?.statements.some((node) => ts.isExportDeclaration(node) && !node.exportClause))
    errors.push(`${name}: public entries must use named exports.`);
}

async function files(directory) {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory() ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]
      )
    )
  ).flat();
}
function imports(source, runtimeOnly = false) {
  const specifiers = [];
  function visit(node) {
    if (runtimeOnly) {
      if (ts.isImportTypeNode(node)) return;
      if (
        ts.isImportDeclaration(node) &&
        (node.importClause?.isTypeOnly ||
          (node.importClause?.namedBindings &&
            ts.isNamedImports(node.importClause.namedBindings) &&
            !node.importClause.name &&
            node.importClause.namedBindings.elements.every((item) => item.isTypeOnly)))
      )
        return;
      if (
        ts.isExportDeclaration(node) &&
        (node.isTypeOnly ||
          (node.exportClause &&
            ts.isNamedExports(node.exportClause) &&
            node.exportClause.elements.every((item) => item.isTypeOnly)))
      )
        return;
    }
    let value;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) value = node.moduleSpecifier;
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) value = node.argument.literal;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')
    )
      value = node.arguments[0];
    if (value && ts.isStringLiteral(value)) specifiers.push(value.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specifiers;
}
// Internal implementations and core cannot acquire a reverse dependency on the facade.
for (const name of ['studio-ui-internal', 'studio-core']) {
  for (const file of await files(resolve(root, '..', name, 'src'))) {
    if (!/\.[jt]sx?$/.test(file) || /\.test\./.test(file)) continue;
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    if (imports(source).some((id) => id === pkg.name || id.startsWith(`${pkg.name}/`)))
      errors.push(`Reverse dependency: ${relative(root, file)}`);
  }
}
const adapterEntry = `${pkg.name}/adapters/studio-server`;
const adapterSource = resolve(root, 'src/adapters/studio-server');
// Hosts may share the HTTP adapter without mixing UI contexts.
for (const name of ['web', 'gui']) {
  for (const file of await files(resolve(root, '../../apps', name, 'src'))) {
    if (!/\.[jt]sx?$/.test(file) || /\.test\./.test(file)) continue;
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    if (
      imports(source).some(
        (id) => (id === pkg.name || id.startsWith(`${pkg.name}/`)) && !(name === 'web' && id === adapterEntry)
      )
    )
      errors.push(`Do not mix external and internal UI contexts in ${name}: ${relative(root, file)}`);
  }
}

// The optional adapter is a service-only entry. Follow local runtime imports so
// an innocent-looking helper cannot pull in providers, models or UI barrels.
const adapterVisited = new Set();
async function checkAdapterSource(file) {
  if (adapterVisited.has(file)) return;
  adapterVisited.add(file);
  if (!file.startsWith(`${adapterSource}/`)) {
    errors.push(`Adapter loads UI source: ${relative(root, file)}`);
    return;
  }
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const id of imports(source, true)) {
    if (id.startsWith('.')) {
      const result = ts.resolveModuleName(id, file, sourceProgram.getCompilerOptions(), ts.sys).resolvedModule;
      if (result) await checkAdapterSource(result.resolvedFileName);
      else errors.push(`Unresolved adapter import: ${id}`);
    } else if (!/^(?:@vesoft-inc\/studio-core(?:\/(?:contracts|request|graph))?|axios)$/.test(id))
      errors.push(`Adapter loads a runtime dependency: ${id}`);
  }
}
await checkAdapterSource(resolve(adapterSource, 'index.ts'));
for (const file of await files(resolve(root, 'src'))) {
  if (!/\.[jt]sx?$/.test(file) || /\.test\./.test(file) || file.startsWith(`${adapterSource}/`)) continue;
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const id of imports(source)) {
    const result = ts.resolveModuleName(id, file, sourceProgram.getCompilerOptions(), ts.sys).resolvedModule;
    if (id === adapterEntry || result?.resolvedFileName.startsWith(`${adapterSource}/`))
      errors.push(`UI source imports the optional adapter: ${relative(root, file)}`);
  }
}

if (dist) {
  for (const [name, entry] of Object.entries(pkg.exports))
    for (const target of new Set(Object.values(entry))) {
      try {
        await access(resolve(root, target));
      } catch {
        errors.push(`Missing export ${name}: ${target}`);
      }
    }
  const built = await files(resolve(root, 'dist'));
  const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });
  for (const file of built) {
    if (!/\.(?:js|ts)$/.test(file)) continue;
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const id of imports(source)) {
      if (forbiddenPackages.test(id) || /^@(studio|gui)(\/|$)/.test(id))
        errors.push(`Private runtime dependency in ${relative(root, file)}: ${id}`);
      if (file.endsWith('.d.ts') && runtimeTypes.test(id))
        errors.push(`Public declarations expose runtime types: ${id}`);
      if (id.startsWith('.')) {
        const target = resolve(dirname(file), id.replace(/\.js$/, file.endsWith('.d.ts') ? '.d.ts' : '.js'));
        if (relative(resolve(root, 'dist'), target).startsWith('..')) errors.push(`Built import escapes dist: ${id}`);
        try {
          await access(target);
        } catch {
          errors.push(`Unresolved built import: ${relative(root, file)} -> ${id}`);
        }
      } else if (!dependencies.some((name) => id === name || id.startsWith(`${name}/`)))
        errors.push(`Undeclared built dependency: ${id}`);
    }
    if (
      file.endsWith('.d.ts') &&
      /\b(?:\w*(?:Controller|Store)|IStandaloneCodeEditor|GraphRuntimeState|OpenedSnapshot)\b/.test(source.text)
    )
      errors.push(`Public declaration contains an internal runtime type: ${relative(root, file)}`);
  }
  for (const worker of ['editor', 'json', 'ts'])
    if (!built.some((file) => file.includes(`/assets/${worker}.worker-`) && file.endsWith('.js')))
      errors.push(`Missing ${worker} worker.`);

  // Follow the complete portable declaration graph, rather than checking only the facade file.
  for (const nodeNext of [false, true]) {
    const program = ts.createProgram({
      rootNames: [resolve(root, pkg.exports['./contracts'].types)],
      options: {
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2021,
        module: nodeNext ? ts.ModuleKind.NodeNext : ts.ModuleKind.ESNext,
        moduleResolution: nodeNext ? ts.ModuleResolutionKind.NodeNext : ts.ModuleResolutionKind.Bundler,
        lib: ['lib.es2021.d.ts'],
        types: [],
        esModuleInterop: true,
        skipLibCheck: false,
      },
    });
    errors.push(
      ...ts
        .getPreEmitDiagnostics(program)
        .map((item) => `Contracts: ${ts.flattenDiagnosticMessageText(item.messageText, '\n')}`)
    );
    for (const file of program.getSourceFiles())
      if (
        runtimeTypes.test(file.fileName) ||
        /[/\\](?:react|react-dom)[/\\]|lib\.(?:dom|webworker)\./.test(file.fileName)
      )
        errors.push(`Contracts reach a platform type: ${file.fileName}`);
  }
  // Pure entry JS must not transitively reach UI or engine code.
  const seen = new Set();
  const pure = async (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const id of imports(source)) {
      if (id.startsWith('.')) await pure(resolve(dirname(file), id));
      else if (!id.startsWith('@vesoft-inc/studio-core')) errors.push(`Portable entry reaches ${id}`);
    }
  };
  for (const entry of ['./contracts', './locales/zh_CN', './locales/en_US'])
    await pure(resolve(root, pkg.exports[entry].import));

  const checkAdapterGraph = async (file, visited = new Set()) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const id of imports(source)) {
      if (id.startsWith('.')) {
        await checkAdapterGraph(
          resolve(dirname(file), id.replace(/\.js$/, file.endsWith('.d.ts') ? '.d.ts' : '.js')),
          visited
        );
      } else if (!/^(?:@vesoft-inc\/studio-core(?:\/(?:contracts|request|graph))?|axios)$/.test(id))
        errors.push(`Adapter reaches a UI dependency: ${id}`);
    }
  };
  await checkAdapterGraph(resolve(root, pkg.exports['./adapters/studio-server'].import));
  await checkAdapterGraph(resolve(root, pkg.exports['./adapters/studio-server'].types));

  // Other entry declaration graphs must not acquire the optional Axios peer.
  const ordinaryVisited = new Set();
  const checkOrdinaryGraph = async (file) => {
    if (ordinaryVisited.has(file)) return;
    ordinaryVisited.add(file);
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const id of imports(source)) {
      if (id === 'axios') errors.push(`Ordinary UI entry requires Axios: ${relative(root, file)}`);
      if (id.startsWith('.'))
        await checkOrdinaryGraph(resolve(dirname(file), id.replace(/\.js$/, file.endsWith('.d.ts') ? '.d.ts' : '.js')));
    }
  };
  for (const [name, entry] of Object.entries(pkg.exports)) {
    if (name === './adapters/studio-server' || name === './styles.css') continue;
    await checkOrdinaryGraph(resolve(root, entry.import));
    await checkOrdinaryGraph(resolve(root, entry.types));
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Public API, dependency directions, declarations and package boundaries are valid.');
