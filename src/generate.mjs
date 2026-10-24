import fs from 'node:fs';
import path from 'node:path';
import { createMatcher } from './glob.mjs';
import { dropLeadingTitle, extractMeta, stripInline, truncate } from './markdown.mjs';
import { estimateTokens } from './tokens.mjs';

/**
 * @typedef {{
 *   dir: string,
 *   baseUrl?: string,
 *   outputDir?: string,
 *   fullOutputDir?: string,
 *   title?: string,
 *   description?: string,
 *   include?: string[],
 *   exclude?: string[],
 *   optional?: string[],
 *   full?: boolean,
 *   maxTokens?: number,
 *   stripExt?: boolean,
 *   maxDescription?: number,
 * }} GenerateOptions
 *
 * @typedef {{
 *   path: string,
 *   title: string,
 *   description: string,
 *   url: string,
 *   section: string,
 *   optional: boolean,
 *   order: number,
 *   tokens: number,
 *   body: string,
 * }} DocEntry
 *
 * @typedef {{
 *   llmsTxt: string,
 *   llmsFull: string | null,
 *   title: string,
 *   summary: string,
 *   docs: Omit<DocEntry, 'body'>[],
 *   llmsTxtTokens: number,
 *   fullTokens: number,
 *   totalTokens: number,
 *   truncated: boolean,
 *   omitted: string[],
 * }} GenerateResult
 */

export const DEFAULT_INCLUDE = ['**/*.md', '**/*.mdx'];
export const DEFAULT_EXCLUDE = ['node_modules/', '**/.*/**', 'llms.txt', 'llms-full.txt'];
export const DEFAULT_OPTIONAL = [
  '**/CHANGELOG*', '**/CODE_OF_CONDUCT*', '**/CONTRIBUTING*', '**/SECURITY*', '**/LICENSE*', '**/README.*.md',
];
const OPTIONAL_SECTION = 'Optional';
const DEFAULT_SECTION = 'Docs';
const MIN_PARTIAL_TOKENS = 100;
const TRUNCATION_MARK = '<!-- llms-txt-gen: truncated to fit --max-tokens -->';

/**
 * @param {string} dir
 * @param {string} rel
 * @param {(p: string) => boolean} skipDir
 * @returns {string[]}
 */
function walk(dir, rel, skipDir) {
  /** @type {string[]} */
  const out = [];
  const entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!skipDir(`${child}/`)) { out.push(...walk(dir, child, skipDir)); }
    } else if (entry.isFile()) {
      out.push(child);
    }
  }
  return out;
}

/**
 * List files under `dir` (POSIX relative paths) selected by the globs.
 * @param {string} dir
 * @param {{ include?: string[], exclude?: string[] }} [filters]
 * @returns {string[]}
 */
export function scanFiles(dir, filters = {}) {
  const include = createMatcher(filters.include?.length ? filters.include : DEFAULT_INCLUDE);
  const excludeGlobs = [...DEFAULT_EXCLUDE, ...(filters.exclude ?? [])];
  const exclude = createMatcher(excludeGlobs);
  // Directories are pruned early only when a pattern names the directory itself.
  const skipDir = (/** @type {string} */ p) => exclude(p) || exclude(p.slice(0, -1));
  return walk(dir, '', skipDir).filter(file => include(file) && !exclude(file));
}

/**
 * @param {string} segment
 * @returns {string}
 */
function titleCase(segment) {
  return segment.replace(/[-_]+/g, ' ').trim().replace(/(^|\s)(\p{L})/gu, (_m, space, letter) => space + letter.toUpperCase());
}

/**
 * @param {string} file
 * @returns {string}
 */
function fallbackTitle(file) {
  const parts = file.split('/');
  const base = parts[parts.length - 1].replace(/\.(md|mdx)$/i, '');
  if (/^(index|readme)$/i.test(base) && parts.length > 1) { return titleCase(parts[parts.length - 2]); }
  return titleCase(base) || base;
}

/**
 * @param {string} file
 * @param {string} baseUrl
 * @param {boolean} stripExt
 * @returns {string}
 */
export function buildUrl(file, baseUrl, stripExt) {
  const rel = stripExt ? file.replace(/\.(md|mdx)$/i, '') : file;
  const encoded = rel.split('/').map(seg => encodeURIComponent(seg).replace(/[()]/g, c => (c === '(' ? '%28' : '%29'))).join('/');
  if (!baseUrl) { return encoded; }
  return `${baseUrl.replace(/\/+$/, '')}/${encoded}`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeLinkText(text) {
  return text.replace(/([[\]])/g, '\\$1');
}

/**
 * @param {string} dir
 * @returns {{ name: string, description: string }}
 */
function readPackageJson(dir) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return {
      name: typeof pkg.name === 'string' ? pkg.name : '',
      description: typeof pkg.description === 'string' ? pkg.description : '',
    };
  } catch {
    return { name: '', description: '' };
  }
}

/**
 * @param {string} dir
 * @returns {{ title: string, description: string }}
 */
function readRootReadme(dir) {
  for (const name of ['README.md', 'readme.md', 'README.mdx', 'index.md']) {
    const full = path.join(dir, name);
    if (fs.existsSync(full)) {
      const meta = extractMeta(fs.readFileSync(full, 'utf8'), '');
      return { title: meta.hasH1 || meta.data.title ? meta.title : '', description: meta.description };
    }
  }
  return { title: '', description: '' };
}

/**
 * @param {DocEntry} a
 * @param {DocEntry} b
 * @returns {number}
 */
function compareDocs(a, b) {
  if (a.order !== b.order) { return a.order - b.order; }
  const lead = (/** @type {DocEntry} */ d) => (/^(?:.*\/)?(readme|index)\.mdx?$/i.test(d.path) ? 0 : 1);
  if (lead(a) !== lead(b)) { return lead(a) - lead(b); }
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * Generate llms.txt (and optionally llms-full.txt) content from a directory.
 * @param {GenerateOptions} options
 * @returns {GenerateResult}
 */
export function generate(options) {
  const dir = path.resolve(options.dir);
  if (!fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Not a directory: ${options.dir}`);
  }
  const { maxTokens } = options;
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 1)) {
    throw new Error('maxTokens must be a positive integer');
  }
  const maxDescription = options.maxDescription ?? 160;
  const baseUrl = options.baseUrl ?? '';
  const stripExt = options.stripExt ?? false;
  const outputDir = path.resolve(options.outputDir ?? dir);
  const fullOutputDir = path.resolve(options.fullOutputDir ?? outputDir);
  const urlFor = (/** @type {string} */ file, /** @type {string} */ from) => buildUrl(
    baseUrl ? file : path.relative(from, path.join(dir, file)).split(path.sep).join('/'), baseUrl, stripExt,
  );
  const isOptional = createMatcher(options.optional ?? DEFAULT_OPTIONAL);

  /** @type {DocEntry[]} */
  const docs = [];
  for (const file of scanFiles(dir, options)) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    const meta = extractMeta(source, fallbackTitle(file));
    if (meta.data.draft === true) { continue; }
    const parts = file.split('/');
    const fmSection = typeof meta.data.section === 'string' ? meta.data.section.trim() : '';
    const optional = meta.data.optional === true || isOptional(file) || fmSection.toLowerCase() === 'optional';
    const section = optional ? OPTIONAL_SECTION : fmSection || (parts.length > 1 ? titleCase(parts[0]) : DEFAULT_SECTION);
    docs.push({
      path: file,
      title: meta.title,
      description: truncate(stripInline(meta.description), maxDescription),
      url: urlFor(file, outputDir),
      section,
      optional,
      order: typeof meta.data.order === 'number' ? meta.data.order : 1000,
      tokens: estimateTokens(meta.body),
      body: meta.body,
    });
  }
  docs.sort(compareDocs);

  const pkg = readPackageJson(dir);
  const readme = readRootReadme(dir);
  const title = stripInline(options.title || readme.title || pkg.name || path.basename(dir)) || 'Documentation';
  const summary = truncate(stripInline(options.description || pkg.description || readme.description), 400);

  /** @type {Map<string, DocEntry[]>} */
  const sections = new Map();
  for (const doc of docs) {
    const list = sections.get(doc.section) ?? [];
    list.push(doc);
    sections.set(doc.section, list);
  }
  const rank = (/** @type {string} */ name) => (name === OPTIONAL_SECTION ? 2 : name === DEFAULT_SECTION ? 0 : 1);
  const names = [...sections.keys()].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
  /** @type {DocEntry[]} */
  const ordered = names.flatMap(name => sections.get(name) ?? []);

  const lines = [`# ${title}`, ''];
  if (summary) { lines.push(`> ${summary}`, ''); }
  for (const name of names) {
    lines.push(`## ${name}`, '');
    for (const doc of sections.get(name) ?? []) {
      const note = doc.description ? `: ${doc.description}` : '';
      lines.push(`- [${escapeLinkText(doc.title)}](${doc.url})${note}`);
    }
    lines.push('');
  }
  const llmsTxt = `${lines.join('\n').replace(/\n+$/, '')}\n`;

  /** @type {string | null} */
  let llmsFull = null;
  let truncated = false;
  /** @type {string[]} */
  const omitted = [];
  if (options.full) {
    const fullDocs = ordered.map(doc => ({ ...doc, url: urlFor(doc.path, fullOutputDir) }));
    const built = buildFull(fullDocs, title, summary, maxTokens);
    llmsFull = built.text;
    truncated = built.truncated;
    omitted.push(...built.omitted);
  }

  return {
    llmsTxt,
    llmsFull,
    title,
    summary,
    docs: ordered.map(({ body: _body, ...rest }) => rest),
    llmsTxtTokens: estimateTokens(llmsTxt),
    fullTokens: llmsFull === null ? 0 : estimateTokens(llmsFull),
    totalTokens: ordered.reduce((sum, doc) => sum + doc.tokens, 0),
    truncated,
    omitted,
  };
}

/**
 * Concatenate documents in priority order, never exceeding the token budget.
 * Whole documents are kept while they fit; the first one that does not fit is
 * cut at a line boundary (if enough budget is left) and everything after it
 * is dropped, so Optional documents are the first to go.
 * @param {DocEntry[]} docs
 * @param {string} title
 * @param {string} summary
 * @param {number | undefined} maxTokens
 * @returns {{ text: string, truncated: boolean, omitted: string[] }}
 */
function buildFull(docs, title, summary, maxTokens) {
  const head = `# ${title}\n\n${summary ? `> ${summary}\n\n` : ''}`;
  let text = head;
  let used = estimateTokens(head);
  if (maxTokens !== undefined && used > maxTokens) {
    throw new Error(`maxTokens must be at least ${used} to fit the title and summary`);
  }
  /** @type {string[]} */
  const omitted = [];
  let truncated = false;
  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i];
    const block = `---\n\n# ${doc.title}\n\nSource: ${doc.url}\n\n${dropLeadingTitle(doc.body, doc.title).trim()}\n\n`;
    const cost = estimateTokens(block);
    if (maxTokens === undefined || used + cost <= maxTokens) {
      text += block;
      used += cost;
      continue;
    }
    truncated = true;
    const remaining = maxTokens - used - estimateTokens(TRUNCATION_MARK) - 2;
    const partial = remaining >= MIN_PARTIAL_TOKENS ? cutToBudget(block, remaining) : '';
    if (partial) {
      text += `${partial}\n\n${TRUNCATION_MARK}\n`;
    } else {
      omitted.push(doc.path);
    }
    for (const rest of docs.slice(i + 1)) { omitted.push(rest.path); }
    break;
  }
  return { text: text.replace(/\n+$/, '') + '\n', truncated, omitted };
}

/**
 * Longest prefix of whole lines whose estimate fits the budget.
 * @param {string} block
 * @param {number} budget
 * @returns {string}
 */
function cutToBudget(block, budget) {
  const lines = block.replace(/\n+$/, '').split('\n');
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(lines.slice(0, mid).join('\n')) <= budget) { low = mid; } else { high = mid - 1; }
  }
  // Keep at least the title/source header plus some content.
  return low > 4 ? lines.slice(0, low).join('\n') : '';
}
