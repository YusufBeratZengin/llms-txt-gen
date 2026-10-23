import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { check, generate } from '../src/index.mjs';
import { demoOptions } from '../examples/demo.mjs';
import { renderDemo } from '../scripts/make-demo.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (/** @type {string} */ file) => fs.readFileSync(`${root}${file}`, 'utf8').replace(/\r\n/g, '\n');

test('the example site generates a valid llms.txt', () => {
  const result = generate(demoOptions);
  assert.equal(check(result.llmsTxt).ok, true);
  assert.deepEqual(check(result.llmsTxt).warnings, []);
  assert.ok(!result.llmsTxt.includes('Internal plan'));
});

test('README transcripts and demo image match the real output', () => {
  const output = generate(demoOptions).llmsTxt;
  for (const file of ['README.md', 'README.tr.md']) {
    assert.ok(read(file).includes(output), `${file} contains the current demo output`);
  }
  assert.equal(read('docs/demo.svg'), renderDemo(), 'docs/demo.svg is stale: run npm run demo');
});

test('package metadata points at the right repository and has no stray paths', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.repository.url, 'git+https://github.com/YusufBeratZengin/llms-txt-gen.git');
  assert.equal(pkg.license, 'MIT');
  const forbidden = ['C:/Users', 'C:\\Users', '/home/'];
  for (const file of ['README.md', 'README.tr.md', 'CONTRIBUTING.md', 'docs/demo.svg']) {
    for (const needle of forbidden) { assert.ok(!read(file).includes(needle), `${file} has ${needle}`); }
  }
});
