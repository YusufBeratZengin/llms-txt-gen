import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check } from '../src/check.mjs';
import { buildUrl, generate, scanFiles } from '../src/generate.mjs';
import { estimateTokens } from '../src/tokens.mjs';
import { fixture } from './helpers.mjs';

const tree = () => fixture({
  'README.md': '# Proj\n\nA project that does things.\n',
  'package.json': JSON.stringify({ name: 'proj-pkg', description: 'Package description' }),
  'docs/b-second.md': '# Second\n\nSecond doc.\n',
  'docs/a-first.md': '---\ntitle: First\norder: 1\n---\nFirst doc body.\n',
  'guides/intro.md': '# Intro\n\nIntro text.\n',
  'guides/hidden.md': '---\ndraft: true\n---\n# Hidden\n',
  'CHANGELOG.md': '# Changelog\n\nStuff changed.\n',
  'README.tr.md': '# Proje\n\nTürkçe.\n',
  'notes/my file (v2).md': '# Odd name\n\nHas spaces and parens.\n',
  'node_modules/dep/README.md': '# Dep\n',
  '.github/PULL_REQUEST_TEMPLATE.md': '# PR\n',
  'src/code.js': 'ignored',
  'llms.txt': '# Old output\n',
});

test('scanFiles honours defaults, include and exclude', () => {
  const dir = tree();
  const all = scanFiles(dir);
  assert.ok(all.includes('README.md') && all.includes('docs/a-first.md'));
  assert.ok(!all.some(f => f.startsWith('node_modules') || f.startsWith('.github') || f === 'llms.txt' || f.endsWith('.js')));
  assert.deepEqual(scanFiles(dir, { include: ['docs/*.md'] }), ['docs/a-first.md', 'docs/b-second.md']);
  assert.ok(!scanFiles(dir, { exclude: ['docs/', 'CHANGELOG.md'] }).some(f => f.startsWith('docs') || f === 'CHANGELOG.md'));
});

test('generate builds a valid llms.txt with sections, order and optional', () => {
  const result = generate({ dir: tree(), baseUrl: 'https://example.com/base/' });
  const lines = result.llmsTxt.split('\n');
  assert.equal(lines[0], '# Proj');
  assert.equal(lines[2], '> Package description');
  const headings = lines.filter(l => l.startsWith('## '));
  assert.deepEqual(headings, ['## Docs', '## Guides', '## Notes', '## Optional']);
  assert.ok(result.llmsTxt.includes('- [First](https://example.com/base/docs/a-first.md): First doc body.'));
  assert.ok(result.llmsTxt.indexOf('a-first') < result.llmsTxt.indexOf('b-second'));
  assert.ok(result.llmsTxt.indexOf('[Proj]') < result.llmsTxt.indexOf('[Second]'), 'README leads its section');
  assert.ok(!result.llmsTxt.includes('Hidden'));
  assert.ok(!result.llmsTxt.includes('Old output'));
  const optional = result.llmsTxt.slice(result.llmsTxt.indexOf('## Optional'));
  assert.ok(optional.includes('CHANGELOG.md') && optional.includes('README.tr.md'));
  assert.ok(result.llmsTxt.includes('notes/my%20file%20%28v2%29.md'));
  assert.deepEqual(check(result.llmsTxt), { ok: true, errors: [], warnings: [] });
  assert.equal(result.llmsFull, null);
});

test('title and description fall back through options, README and package.json', () => {
  const none = fixture({ 'a.md': '# A\n\nAlpha.\n' });
  const r = generate({ dir: none });
  assert.match(r.title, /^fx-/);
  assert.equal(r.summary, '');
  assert.ok(!r.llmsTxt.includes('\n> '));
  const o = generate({ dir: tree(), title: '**Custom** [Title]', description: 'Custom `desc`' });
  assert.equal(o.title, 'Custom [Title]');
  assert.equal(o.summary, 'Custom desc');
  const readmeOnly = generate({ dir: fixture({ 'README.md': '# From Readme\n\nReadme summary.\n' }) });
  assert.deepEqual([readmeOnly.title, readmeOnly.summary], ['From Readme', 'Readme summary.']);
});

test('front matter section/optional and custom optional globs', () => {
  const dir = fixture({
    'a.md': '---\nsection: Reference\n---\n# A\n\nA.\n',
    'b.md': '---\noptional: true\n---\n# B\n\nB.\n',
    'c.md': '---\nsection: optional\n---\n# C\n\nC.\n',
    'CHANGELOG.md': '# Log\n\nL.\n',
  });
  const r = generate({ dir, optional: ['b.md'] });
  assert.deepEqual(r.docs.map(d => [d.title, d.section]), [
    ['Log', 'Docs'], ['A', 'Reference'], ['B', 'Optional'], ['C', 'Optional'],
  ]);
});

test('fallback titles come from file or parent directory names', () => {
  const dir = fixture({ 'my-guide.md': 'text\n', 'sub-dir/index.md': 'text\n', 'sub-dir/other.md': '[l](x)\n' });
  const titles = generate({ dir }).docs.map(d => d.title).sort();
  assert.deepEqual(titles, ['My Guide', 'Other', 'Sub Dir']);
});

test('stripExt and buildUrl', () => {
  assert.equal(buildUrl('a/b c.md', 'https://x.io/', true), 'https://x.io/a/b%20c');
  assert.equal(buildUrl('a.mdx', '', false), 'a.mdx');
  assert.equal(buildUrl('é.md', 'https://x.io', false), 'https://x.io/%C3%A9.md');
});

test('long descriptions are shortened', () => {
  const dir = fixture({ 'a.md': `# A\n\n${'word '.repeat(100)}\n` });
  const [doc] = generate({ dir, maxDescription: 40 }).docs;
  assert.ok(doc.description.length <= 40 && doc.description.endsWith('…'));
});

test('llms-full concatenates all docs with sources and no duplicated titles', () => {
  const r = generate({ dir: tree(), full: true, baseUrl: 'https://example.com' });
  assert.ok(r.llmsFull);
  const full = r.llmsFull ?? '';
  assert.ok(full.startsWith('# Proj\n\n> Package description\n'));
  assert.ok(full.includes('Source: https://example.com/docs/a-first.md'));
  assert.equal(full.split('# Second').length - 1, 1);
  assert.ok(full.includes('Second doc.'));
  assert.ok(!full.includes('title: First'), 'front matter is stripped');
  assert.ok(full.indexOf('Stuff changed') > full.indexOf('Intro text'), 'Optional docs come last');
  assert.equal(r.truncated, false);
  assert.equal(r.fullTokens, estimateTokens(full));
});

test('maxTokens keeps the budget, truncates the overflowing doc and drops the rest', () => {
  const big = Array.from({ length: 80 }, (_, i) => `Line ${i} of the long document with some words.`).join('\n');
  const dir = fixture({
    'a.md': `# A\n\nAlpha short.\n`,
    'b.md': `# B\n\n${big}\n`,
    'c.md': '# C\n\nGamma.\n',
    'CHANGELOG.md': '# Log\n\nLog.\n',
  });
  const full = generate({ dir, full: true });
  const budget = 400;
  assert.ok(full.fullTokens > budget);
  const r = generate({ dir, full: true, maxTokens: budget });
  assert.ok(r.truncated);
  assert.ok(r.fullTokens <= budget, `${r.fullTokens} <= ${budget}`);
  assert.ok((r.llmsFull ?? '').includes('Alpha short.'));
  assert.ok((r.llmsFull ?? '').includes('truncated to fit'));
  assert.ok(!(r.llmsFull ?? '').includes('Gamma.'));
  assert.deepEqual(r.omitted, ['c.md', 'CHANGELOG.md']);
  assert.ok(r.llmsTxt.includes('[C]'), 'llms.txt still lists every doc');
});

test('a tiny remaining budget omits the overflowing doc instead of cutting it', () => {
  const dir = fixture({ 'a.md': '# A\n\nShort.\n', 'b.md': `# B\n\n${'x '.repeat(500)}\n` });
  const head = generate({ dir, full: true, maxTokens: 1000 });
  const budget = estimateTokens((head.llmsFull ?? '').slice(0, (head.llmsFull ?? '').indexOf('# B'))) + 40;
  const r = generate({ dir, full: true, maxTokens: budget });
  assert.ok(r.truncated && r.omitted.includes('b.md'));
  assert.ok(!(r.llmsFull ?? '').includes('truncated to fit'));
});

test('invalid inputs are rejected', () => {
  assert.throws(() => generate({ dir: 'definitely/not/here' }), /Not a directory/);
  assert.throws(() => generate({ dir: tree(), maxTokens: 0 }), /positive integer/);
  assert.throws(() => generate({ dir: tree(), maxTokens: 1.5 }), /positive integer/);
});

test('output is deterministic', () => {
  const dir = tree();
  assert.equal(generate({ dir, full: true }).llmsFull, generate({ dir, full: true }).llmsFull);
});
