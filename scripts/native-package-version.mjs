#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

function encodeIdentifiers(identifiers, separator) {
  return identifiers.map((identifier) => String(identifier).replaceAll('-', separator)).join('.');
}

export function nativePackageVersions(value) {
  const parsed = semver.parse(value, { loose: false });
  const canonical = parsed ? `${parsed.version}${parsed.build.length > 0 ? `+${parsed.build.join('.')}` : ''}` : '';
  if (!parsed || canonical !== value) {
    throw new Error(`Version "${value}" must use canonical SemVer syntax.`);
  }

  const core = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  const identifiers = [...parsed.prerelease];
  if (parsed.build.length > 0) identifiers.push('build', ...parsed.build);
  const debSuffix = encodeIdentifiers(identifiers, '-');
  const rpmSuffix = encodeIdentifiers(identifiers, '_');
  const debUpstream = debSuffix ? `${core}~${debSuffix}` : core;
  const rpmVersion = rpmSuffix ? `${core}~${rpmSuffix}` : core;

  return {
    sourceVersion: value,
    debVersion: `${debUpstream}-1`,
    debFileVersion: `${debUpstream.replaceAll('~', '.')}-1`,
    debUpstream,
    rpmVersion,
    rpmFileVersion: rpmVersion.replaceAll('~', '.'),
    rpmRelease: '1',
  };
}

function main(args) {
  if (args.length !== 1) throw new Error('Usage: native-package-version.mjs <version>');
  process.stdout.write(`${JSON.stringify(nativePackageVersions(args[0]))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
