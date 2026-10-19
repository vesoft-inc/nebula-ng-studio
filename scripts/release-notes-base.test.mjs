import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectReleaseNotesBase } from './release-notes-base.mjs';

function published(tag, overrides = {}) {
  return { tag_name: tag, draft: false, published_at: '2026-01-01T00:00:00Z', ...overrides };
}

function select(version, releases, tags = releases.map((release) => release.tag_name)) {
  return selectReleaseNotesBase(version, releases, tags);
}

test('compares rc.7 with the previous published RC', () => {
  assert.equal(
    select('5.3.2-rc.7', [published('v5.3.2-rc.5'), published('v5.3.2-rc.6'), published('v5.3.1')]),
    'v5.3.2-rc.6'
  );
});

test('skips a draft or tag-only rc.7 when selecting the baseline for rc.8', () => {
  for (const releases of [
    [published('v5.3.2-rc.6'), published('v5.3.2-rc.7', { draft: true, published_at: null })],
    [published('v5.3.2-rc.6'), published('v5.3.2-rc.7', { published_at: null })],
    [published('v5.3.2-rc.6')],
  ]) {
    assert.equal(select('5.3.2-rc.8', releases, ['v5.3.2-rc.6', 'v5.3.2-rc.7']), 'v5.3.2-rc.6');
  }
});

test('uses SemVer ordering instead of tag text or publication date', () => {
  assert.equal(
    select('5.3.2-rc.10', [
      published('v5.3.2-rc.9'),
      published('v5.3.2-rc.10'),
      published('v5.3.2-rc.11'),
      published('v5.3.2-rc.2', { published_at: '2026-02-01T00:00:00Z' }),
    ]),
    'v5.3.2-rc.9'
  );
});

test('excludes other series, channels and unreachable RCs', () => {
  const releases = [
    published('v5.3.2-rc.5'),
    published('v5.3.2-rc.6'),
    published('v5.3.2-beta.6'),
    published('v5.3.1-rc.6'),
    published('v5.3.3-rc.6'),
    published('v5.4.2-rc.6'),
  ];
  assert.equal(
    select(
      '5.3.2-rc.7',
      releases,
      releases.map((release) => release.tag_name).filter((tag) => tag !== 'v5.3.2-rc.6')
    ),
    'v5.3.2-rc.5'
  );
});

test('falls back to the highest older published stable release for the first RC', () => {
  assert.equal(
    select('5.10.0-rc.1', [
      published('v5.8.0'),
      published('v5.9.0'),
      published('v5.10.0'),
      published('v5.11.0'),
      published('v5.9.1', { draft: true }),
    ]),
    'v5.9.0'
  );
});

test('stable and other prerelease channels use a stable baseline', () => {
  const releases = [
    published('v5.3.1'),
    published('v5.3.2-rc.6'),
    published('v5.3.2-beta.2'),
    published('v5.3.2-alpha.2'),
  ];
  for (const version of ['5.3.2', '5.3.2-beta.3', '5.3.2-alpha.3', '5.3.2-preview.3']) {
    assert.equal(select(version, releases), 'v5.3.1');
  }
});

test('stable fallback also excludes drafts, unpublished Releases and unreachable tags', () => {
  assert.equal(
    select(
      '5.3.2-rc.1',
      [
        published('v5.3.1'),
        published('v5.3.0', { draft: true }),
        published('v5.2.9', { published_at: null }),
        published('v5.2.8'),
      ],
      ['v5.3.0', 'v5.2.9', 'v5.2.8']
    ),
    'v5.2.8'
  );
});

test('uses full history when no published reachable baseline exists', () => {
  assert.equal(select('5.3.2-rc.1', []), '');
  assert.equal(select('5.3.2', [published('v5.3.2'), published('v5.3.2-rc.6')]), '');
  assert.equal(select('5.3.2-rc.1', [published('v5.3.1')], []), '');
});

test('ignores historical tags outside the Studio version policy', () => {
  assert.equal(
    select('5.3.2-rc.7', [
      published('v5.3.2-rc.6'),
      published('old-release'),
      published('5.3.2-rc.5'),
      published('v5.3.2-rc.06'),
      published('v5.3.2+build'),
      published('v5.3.2-rc.preview'),
    ]),
    'v5.3.2-rc.6'
  );
  assert.throws(() => select('5.3.2-rc.07', []), /SemVer/);
});

const cliPath = fileURLToPath(new URL('./release-notes-base.mjs', import.meta.url));

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'studio-release-notes-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  const hooks = path.join(root, 'hooks');
  mkdirSync(bin);
  mkdirSync(hooks);
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.name', 'Studio release tests');
  git('config', 'user.email', 'studio-tests@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgSign', 'false');
  git('config', 'core.hooksPath', hooks);
  git('commit', '--quiet', '--allow-empty', '-m', 'feat: initial release');
  writeFileSync(
    path.join(bin, 'gh'),
    `#!/usr/bin/env node
if (!process.argv.includes('--paginate') || !process.argv.includes('--slurp')) {
  process.stderr.write('The Releases query must include all pages.');
  process.exit(1);
}
if (process.env.STUDIO_RELEASE_NOTES_TEST_GH_ERROR) {
  process.stderr.write('GitHub is unavailable.');
  process.exit(1);
}
process.stdout.write(process.env.STUDIO_RELEASE_NOTES_TEST_PAGES);
`,
    { mode: 0o755 }
  );
  const run = (version, target, pages, extraEnv = {}) =>
    spawnSync(process.execPath, [cliPath, version, target], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        GITHUB_REPOSITORY: 'example/studio',
        STUDIO_RELEASE_NOTES_TEST_PAGES: typeof pages === 'string' ? pages : JSON.stringify(pages),
        STUDIO_RELEASE_NOTES_TEST_GH_ERROR: '',
        ...extraEnv,
      },
    });
  return { git, run };
}

test('CLI combines Releases pages and returns only the selected tag', (t) => {
  const { git, run } = fixture(t);
  git('tag', '--annotate', 'v5.3.1', '--message', 'stable');
  git('commit', '--quiet', '--allow-empty', '-m', 'fix: rc.5');
  git('tag', '--annotate', 'v5.3.2-rc.5', '--message', 'rc.5');
  git('commit', '--quiet', '--allow-empty', '-m', 'fix: rc.6');
  git('tag', '--annotate', 'v5.3.2-rc.6', '--message', 'rc.6');
  const result = run('5.3.2-rc.7', git('rev-parse', 'HEAD'), [
    [published('v5.3.2-rc.5'), published('v5.3.1')],
    [published('v5.3.2-rc.6')],
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'v5.3.2-rc.6\n');
});

test('CLI filters published tags using the actual target commit ancestry', (t) => {
  const { git, run } = fixture(t);
  git('tag', '--annotate', 'v5.3.1', '--message', 'stable');
  git('checkout', '--quiet', '-b', 'other-release');
  git('commit', '--quiet', '--allow-empty', '-m', 'fix: another branch');
  git('tag', '--annotate', 'v5.3.2-rc.6', '--message', 'unreachable rc.6');
  git('checkout', '--quiet', 'main');
  git('commit', '--quiet', '--allow-empty', '-m', 'fix: main branch');
  git('tag', '--annotate', 'v5.3.2-rc.5', '--message', 'rc.5');
  const result = run('5.3.2-rc.7', git('rev-parse', 'HEAD'), [[published('v5.3.2-rc.5'), published('v5.3.2-rc.6')]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'v5.3.2-rc.5\n');
});

test('CLI returns an empty baseline for the first release', (t) => {
  const { git, run } = fixture(t);
  const result = run('5.3.2-rc.1', git('rev-parse', 'HEAD'), [[]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '\n');
});

test('CLI reports GitHub and Git query failures instead of using full history', (t) => {
  const { git, run } = fixture(t);
  const target = git('rev-parse', 'HEAD');
  const githubFailure = run('5.3.2-rc.7', target, [[]], { STUDIO_RELEASE_NOTES_TEST_GH_ERROR: '1' });
  assert.equal(githubFailure.status, 1);
  assert.equal(githubFailure.stdout, '');
  assert.match(githubFailure.stderr, /Cannot list GitHub Releases: GitHub is unavailable/);
  const gitFailure = run('5.3.2-rc.7', 'f'.repeat(40), [[]]);
  assert.equal(gitFailure.status, 1);
  assert.equal(gitFailure.stdout, '');
  assert.match(gitFailure.stderr, /Cannot resolve the release commit/);
});

test('CLI rejects malformed API responses instead of using full history', (t) => {
  const { git, run } = fixture(t);
  const target = git('rev-parse', 'HEAD');
  for (const response of ['not JSON', '{"message":"not a Releases list"}', '[{"tag_name":"v5.3.2-rc.6"}]']) {
    const result = run('5.3.2-rc.7', target, response);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /not valid JSON|Expected paginated GitHub Releases arrays/);
  }
});
