#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { check } from '../src/check.mjs';
import { generate } from '../src/generate.mjs';

const HELP = `llms-txt-gen - generate and validate llms.txt files

Usage:
  llms-txt-gen [generate] [dir] [options]   Build llms.txt (default command)
  llms-txt-gen check [file] [options]       Validate an existing llms.txt

Generate options:
  -o, --out <file>          Output path (default: <dir>/llms.txt)
      --stdout              Print llms.txt instead of writing a file
      --full                Also write llms-full.txt next to llms.txt
      --full-out <file>     Path for llms-full.txt (implies --full)
      --max-tokens <n>      Cap llms-full.txt at about n tokens (estimate)
      --base-url <url>      Prefix for generated links
      --strip-ext           Drop .md/.mdx from link paths
      --title <text>        Project title (default: README H1, package name)
      --description <text>  Summary line (default: package.json, README)
      --include <glob>      Files to include (repeatable; default **/*.md, **/*.mdx)
      --exclude <glob>      Files to skip (repeatable)
      --optional <glob>     Files for the Optional section (repeatable;
                            replaces the default CHANGELOG/LICENSE/... set)

Check options:
      --strict              Treat warnings as errors

Common:
  -h, --help                Show this help
  -v, --version             Show the version
`;

/**
 * @typedef {{
 *   cwd: () => string,
 *   stdout: { write: (text: string) => unknown },
 *   stderr: { write: (text: string) => unknown },
 * }} IO
 */

/** @returns {string} */
function version() {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.version;
}

/**
 * @param {string[]} argv
 * @param {IO} io
 * @returns {number}
 */
function runCheck(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { strict: { type: 'boolean' } },
  });
  const file = path.resolve(io.cwd(), positionals[0] ?? 'llms.txt');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    io.stderr.write(`Cannot read ${positionals[0] ?? 'llms.txt'}\n`);
    return 2;
  }
  const name = positionals[0] ?? 'llms.txt';
  const result = check(text);
  for (const issue of result.errors) { io.stdout.write(`${name}:${issue.line}  error    ${issue.code}  ${issue.message}\n`); }
  for (const issue of result.warnings) { io.stdout.write(`${name}:${issue.line}  warning  ${issue.code}  ${issue.message}\n`); }
  const failed = result.errors.length > 0 || (values.strict === true && result.warnings.length > 0);
  io.stdout.write(`${failed ? 'FAIL' : 'OK'}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`);
  return failed ? 1 : 0;
}

/**
 * @param {string[]} argv
 * @param {IO} io
 * @returns {number}
 */
function runGenerate(argv, io) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      stdout: { type: 'boolean' },
      full: { type: 'boolean' },
      'full-out': { type: 'string' },
      'max-tokens': { type: 'string' },
      'base-url': { type: 'string' },
      'strip-ext': { type: 'boolean' },
      title: { type: 'string' },
      description: { type: 'string' },
      include: { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      optional: { type: 'string', multiple: true },
    },
  });
  if (positionals.length > 1) {
    io.stderr.write('Expected at most one directory argument.\n');
    return 2;
  }
  const dir = path.resolve(io.cwd(), positionals[0] ?? '.');
  let maxTokens;
  if (values['max-tokens'] !== undefined) {
    maxTokens = Number(values['max-tokens']);
    if (!Number.isInteger(maxTokens) || maxTokens < 1) {
      io.stderr.write('--max-tokens must be a positive integer.\n');
      return 2;
    }
  }
  const wantFull = values.full === true || values['full-out'] !== undefined || maxTokens !== undefined;
  if (values.stdout && wantFull) {
    io.stderr.write('--stdout cannot be combined with --full, --full-out or --max-tokens.\n');
    return 2;
  }
  const out = path.resolve(io.cwd(), values.out ?? path.join(dir, 'llms.txt'));
  const fullOut = path.resolve(io.cwd(), values['full-out'] ?? path.join(path.dirname(out), 'llms-full.txt'));
  // Never feed our own previous output back in.
  const exclude = [...(values.exclude ?? [])];
  for (const target of [out, fullOut]) {
    const rel = path.relative(dir, target).split(path.sep).join('/');
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) { exclude.push(rel); }
  }

  const result = generate({
    dir,
    baseUrl: values['base-url'],
    title: values.title,
    description: values.description,
    include: values.include,
    exclude,
    optional: values.optional,
    stripExt: values['strip-ext'],
    full: wantFull,
    maxTokens,
  });

  if (values.stdout) {
    io.stdout.write(result.llmsTxt);
    return 0;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, result.llmsTxt);
  io.stderr.write(`Wrote ${path.relative(io.cwd(), out) || out}: ${result.docs.length} document(s), ~${result.llmsTxtTokens} tokens\n`);
  if (result.llmsFull !== null) {
    fs.mkdirSync(path.dirname(fullOut), { recursive: true });
    fs.writeFileSync(fullOut, result.llmsFull);
    io.stderr.write(`Wrote ${path.relative(io.cwd(), fullOut) || fullOut}: ~${result.fullTokens} tokens (all documents: ~${result.totalTokens})\n`);
    if (result.truncated) {
      io.stderr.write(`Truncated to fit --max-tokens; ${result.omitted.length} document(s) omitted.\n`);
    }
  }
  if (result.docs.length === 0) {
    io.stderr.write('Warning: no Markdown files matched; the output has only a title.\n');
  }
  return 0;
}

/**
 * @param {string[]} argv
 * @param {Partial<IO>} [io]
 * @returns {number}
 */
export function main(argv, io = {}) {
  /** @type {IO} */
  const env = {
    cwd: io.cwd ?? (() => process.cwd()),
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
  };
  try {
    const [first, ...rest] = argv;
    if (first === '-h' || first === '--help' || argv.includes('-h') || argv.includes('--help')) {
      env.stdout.write(HELP);
      return 0;
    }
    if (first === '-v' || first === '--version') {
      env.stdout.write(`${version()}\n`);
      return 0;
    }
    if (first === 'check') { return runCheck(rest, env); }
    if (first === 'generate') { return runGenerate(rest, env); }
    return runGenerate(argv, env);
  } catch (error) {
    env.stderr.write(`llms-txt-gen: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
