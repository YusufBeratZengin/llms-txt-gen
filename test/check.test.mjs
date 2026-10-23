import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check } from '../src/check.mjs';

const GOOD = [
  '# Name', '', '> Summary.', '', 'Some details.', '',
  '## Docs', '', '- [A](https://x.io/a.md): about a', '- [B](b.md)', '',
  '## Optional', '', '- [C](c.md): about c', '',
].join('\n');

/** @param {string} text */
const codes = text => {
  const r = check(text);
  return [r.errors.map(e => e.code), r.warnings.map(w => w.code)];
};

test('a well-formed file passes cleanly', () => {
  assert.deepEqual(check(GOOD), { ok: true, errors: [], warnings: [] });
  assert.equal(check(GOOD.replace(/\n/g, '\r\n')).ok, true);
});

test('errors for structure that breaks the layout', () => {
  assert.deepEqual(codes(''), [['empty'], []]);
  assert.deepEqual(codes('> only quote\n')[0], ['no-h1']);
  assert.deepEqual(codes('## Docs\n- [A](a)\n# Title\n')[0], ['no-h1']);
  assert.deepEqual(codes('```\ncode\n```\n# T\n')[0], ['no-h1']);
  assert.deepEqual(codes('# T\n\n> s\n\n## Docs\n\n- plain text item\n')[0], ['bad-item']);
  assert.deepEqual(codes('# T\n\n> s\n\n## Docs\n\n- [](a)\n- [x]()\n')[0], ['empty-link-text', 'empty-url']);
  assert.deepEqual(codes('# T\n\n> s\n\n## Docs\n\n- [x](a b)\n')[0], ['space-in-url']);
  assert.deepEqual(codes('# T\n\n> s\n\n## \n\n- [x](a)\n')[0], ['empty-h2']);
});

test('warnings for things the proposal leaves open', () => {
  const base = '# T\n\n> s\n\n';
  assert.deepEqual(codes('# T\n\n## Docs\n\n- [a](a)\n')[1], ['no-summary']);
  assert.deepEqual(codes('# T\n\nplain para\n\n## Docs\n\n- [a](a)\n')[1], ['no-summary']);
  assert.deepEqual(codes(`${base}## Docs\n\n- [a](a)\n\n# Two\n`)[1], ['multiple-h1']);
  assert.deepEqual(codes(`${base}## Docs\n`)[1], ['empty-section']);
  assert.deepEqual(codes(`${base}## Docs\n\n- [a](a)\n- [b](a)\n`)[1], ['duplicate-url']);
  assert.deepEqual(codes(`${base}## Docs\n\n- [a](a) trailing\n`)[1], ['notes-format']);
  assert.deepEqual(codes(`${base}## Docs\n\n- [a](a):\n`)[1], ['empty-notes']);
  assert.deepEqual(codes(`${base}## Docs\n\n### Sub\n\n- [a](a)\n`)[1], ['deep-heading']);
  assert.deepEqual(codes(`${base}## Docs\n\nstray\n\n- [a](a)\n`)[1], ['stray-text']);
  assert.deepEqual(codes(`${base}## optional\n\n- [a](a)\n`)[1], ['optional-case']);
  assert.deepEqual(codes(`${base}## Docs\n\n- [a](a)\n\n## Docs\n\n- [b](b)\n`)[1], ['duplicate-section']);
  assert.deepEqual(codes(`${base}## Optional\n\n- [a](a)\n\n## Docs\n\n- [b](b)\n`)[1], ['optional-last']);
});

test('code fences and indented continuations are ignored', () => {
  const text = '# T\n\n> s\n\n```\n## Not a heading\n- not [a](list)\n```\n\n## Docs\n\n- [a](a): note\n  continued line\n';
  assert.deepEqual(check(text), { ok: true, errors: [], warnings: [] });
});

test('reports line numbers', () => {
  const r = check('# T\n\n> s\n\n## Docs\n\n- bad\n');
  assert.equal(r.errors[0].line, 7);
});

test('very long titles warn', () => {
  assert.deepEqual(codes(`# ${'x'.repeat(126)}\n\n> s\n`)[1], ['long-title']);
});
