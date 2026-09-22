import assert from 'node:assert/strict';
import test from 'node:test';
import { nativePackageVersions } from './native-package-version.mjs';

test('maps stable versions to native package versions', () => {
  assert.deepEqual(nativePackageVersions('5.4.0'), {
    sourceVersion: '5.4.0',
    debVersion: '5.4.0-1',
    debFileVersion: '5.4.0-1',
    debUpstream: '5.4.0',
    rpmVersion: '5.4.0',
    rpmFileVersion: '5.4.0',
    rpmRelease: '1',
  });
});

test('sorts prereleases below their stable version', () => {
  const version = nativePackageVersions('5.4.0-rc.3');
  assert.equal(version.debVersion, '5.4.0~rc.3-1');
  assert.equal(version.debFileVersion, '5.4.0.rc.3-1');
  assert.equal(version.rpmVersion, '5.4.0~rc.3');
  assert.equal(version.rpmFileVersion, '5.4.0.rc.3');
});

test('maps common prerelease channels without changing their identifiers', () => {
  assert.equal(nativePackageVersions('5.4.0-alpha.1').rpmVersion, '5.4.0~alpha.1');
  assert.equal(nativePackageVersions('5.4.0-beta.2').debVersion, '5.4.0~beta.2-1');
  assert.equal(nativePackageVersions('5.4.0-rc.10').rpmVersion, '5.4.0~rc.10');
});

test('encodes hyphens in RPM prerelease identifiers without colliding with SemVer underscores', () => {
  const version = nativePackageVersions('5.4.0-preview-build.2');
  assert.equal(version.debVersion, '5.4.0~preview-build.2-1');
  assert.equal(version.rpmVersion, '5.4.0~preview_build.2');
});

test('maps internal build metadata into an installable prerelease version', () => {
  const version = nativePackageVersions('0.0.0-dev+abcdef');
  assert.equal(version.debVersion, '0.0.0~dev.build.abcdef-1');
  assert.equal(version.debFileVersion, '0.0.0.dev.build.abcdef-1');
  assert.equal(version.rpmVersion, '0.0.0~dev.build.abcdef');
  assert.equal(version.rpmFileVersion, '0.0.0.dev.build.abcdef');
});

test('rejects noncanonical input', () => {
  for (const version of ['v5.4.0', '5.4', ' 5.4.0']) {
    assert.throws(() => nativePackageVersions(version), /canonical SemVer/);
  }
});
