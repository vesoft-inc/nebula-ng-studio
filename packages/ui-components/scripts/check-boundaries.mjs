import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const workspace = resolve(root, '../..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const dependencies = new Set([
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  ...Object.keys(pkg.devDependencies),
]);
const errors = [];

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
}

async function checkSources(directory, library) {
  for (const path of await files(directory)) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
    const business = library && /^(schema|schema-editor|explorer|shell|integrations)\//.test(relative(directory, path));
    const production = !/\.test\.[jt]sx?$/.test(path);
    const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
    const report = (node, message) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      errors.push(`${relative(workspace, path)}:${line + 1}: ${message}`);
    };
    const visit = (node) => {
      if (library && ts.isIdentifier(node) && node.text === 'APP_TARGET')
        report(node, 'Application target belongs in the host adapter.');
      if (
        business &&
        production &&
        ts.isPropertyAccessExpression(node) &&
        node.expression.getText(source) === 'process' &&
        node.name.text === 'env'
      )
        report(node, 'Application environment belongs in the host adapter.');
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')
      )
        specifier = node.arguments[0];
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal;
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        if (business && production && name === 'react-router-dom')
          report(node, 'Business components accept semantic navigation callbacks; routers belong in the host.');
        if (
          business &&
          production &&
          ts.isImportDeclaration(node) &&
          node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          for (const binding of node.importClause.namedBindings.elements) {
            if (['modalStore', 'themeStore'].includes((binding.propertyName ?? binding.name).text))
              report(node, 'Business components use provider instances rather than process-wide UI stores.');
          }
        }
        if (/^@(studio|gui)(\/|$)/.test(name) && (library || !name.startsWith('@gui/')))
          report(node, `Forbidden application import: ${name}`);
        if (name.startsWith('.')) {
          const target = relative(directory, resolve(dirname(path), name));
          if (target.startsWith('..')) report(node, `Import escapes the source directory: ${name}`);
          if (
            library &&
            production &&
            target.startsWith('integrations/') &&
            !/^(entries|integrations)\//.test(relative(directory, path))
          )
            report(node, 'Optional integrations are composed by hosts; business modules must not depend on them.');
        } else if (library) {
          const dependency = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0];
          if (!dependencies.has(dependency)) report(node, `Undeclared dependency: ${dependency}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

await checkSources(resolve(root, 'src'), true);
await checkSources(resolve(workspace, 'apps/gui/src'), false);

for (const [name, entry] of Object.entries(pkg.exports)) {
  const targets = process.argv.includes('--dist') ? Object.values(entry) : [entry.source];
  for (const target of new Set(targets)) {
    try {
      await access(resolve(root, target));
    } catch {
      errors.push(`Missing export ${name}: ${target}`);
    }
  }
}
if (process.argv.includes('--dist')) {
  const builtFiles = await files(resolve(root, 'dist'));
  if (builtFiles.some((path) => relative(root, path).includes('/node_modules/')))
    errors.push('Build contains a node_modules directory that npm would omit.');
  for (const worker of ['editor', 'json', 'ts']) {
    if (!builtFiles.some((path) => path.includes(`/assets/${worker}.worker-`) && path.endsWith('.js')))
      errors.push(`Missing ${worker} worker asset.`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Component boundaries and public exports are valid.');
