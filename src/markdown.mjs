import { parseFrontMatter } from './frontmatter.mjs';

/**
 * @typedef {{
 *   title: string,
 *   description: string,
 *   body: string,
 *   data: import('./frontmatter.mjs').FrontMatter,
 *   hasH1: boolean,
 * }} DocMeta
 */

/**
 * Remove inline Markdown/HTML markup, leaving readable plain text.
 * @param {string} text
 * @returns {string}
 */
export function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<[^>\n]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cut at a word boundary, adding an ellipsis when shortened.
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function truncate(text, max) {
  if (text.length <= max) { return text; }
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

/**
 * Walk the body line by line, skipping fenced code, and return the first H1
 * and the first prose paragraph.
 * @param {string} body
 * @returns {{ h1: string, paragraph: string }}
 */
function scanBody(body) {
  const lines = body.split('\n');
  let fence = '';
  let h1 = '';
  let paragraph = '';
  /** @type {string[]} */
  let current = [];
  const flush = () => {
    if (!paragraph && current.length > 0) {
      // Badge rows and image-only lines carry no prose.
      const text = stripInline(current.join(' ').replace(/\[?!\[[^\]]*\]\([^)]*\)(\]\([^)]*\))?/g, ''));
      if (/[\p{L}\p{N}]/u.test(text)) { paragraph = text; }
    }
    current = [];
  };
  for (const line of lines) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) { fence = ''; }
      continue;
    }
    if (fenceMatch) { flush(); fence = fenceMatch[1]; continue; }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      if (heading[1] === '#' && !h1) { h1 = stripInline(heading[2]); }
      continue;
    }
    if (/^\s*$/.test(line)) { flush(); continue; }
    // Not prose: lists, quotes, tables, html comments, rules, indented code.
    if (/^\s*([-*+]|\d+[.)])\s/.test(line) || /^\s*>/.test(line) || /^\s*\|/.test(line) ||
        /^\s*<!--/.test(line) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(line) || /^\s{4,}\S/.test(line)) {
      flush();
      continue;
    }
    current.push(line.trim());
  }
  flush();
  return { h1, paragraph };
}

/**
 * Derive title, description and body from a Markdown document.
 * Front matter wins over the first H1 and first paragraph.
 * @param {string} source
 * @param {string} fallbackTitle
 * @returns {DocMeta}
 */
export function extractMeta(source, fallbackTitle) {
  const { data, body } = parseFrontMatter(source);
  const { h1, paragraph } = scanBody(body);
  const fmTitle = typeof data.title === 'string' ? data.title.trim() : '';
  const fmDesc = typeof data.description === 'string' ? data.description.trim() : '';
  return {
    title: fmTitle || h1 || fallbackTitle,
    description: fmDesc || paragraph,
    body,
    data,
    hasH1: h1 !== '',
  };
}

/**
 * Remove the first H1 from a body when it repeats the document title,
 * so llms-full.txt does not print the title twice.
 * @param {string} body
 * @param {string} title
 * @returns {string}
 */
export function dropLeadingTitle(body, title) {
  const lines = body.split('\n');
  const first = lines.findIndex(line => line.trim() !== '');
  if (first === -1) { return ''; }
  const match = /^#\s+(.*?)\s*#*\s*$/.exec(lines[first]);
  if (match && stripInline(match[1]) === title) {
    return lines.slice(first + 1).join('\n').replace(/^\s*\n/, '');
  }
  return body;
}
