import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyVersion, compareVersions, parseStudioVersion } from './release-channel-policy.mjs';

test('classifies stable releases and their channels', () => {
  assert.deepEqual(classifyVersion('5.4.0'), {
    version: '5.4.0',
    kind: 'stable',
    isPrerelease: false,
    major: 5,
    minor: 4,
    patch: 0,
    prereleaseNumber: null,
    channels: ['5.4', '5', 'latest'],
  });
});

test('classifies release candidates and beta releases independently', () => {
  assert.deepEqual(classifyVersion('5.4.0-rc.12', true).channels, ['5.4-rc', 'rc']);
  assert.deepEqual(classifyVersion('5.4.0-beta.3', true).channels, ['5.4-beta', 'beta']);
});

test('classifies alpha releases without promoting mutable channels', () => {
  assert.deepEqual(classifyVersion('5.4.0-alpha.12', true), {
    version: '5.4.0-alpha.12',
    kind: 'alpha',
    isPrerelease: true,
    major: 5,
    minor: 4,
    patch: 0,
    prereleaseNumber: 12,
    channels: [],
  });
});

test('accepts other canonical prereleases as immutable-only releases', () => {
  for (const version of [
    '5.4.0-alpha',
    '5.4.0-alpha.foo',
    '5.4.0-preview.1',
    '5.4.0-0.3.7',
    '5.4.0-x.7.z.92',
    '5.4.0-rc',
    '5.4.0-rc.foo',
  ]) {
    const classification = classifyVersion(version, true);
    assert.equal(classification.kind, 'prerelease');
    assert.equal(classification.isPrerelease, true);
    assert.equal(classification.prereleaseNumber, null);
    assert.deepEqual(classification.channels, []);
  }
});

test('rejects a GitHub prerelease flag that conflicts with the version', () => {
  assert.throws(() => classifyVersion('5.4.0-rc.1', false), /conflicts/);
  assert.throws(() => classifyVersion('5.4.0', true), /conflicts/);
});

test('rejects versions outside the Studio release policy', () => {
  const tooLong = `1.0.0-${'a'.repeat(123)}`;
  for (const version of [
    'v5.4.0',
    '5.4',
    '5.4.0+build.1',
    '5.4.0-rc.01',
    '5.4.0-alpha..1',
    '5.4.0_alpha.1',
    '05.4.0',
    '5.04.0',
    '5.4.00',
    tooLong,
  ]) {
    assert.throws(() => parseStudioVersion(version));
  }
});

test('accepts the maximum OCI tag length', () => {
  const version = `1.0.0-${'a'.repeat(122)}`;
  assert.equal(version.length, 128);
  assert.equal(parseStudioVersion(version).version, version);
});

test('compares stable and prerelease versions with SemVer ordering', () => {
  assert.equal(compareVersions('5.10.0', '5.9.9'), 'advance');
  assert.equal(compareVersions('5.4.0-rc.10', '5.4.0-rc.2'), 'advance');
  assert.equal(compareVersions('5.4.0-beta', '5.4.0-alpha.99'), 'advance');
  assert.equal(compareVersions('5.4.0-beta.3', '5.4.0-beta.3'), 'equal');
  assert.equal(compareVersions('5.3.2', '5.4.0'), 'behind');
});
