#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { compareVersions, parseStudioVersion } from './release-channel-policy.mjs';

export function selectReleaseNotesBase(version, releases, reachableTags) {
  const current = parseStudioVersion(version);
  const reachable = new Set(reachableTags);
  let previousRc = '';
  let previousStable = '';

  for (const release of releases) {
    const tag = release?.tag_name;
    if (
      release?.draft !== false ||
      typeof release.published_at !== 'string' ||
      release.published_at.length === 0 ||
      typeof tag !== 'string' ||
      !tag.startsWith('v') ||
      !reachable.has(tag)
    ) {
      continue;
    }

    let candidate;
    try {
      candidate = parseStudioVersion(tag.slice(1));
    } catch {
      // Older Releases may use tag names outside the Studio version policy.
      continue;
    }
    if (compareVersions(candidate.version, current.version) !== 'behind') continue;

    if (candidate.kind === 'stable') {
      if (!previousStable || compareVersions(candidate.version, previousStable.slice(1)) === 'advance') {
        previousStable = tag;
      }
    } else if (
      current.kind === 'rc' &&
      candidate.kind === 'rc' &&
      candidate.major === current.major &&
      candidate.minor === current.minor &&
      candidate.patch === current.patch
    ) {
      if (!previousRc || compareVersions(candidate.version, previousRc.slice(1)) === 'advance') {
        previousRc = tag;
      }
    }
  }

  return previousRc || previousStable;
}

function query(command, args, description) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(`${description}: ${error.stderr?.trim() || error.message}`, { cause: error });
  }
}

function main(args) {
  if (args.length !== 2) throw new Error('Usage: release-notes-base.mjs <version> <target-sha>');
  const [version, target] = args;
  parseStudioVersion(version);
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.');

  const targetSha = query(
    'git',
    ['rev-parse', '--verify', '--end-of-options', `${target}^{commit}`],
    'Cannot resolve the release commit'
  ).trim();
  const reachableTags = query(
    'git',
    ['tag', '--merged', targetSha, '--list', 'v*'],
    'Cannot read reachable release tags'
  )
    .trim()
    .split('\n')
    .filter(Boolean);
  const response = query(
    'gh',
    ['api', '--paginate', '--slurp', `repos/${repository}/releases?per_page=100`],
    'Cannot list GitHub Releases'
  );
  let pages;
  try {
    pages = JSON.parse(response);
  } catch (error) {
    throw new Error('GitHub Releases response is not valid JSON.', { cause: error });
  }
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error('Expected paginated GitHub Releases arrays.');
  }

  // An empty baseline deliberately includes the full history for the first release.
  process.stdout.write(`${selectReleaseNotesBase(version, pages.flat(), reachableTags)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Release notes baseline: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
