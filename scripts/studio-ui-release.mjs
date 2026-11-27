import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import semver from 'semver';
import { parseStudioVersion } from './release-channel-policy.mjs';

const root = new URL('../', import.meta.url);
const registry = 'https://registry.npmjs.org';
const repository = { type: 'git', url: 'git+https://github.com/vesoft-inc/nebula-ng-studio.git' };
const coreName = '@vesoft-inc/studio-core';
const uiName = '@vesoft-inc/studio-ui';
const packages = [coreName, uiName];

async function readManifest(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

export function publicationManifest(source, coreVersion) {
  const manifest = structuredClone(source);
  parseStudioVersion(manifest.version);
  const { name } = manifest;
  if (!packages.includes(name)) throw new Error(`Unsupported publication package: ${name}`);

  delete manifest.private;
  delete manifest.scripts;
  delete manifest.devDependencies;
  manifest.repository = { ...repository, directory: `packages/${name.split('/')[1]}` };
  manifest.license ??= 'Apache-2.0';
  manifest.files = name === coreName ? ['dist', 'LICENSE'] : ['dist', 'LICENSE', 'THIRD_PARTY_NOTICES'];
  for (const conditions of Object.values(manifest.exports)) delete conditions.source;
  if (name === uiName) {
    parseStudioVersion(coreVersion);
    manifest.dependencies[coreName] = coreVersion;
  }
  for (const dependencies of [manifest.dependencies, manifest.peerDependencies, manifest.optionalDependencies]) {
    for (const [dependency, range] of Object.entries(dependencies ?? {})) {
      if (
        dependency === '@vesoft-inc/studio-ui-internal' ||
        dependency === '@vesoft-inc/force-graph' ||
        /^(workspace|link|file):/.test(range)
      ) {
        throw new Error(`Unpublishable dependency in ${name}: ${dependency}@${range}`);
      }
    }
  }
  return manifest;
}

async function listPackages(directory) {
  const manifests = await Promise.all(
    packages.map(async (name) => {
      const packageDir = new URL(`packages/${name.split('/')[1]}/`, root);
      const source = await readManifest(new URL('package.json', packageDir));
      if (source.name !== name) throw new Error(`Expected ${name}, found ${source.name}`);
      return { name, packageDir, source, version: parseStudioVersion(source.version).version };
    })
  );
  const coreVersion = manifests[0].version;
  return manifests.map((entry) => ({
    ...entry,
    manifest: publicationManifest(entry.source, coreVersion),
    tarball: join(directory, `${entry.name.slice(1).replace('/', '-')}-${entry.version}.tgz`),
  }));
}

async function pack(directory) {
  const artifacts = await listPackages(directory);
  const staging = await mkdtemp(join(tmpdir(), 'studio-ui-npm-'));
  try {
    await mkdir(directory, { recursive: true });
    for (const { packageDir, manifest, tarball } of artifacts) {
      const target = join(staging, manifest.name.split('/')[1]);
      await mkdir(target);
      await cp(new URL('dist/', packageDir), join(target, 'dist'), { recursive: true });
      for (const file of manifest.files.filter((file) => file !== 'dist')) {
        const sourceDir = manifest.name === coreName ? root : packageDir;
        await cp(new URL(file, sourceDir), join(target, file));
      }
      for (const entry of Object.values(manifest.exports)) {
        for (const path of new Set(Object.values(entry))) await access(join(target, path));
      }
      await writeFile(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      execFileSync('npm', ['pack', target, '--ignore-scripts', '--pack-destination', directory], { stdio: 'inherit' });
      await access(tarball);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function readRegistry(name) {
  const response = await fetch(`${registry}/${name.replace('/', '%2f')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json', 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`Cannot inspect ${name} on npm: HTTP ${response.status}`);
  const data = await response.json();
  const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
  if (data?.name !== name || !isRecord(data.versions) || !isRecord(data['dist-tags'])) {
    throw new Error(`Unexpected npm registry metadata for ${name}`);
  }
  return data;
}

function published(artifact, metadata) {
  const version = metadata.versions?.[artifact.version];
  if (!version) return false;
  if (version.dist?.integrity !== artifact.integrity) {
    throw new Error(`${artifact.name}@${artifact.version} already exists with different contents. Bump its version.`);
  }
  return true;
}

function publishTag(version, tags) {
  const channel = semver.prerelease(version) ? 'next' : 'latest';
  const current = tags?.[channel];
  return current && semver.gte(current, version) ? `release-${version}` : channel;
}

export async function publishPackages(artifacts, { inspect, publish, wait, report }) {
  // Check both versions before the first write so a collision in UI cannot leave a new core behind.
  const plan = await Promise.all(
    artifacts.map(async (artifact) => {
      const metadata = await inspect(artifact.name);
      const exists = published(artifact, metadata);
      return {
        artifact,
        exists,
        tag: exists ? undefined : publishTag(artifact.version, metadata['dist-tags']),
      };
    })
  );
  for (const { artifact, exists, tag } of plan) {
    const spec = `${artifact.name}@${artifact.version}`;
    if (exists) {
      await report(`${spec} already published (matching integrity)`);
      continue;
    }

    let publishError;
    try {
      await publish(artifact, tag);
    } catch (error) {
      // A lost response can follow a committed publish. Read back before reporting failure.
      publishError = error;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      if (published(artifact, await inspect(artifact.name))) {
        await report(`${spec} published with tag ${tag}`);
        break;
      }
      if (attempt === 5) throw publishError ?? new Error(`${spec} not visible after publishing`);
      await wait();
    }
  }
}

async function publish(directory) {
  const artifacts = await listPackages(directory);
  await Promise.all(
    artifacts.map(async (artifact) => {
      artifact.integrity = `sha512-${createHash('sha512')
        .update(await readFile(artifact.tarball))
        .digest('base64')}`;
    })
  );
  await publishPackages(artifacts, {
    inspect: readRegistry,
    publish: ({ tarball }, tag) =>
      execFileSync(
        'npm',
        ['publish', tarball, '--registry', registry, '--access', 'public', '--ignore-scripts', '--tag', tag],
        {
          stdio: 'inherit',
        }
      ),
    wait: () => delay(2_000),
    report: async (message) => {
      console.log(message);
      if (process.env.GITHUB_STEP_SUMMARY) {
        await writeFile(process.env.GITHUB_STEP_SUMMARY, `- ${message}\n`, { flag: 'a' });
      }
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, directory] = process.argv.slice(2);
  if (!directory || !['pack', 'publish'].includes(command)) {
    throw new Error('Usage: studio-ui-release.mjs <pack|publish> <artifact-directory>');
  }
  await (command === 'pack' ? pack : publish)(resolve(directory));
}
