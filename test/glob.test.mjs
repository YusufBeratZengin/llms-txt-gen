import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatcher, globToRegExp } from '../src/glob.mjs';
import { estimateTokens } from '../src/tokens.mjs';

test('globToRegExp handles *, **, ? and braces', () => {
  const cases = [
    ['*.md', 'a.md', true], ['*.md', 'docs/a.md', false],
    ['**/*.md', 'a.md', true], ['**/*.md', 'a/b/c.md', true], ['**/*.md', 'a.txt', false],
    ['docs/**', 'docs/a/b.md', true], ['docs/**', 'other/a.md', false],
    ['a?.md', 'ab.md', true], ['a?.md', 'a/.md', false],
    ['**/*.{md,mdx}', 'x/y.mdx', true], ['**/*.{md,mdx}', 'x/y.txt', false],
    ['file[12].md', 'file2.md', true], ['file[12].md', 'file3.md', false],
    ['a+b.md', 'a+b.md', true], ['./docs/*.md', 'docs/a.md', true],
  ];
  for (const [glob, path, expected] of cases) {
    assert.equal(globToRegExp(String(glob)).test(String(path)), expected, `${glob} vs ${path}`);
  }
  assert.ok(globToRegExp('a[.md').test('a[.md'));
  assert.throws(() => globToRegExp('{a,b'), /Unbalanced/);
});

test('createMatcher follows gitignore-like rules', () => {
  const match = createMatcher(['node_modules/', 'CHANGELOG.md', 'docs/private/**']);
  assert.ok(match('node_modules/x/README.md'));
  assert.ok(match('pkg/node_modules/x.md'));
  assert.ok(match('sub/CHANGELOG.md'));
  assert.ok(match('docs/private/a.md'));
  assert.ok(!match('docs/public/a.md'));
  assert.ok(!match('notes.md'));
});

test('estimateTokens is monotonic and weights non-ASCII text higher', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.ok(estimateTokens('şğüöçı'.repeat(4)) > estimateTokens('abcdef'.repeat(4)));
  assert.ok(estimateTokens('a'.repeat(400)) > estimateTokens('a'.repeat(100)));
});
