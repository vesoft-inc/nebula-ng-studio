import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

await mkdir('.temp', { recursive: true });
const entries = JSON.parse(await readFile('public-api.json', 'utf8'));
await writeFile(
  '.temp/public-api.d.ts',
  Object.keys(entries)
    .map((entry) => `export * from '../dist/${entry === '.' ? 'index' : entry.slice(2)}.js';`)
    .join('\n')
);
const config = ExtractorConfig.prepare({
  configObject: {
    projectFolder: resolve('.'),
    newlineKind: 'lf',
    mainEntryPointFilePath: '<projectFolder>/.temp/public-api.d.ts',
    compiler: {
      tsconfigFilePath: '<projectFolder>/tsconfig.json',
      overrideTsconfig: { compilerOptions: { customConditions: [] } },
    },
    apiReport: {
      enabled: true,
      reportFolder: '<projectFolder>/etc',
      reportTempFolder: '<projectFolder>/.temp',
      reportFileName: 'studio-ui.api.md',
    },
    docModel: { enabled: false },
    dtsRollup: { enabled: false },
    tsdocMetadata: { enabled: false },
    messages: {
      extractorMessageReporting: {
        default: { logLevel: 'warning' },
        'ae-missing-release-tag': { logLevel: 'none' },
        'ae-undocumented': { logLevel: 'none' },
      },
    },
  },
  configObjectFullPath: resolve('.temp/api-extractor.json'),
  packageJsonFullPath: resolve('package.json'),
});
const result = Extractor.invoke(config, { localBuild: process.argv.includes('--update'), showVerboseMessages: false });
if (!result.succeeded) process.exitCode = 1;
