/**
 * Map the Web manifest version (the single source of truth) to the values
 * required by electron-builder and the macOS bundle.
 */
export function versionInfo(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(version ?? '').trim());
  if (!match) {
    throw new Error(`Version "${version}" must be a canonical SemVer value`);
  }

  const core = `${match[1]}.${match[2]}.${match[3]}`;
  const prerelease = match[4] ?? '';
  // CFBundleVersion must be a period-separated list of integers, so fold the
  // prerelease identifiers into one numeric build component.
  const buildComponent = prerelease ? (prerelease.match(/\d+/g) ?? []).join('') || '0' : '';

  return {
    version: String(version).trim(),
    core,
    prerelease,
    bundleVersion: buildComponent ? `${core}.${buildComponent}` : core,
  };
}
