import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { publicationManifest, publishPackages } from './studio-ui-release.mjs';

const core = { name: '@vesoft-inc/studio-core', version: '0.0.2', integrity: 'sha512-core' };
const ui = { name: '@vesoft-inc/studio-ui', version: '0.1.0', integrity: 'sha512-ui' };

function makeRegistry() {
  const metadata = new Map();
  const writes = [];
  function record(artifact, tag) {
    const { name, version, integrity } = artifact;
    if (!metadata.has(name)) metadata.set(name, { versions: {}, 'dist-tags': {} });
    const entry = metadata.get(name);
    entry.versions[version] = { dist: { integrity } };
    entry['dist-tags'][tag] = version;
  }
  const operations = {
    inspect: async (name) => metadata.get(name) ?? {},
    publish: async (artifact, tag) => {
      writes.push([artifact.name, tag]);
      record(artifact, tag);
    },
    wait: async () => {},
    report: async () => {},
  };
  return { operations, record, writes };
}

test('publication manifests expose built entries and pin the installable Core version', async () => {
  for (const pkg of [core, ui]) {
    const path = new URL(`../packages/${pkg.name.split('/')[1]}/package.json`, import.meta.url);
    const source = JSON.parse(await readFile(path, 'utf8'));
    const manifest = publicationManifest(source, core.version);
    assert.equal(source.private, true);
    assert.equal(manifest.private, undefined);
    assert.equal(manifest.devDependencies, undefined);
    assert.equal(manifest.scripts, undefined);
    assert.ok(manifest.files.includes('LICENSE'));
    assert.ok(
      Object.values(manifest.exports).every((entry) => Object.values(entry).every((path) => path.startsWith('./dist/')))
    );
    if (pkg === ui) assert.equal(manifest.dependencies[core.name], core.version);
    assert.throws(
      () =>
        publicationManifest({ ...source, dependencies: { '@vesoft-inc/studio-ui-internal': '1.0.0' } }, core.version),
      /Unpublishable dependency/
    );
  }
});

test('publishes Core before UI, waits for registry readback, and repeats without writes', async () => {
  const { operations, record, writes } = makeRegistry();
  const publish = operations.publish;
  let waiting;
  operations.publish = async (artifact, tag) => {
    if (artifact === core) {
      writes.push([core.name, tag]);
      waiting = tag;
    } else {
      assert.equal(waiting, undefined);
      await publish(artifact, tag);
    }
  };
  operations.wait = async () => {
    record(core, waiting);
    waiting = undefined;
  };
  await publishPackages([core, ui], operations);
  await publishPackages([core, ui], operations);
  assert.deepEqual(writes, [
    [core.name, 'latest'],
    [ui.name, 'latest'],
  ]);
});

test('retries a partial publication without publishing Core again', async () => {
  const { operations, writes } = makeRegistry();
  const failUi = {
    ...operations,
    publish: async (artifact, tag) => {
      if (artifact === ui) throw new Error('npm write failed');
      await operations.publish(artifact, tag);
    },
  };
  await assert.rejects(publishPackages([core, ui], failUi), /npm write failed/);
  await publishPackages([core, ui], operations);
  assert.deepEqual(writes, [
    [core.name, 'latest'],
    [ui.name, 'latest'],
  ]);
});

test('recognizes an accepted publication after a lost response', async () => {
  const { operations, writes } = makeRegistry();
  await publishPackages([ui], {
    ...operations,
    publish: async (...args) => {
      await operations.publish(...args);
      throw new Error('connection lost');
    },
  });
  assert.deepEqual(writes, [[ui.name, 'latest']]);
});

test('fails before writing either package on a version collision or failed lookup', async () => {
  const { operations, record, writes } = makeRegistry();
  record({ ...ui, integrity: 'different' }, 'latest');
  await assert.rejects(publishPackages([core, ui], operations), /different contents/);
  await assert.rejects(
    publishPackages([core, ui], {
      ...operations,
      inspect: async () => {
        throw new Error('HTTP 403');
      },
    }),
    /HTTP 403/
  );
  assert.deepEqual(writes, []);
});

test('uses next for prereleases and preserves newer channel pointers', async () => {
  const { operations, record, writes } = makeRegistry();
  record({ ...ui, version: '0.2.0' }, 'latest');
  const preview = { ...ui, version: '0.3.0-rc.2' };
  await publishPackages([ui], operations);
  await publishPackages([preview], operations);
  await publishPackages([{ ...preview, version: '0.3.0-rc.1' }], operations);
  assert.deepEqual(writes, [
    [ui.name, 'release-0.1.0'],
    [ui.name, 'next'],
    [ui.name, 'release-0.3.0-rc.1'],
  ]);
  assert.deepEqual((await operations.inspect(ui.name))['dist-tags'], {
    latest: '0.2.0',
    'release-0.1.0': '0.1.0',
    next: '0.3.0-rc.2',
    'release-0.3.0-rc.1': '0.3.0-rc.1',
  });
});
