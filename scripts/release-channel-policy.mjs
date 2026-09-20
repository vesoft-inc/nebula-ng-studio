#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const OCI_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const OCI_TAG_MAX_LENGTH = 128;

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Expected "true" or "false", received "${value}".`);
}

export function parseStudioVersion(value) {
  if (typeof value !== 'string') throw new Error('Studio version must be a string.');

  const parsed = semver.parse(value, { loose: false });
  if (!parsed) throw new Error(`Invalid Studio SemVer version "${value}".`);
  if (parsed.build.length !== 0) {
    throw new Error(`Studio version "${value}" must not contain SemVer build metadata.`);
  }
  if (parsed.version !== value) {
    throw new Error(`Studio version "${value}" must use canonical SemVer syntax without a leading v.`);
  }
  if (value.length > OCI_TAG_MAX_LENGTH || !OCI_TAG_PATTERN.test(value)) {
    throw new Error(`Studio version "${value}" must also be a valid OCI tag of at most 128 characters.`);
  }

  const prerelease = parsed.prerelease;
  let kind = 'stable';
  let prereleaseNumber = null;
  if (prerelease.length > 0) {
    const [identifier, sequence, ...extra] = prerelease;
    if (
      extra.length !== 0 ||
      (identifier !== 'rc' && identifier !== 'beta' && identifier !== 'alpha') ||
      !Number.isSafeInteger(sequence) ||
      sequence < 0
    ) {
      kind = 'prerelease';
    } else {
      kind = identifier;
      prereleaseNumber = sequence;
    }
  }

  let channels = [];
  if (kind === 'stable') {
    channels = [`${parsed.major}.${parsed.minor}`, `${parsed.major}`, 'latest'];
  } else if (kind === 'rc' || kind === 'beta') {
    channels = [`${parsed.major}.${parsed.minor}-${kind}`, kind];
  }

  return {
    version: value,
    kind,
    isPrerelease: prerelease.length > 0,
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
    prereleaseNumber,
    channels,
  };
}

export function classifyVersion(value, githubPrerelease) {
  const classification = parseStudioVersion(value);
  if (githubPrerelease === undefined) return classification;

  const releaseFlag = typeof githubPrerelease === 'boolean' ? githubPrerelease : parseBoolean(githubPrerelease);
  if (classification.isPrerelease !== releaseFlag) {
    throw new Error(
      `GitHub prerelease=${releaseFlag} conflicts with Studio version "${value}" (${classification.kind}).`
    );
  }
  return classification;
}

export function compareVersions(candidate, current) {
  parseStudioVersion(candidate);
  parseStudioVersion(current);
  const comparison = semver.compare(candidate, current);
  if (comparison > 0) return 'advance';
  if (comparison < 0) return 'behind';
  return 'equal';
}

function usage() {
  return [
    'Usage:',
    '  release-channel-policy.mjs classify <version> [github-prerelease]',
    '  release-channel-policy.mjs compare <candidate> <current>',
  ].join('\n');
}

function main([command, ...args]) {
  if (command === 'classify' && (args.length === 1 || args.length === 2)) {
    process.stdout.write(`${JSON.stringify(classifyVersion(args[0], args[1]))}\n`);
    return;
  }
  if (command === 'compare' && args.length === 2) {
    process.stdout.write(`${compareVersions(args[0], args[1])}\n`);
    return;
  }
  throw new Error(usage());
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
