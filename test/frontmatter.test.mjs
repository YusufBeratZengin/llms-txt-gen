import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrontMatter } from '../src/frontmatter.mjs';

test('parses scalars, quotes, numbers and booleans', () => {
  const { data, body } = parseFrontMatter('---\ntitle: "Hello: World"\norder: 3\ndraft: false\nsection: \'API\'\nnote: plain # comment\n---\n# Body\n');
  assert.deepEqual(data, { title: 'Hello: World', order: 3, draft: false, section: 'API', note: 'plain' });
  assert.equal(body, '# Body\n');
});

test('handles CRLF and BOM', () => {
  const { data, body } = parseFrontMatter('﻿---\r\ntitle: A\r\n---\r\ntext');
  assert.equal(data.title, 'A');
  assert.equal(body, 'text');
});

test('ignores blocks that are not front matter', () => {
  for (const source of ['text\n---\ntitle: x\n---\n', '---\ntitle: x\n', '---\ntitle: x\n----\nmore']) {
    assert.deepEqual(parseFrontMatter(source).data, {});
    assert.equal(parseFrontMatter(source).body, source);
  }
});

test('skips block scalars and empty values', () => {
  const { data } = parseFrontMatter('---\ndescription: >\n  folded\ntitle:\nok: yes\n---\n');
  assert.deepEqual(data, { ok: 'yes' });
});

test('empty front matter block yields empty data', () => {
  assert.deepEqual(parseFrontMatter('---\n---\nhi').data, {});
});

test('comments are removed before scalar conversion, preserving quoted hashes', () => {
  const { data } = parseFrontMatter(`---
draft: true # unpublished
optional: false # required
order: 2 # priority
title: "API # reference" # comment
section: 'User # guide' # comment
note: "A \\"quoted # value\\"" # comment
---
`);
  assert.deepEqual(data, {
    draft: true, optional: false, order: 2,
    title: 'API # reference', section: 'User # guide', note: 'A \\"quoted # value\\"',
  });
});
