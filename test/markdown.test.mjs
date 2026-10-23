import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropLeadingTitle, extractMeta, stripInline, truncate } from '../src/markdown.mjs';

test('stripInline removes markup', () => {
  assert.equal(stripInline('See **bold**, _it_, `code` and [a link](http://x.y) ![img](a.png) <b>tag</b>'), 'See bold, it, code and a link img tag');
  assert.equal(stripInline('a \\* b   c'), 'a * b c');
  assert.equal(stripInline('[ref][1] text'), 'ref text');
});

test('truncate cuts on word boundaries', () => {
  assert.equal(truncate('short', 20), 'short');
  const cut = truncate('alpha beta gamma delta epsilon', 18);
  assert.ok(cut.length <= 18 && cut.endsWith('…') && !cut.includes('gamm…'));
  assert.equal(truncate('x'.repeat(30), 10), `${'x'.repeat(9)}…`);
});

test('extractMeta prefers front matter, then H1 and first paragraph', () => {
  const plain = extractMeta('# Guide\n\nThis is the **intro**\nspanning lines.\n\nSecond.\n', 'fallback');
  assert.deepEqual([plain.title, plain.description, plain.hasH1], ['Guide', 'This is the intro spanning lines.', true]);

  const fm = extractMeta('---\ntitle: FM Title\ndescription: FM desc\n---\n# Other\n\nPara\n', 'fallback');
  assert.deepEqual([fm.title, fm.description], ['FM Title', 'FM desc']);

  const bare = extractMeta('Just text without heading.\n', 'fallback');
  assert.deepEqual([bare.title, bare.description, bare.hasH1], ['fallback', 'Just text without heading.', false]);
});

test('extractMeta skips code fences, lists, quotes, tables, badges and rules', () => {
  const source = [
    '# T', '', '[![CI](https://x/ci.svg)](https://x) ![b](https://x/b.svg)', '',
    '```', '# not a heading', 'not prose', '```', '', '- item', '> quote', '| a | b |', '---', '    indented code', '',
    '<!-- comment -->', '', '~~~js', 'x', '~~~', '', 'Real paragraph here.', '',
  ].join('\n');
  const meta = extractMeta(source, 'f');
  assert.equal(meta.title, 'T');
  assert.equal(meta.description, 'Real paragraph here.');
});

test('extractMeta ignores a fenced H1 and handles closing hashes', () => {
  assert.equal(extractMeta('```\n# Fake\n```\n\n# Real ##\n', 'f').title, 'Real');
  assert.equal(extractMeta('', 'f').description, '');
});

test('dropLeadingTitle removes only a duplicated first H1', () => {
  assert.equal(dropLeadingTitle('# Guide\n\nBody\n', 'Guide'), 'Body\n');
  assert.equal(dropLeadingTitle('# Other\n\nBody\n', 'Guide'), '# Other\n\nBody\n');
  assert.equal(dropLeadingTitle('\n\n', 'Guide'), '');
});
