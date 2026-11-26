import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExternalStudioUrl } from '../src/external-url.mjs';

test('parseExternalStudioUrl returns null for an unset value', () => {
  assert.equal(parseExternalStudioUrl(undefined), null);
  assert.equal(parseExternalStudioUrl(''), null);
  assert.equal(parseExternalStudioUrl('   '), null);
});

test('parseExternalStudioUrl accepts http and https URLs', () => {
  assert.deepEqual(parseExternalStudioUrl('http://127.0.0.1:3000'), {
    url: 'http://127.0.0.1:3000/',
    origin: 'http://127.0.0.1:3000',
  });
  assert.deepEqual(parseExternalStudioUrl('https://studio.example.com/base/'), {
    url: 'https://studio.example.com/base/',
    origin: 'https://studio.example.com',
  });
});

test('parseExternalStudioUrl rejects malformed and non-http URLs', () => {
  assert.throws(() => parseExternalStudioUrl('not a url'), /not a valid URL/);
  assert.throws(() => parseExternalStudioUrl('file:///tmp/index.html'), /must use http or https/);
  assert.throws(() => parseExternalStudioUrl('ftp://example.com'), /must use http or https/);
});
