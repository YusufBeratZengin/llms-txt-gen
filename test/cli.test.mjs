import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { main } from '../bin/llms-txt-gen.mjs';
import { fixture, memoryIO } from './helpers.mjs';

const docs = () => fixture({
  'README.md': '# Proj\n\nSummary here.\n',
  'guide.md': '# Guide\n\nHow to.\n',
  'sub/more.md': '# More\n\nMore text.\n',
});

test('--help and --version', () => {
  const h = memoryIO('.');
  assert.equal(main(['--help'], h.io), 0);
  assert.match(h.out, /Usage:/);
  assert.equal(main(['check', '-h'], memoryIO('.').io), 0);
  const v = memoryIO('.');
  assert.equal(main(['--version'], v.io), 0);
  assert.match(v.out, /^\d+\.\d+\.\d+\n$/);
});

test('default command writes llms.txt into the directory', () => {
  const dir = docs();
  const run = memoryIO(dir);
  assert.equal(main([], run.io), 0);
  const text = fs.readFileSync(path.join(dir, 'llms.txt'), 'utf8');
  assert.ok(text.startsWith('# Proj\n'));
  assert.match(run.err, /Wrote .*llms\.txt: 3 document\(s\)/);
  // A second run must not pick up its own output.
  assert.equal(main(['generate'], memoryIO(dir).io), 0);
  assert.equal(fs.readFileSync(path.join(dir, 'llms.txt'), 'utf8'), text);
});

test('--stdout prints, writes nothing, and honours filters and --base-url', () => {
  const dir = docs();
  const run = memoryIO(dir);
  assert.equal(main(['--stdout', '--base-url', 'https://e.io', '--exclude', 'sub/', '--strip-ext', '--title', 'T', '--description', 'D'], run.io), 0);
  assert.ok(run.out.startsWith('# T\n\n> D\n'));
  assert.ok(run.out.includes('(https://e.io/guide)') && !run.out.includes('sub'));
  assert.ok(!fs.existsSync(path.join(dir, 'llms.txt')));
  const only = memoryIO(dir);
  main(['--stdout', '--include', 'sub/*.md', '--optional', 'none'], only.io);
  assert.ok(only.out.includes('More') && !only.out.includes('Guide'));
});

test('--full, --max-tokens and --out write the expected files', () => {
  const dir = docs();
  const out = path.join(dir, 'build', 'llms.txt');
  const run = memoryIO(dir);
  assert.equal(main(['--out', 'build/llms.txt', '--full'], run.io), 0);
  assert.ok(fs.existsSync(out) && fs.existsSync(path.join(dir, 'build', 'llms-full.txt')));
  assert.match(run.err, /llms-full\.txt: ~\d+ tokens/);

  const big = fixture({ 'a.md': '# A\n\nShort.\n', 'b.md': `# B\n\n${Array.from({ length: 200 }, (_, i) => `Row ${i} text text.`).join('\n')}\n` });
  const capped = memoryIO(big);
  assert.equal(main(['--max-tokens', '150', '--full-out', 'all.txt'], capped.io), 0);
  assert.match(capped.err, /Truncated to fit --max-tokens/);
  assert.ok(fs.existsSync(path.join(big, 'all.txt')));
  assert.ok(!fs.existsSync(path.join(big, 'llms-full.txt')));
});

test('usage errors exit with 2', () => {
  const dir = docs();
  for (const args of [['--max-tokens', 'abc'], ['--max-tokens', '0'], ['a', 'b'], ['--stdout', '--full'], ['--nope'], ['missing-dir']]) {
    const run = memoryIO(dir);
    assert.equal(main(args, run.io), 2, args.join(' '));
    assert.ok(run.err.length > 0);
  }
});

test('an empty directory still produces a title and a warning', () => {
  const dir = fixture({ 'x.txt': 'nothing' });
  const run = memoryIO(dir);
  assert.equal(main([], run.io), 0);
  assert.match(run.err, /no Markdown files matched/);
});

test('check validates files and reports exit codes', () => {
  const dir = docs();
  const good = memoryIO(dir);
  main([], good.io);
  const ok = memoryIO(dir);
  assert.equal(main(['check'], ok.io), 0);
  assert.match(ok.out, /OK: 0 error\(s\), 0 warning\(s\)/);

  fs.writeFileSync(path.join(dir, 'bad.txt'), '# T\n\n> s\n\n## Docs\n\n- [a](a) extra\n');
  const warn = memoryIO(dir);
  assert.equal(main(['check', 'bad.txt'], warn.io), 0);
  assert.match(warn.out, /bad\.txt:7  warning  notes-format/);
  assert.equal(main(['check', 'bad.txt', '--strict'], memoryIO(dir).io), 1);

  fs.writeFileSync(path.join(dir, 'worse.txt'), 'no title\n');
  const bad = memoryIO(dir);
  assert.equal(main(['check', 'worse.txt'], bad.io), 1);
  assert.match(bad.out, /error    no-h1/);
  assert.match(bad.out, /FAIL/);

  const missing = memoryIO(dir);
  assert.equal(main(['check', 'nope.txt'], missing.io), 2);
  assert.match(missing.err, /Cannot read/);
});
