// Structural validator for llms.txt files (llmstxt.org layout).

/**
 * @typedef {{ line: number, code: string, message: string }} Issue
 * @typedef {{ ok: boolean, errors: Issue[], warnings: Issue[] }} CheckResult
 */

const LINK = /^\[((?:\\.|[^\]\\])*)\]\(([^)]*)\)(.*)$/;

/**
 * Validate llms.txt text. Errors break the documented layout; warnings flag
 * things the proposal leaves open or recommends against.
 * @param {string} source
 * @returns {CheckResult}
 */
export function check(source) {
  /** @type {Issue[]} */
  const errors = [];
  /** @type {Issue[]} */
  const warnings = [];
  const err = (/** @type {number} */ line, /** @type {string} */ code, /** @type {string} */ message) => errors.push({ line, code, message });
  const warn = (/** @type {number} */ line, /** @type {string} */ code, /** @type {string} */ message) => warnings.push({ line, code, message });

  const text = source.replace(/^﻿/, '');
  if (text.trim() === '') {
    err(1, 'empty', 'File is empty; an llms.txt needs at least an H1 title.');
    return { ok: false, errors, warnings };
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  let fence = '';
  let h1Count = 0;
  let sectionName = '';
  let sectionStart = 0;
  let sectionItems = 0;
  let sawFirstContent = false;
  let expectSummary = false;
  let seenH2 = false;
  /** @type {string[]} */
  const sectionNames = [];
  const urls = new Map();

  const closeSection = () => {
    if (sectionName && sectionItems === 0) {
      warn(sectionStart, 'empty-section', `Section "${sectionName}" has no list items.`);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) { fence = ''; }
      continue;
    }
    if (fenceMatch) { fence = fenceMatch[1]; if (!sawFirstContent) { sawFirstContent = true; err(lineNo, 'no-h1', 'The first element must be an H1 title ("# Name").'); } continue; }
    if (line.trim() === '') { continue; }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (!sawFirstContent) {
      sawFirstContent = true;
      if (!heading || heading[1] !== '#') {
        err(lineNo, 'no-h1', 'The first element must be an H1 title ("# Name").');
      }
    }

    if (heading) {
      if (expectSummary) {
        warn(lineNo, 'no-summary', 'Expected a "> summary" blockquote directly after the H1.');
        expectSummary = false;
      }
      const level = heading[1].length;
      const name = heading[2].trim();
      if (level === 1) {
        h1Count += 1;
        if (name === '') { err(lineNo, 'empty-h1', 'The H1 title is empty.'); }
        if (name.length > 125) { warn(lineNo, 'long-title', 'The H1 title is longer than 125 characters.'); }
        if (h1Count > 1) { warn(lineNo, 'multiple-h1', 'More than one H1; the proposal describes exactly one.'); }
        expectSummary = h1Count === 1 && name !== '';
      } else if (level === 2) {
        closeSection();
        seenH2 = true;
        sectionName = name;
        sectionStart = lineNo;
        sectionItems = 0;
        if (name === '') { err(lineNo, 'empty-h2', 'A section heading is empty.'); }
        if (name.toLowerCase() === 'optional' && name !== 'Optional') {
          warn(lineNo, 'optional-case', 'The special section is spelled "Optional" (capital O).');
        }
        if (sectionNames.includes(name)) { warn(lineNo, 'duplicate-section', `Section "${name}" appears more than once.`); }
        sectionNames.push(name);
      } else {
        if (seenH2) { warn(lineNo, 'deep-heading', 'Headings below H2 inside the file lists are not part of the proposal.'); }
      }
      continue;
    }

    if (!seenH2) {
      if (expectSummary && !line.startsWith('>')) {
        warn(lineNo, 'no-summary', 'Expected a "> summary" blockquote directly after the H1.');
      }
      expectSummary = false;
      continue;
    }
    if (/^\s+\S/.test(line)) { continue; } // continuation of a list item
    const item = /^[-*+]\s+(.*)$/.exec(line);
    if (!item) {
      warn(lineNo, 'stray-text', 'Text inside a section that is not a list item.');
      continue;
    }
    sectionItems += 1;
    const link = LINK.exec(item[1]);
    if (!link) {
      err(lineNo, 'bad-item', 'List items in a section must start with a link: "- [title](url): notes".');
      continue;
    }
    const [, label, target, rest] = link;
    const url = target.trim().split(/\s+/)[0] ?? '';
    if (label.trim() === '') { err(lineNo, 'empty-link-text', 'Link text is empty.'); }
    if (url === '') { err(lineNo, 'empty-url', 'Link URL is empty.'); }
    if (/\s/.test(target.trim()) && !/^\S+\s+"[^"]*"$/.test(target.trim())) {
      err(lineNo, 'space-in-url', 'URL contains whitespace; percent-encode it.');
    }
    if (url !== '' && urls.has(url)) {
      warn(lineNo, 'duplicate-url', `URL already listed on line ${urls.get(url)}.`);
    } else if (url !== '') {
      urls.set(url, lineNo);
    }
    if (rest.trim() !== '' && !rest.startsWith(':')) {
      warn(lineNo, 'notes-format', 'Notes after the link should follow a colon: "[title](url): notes".');
    } else if (rest.startsWith(':') && rest.slice(1).trim() === '') {
      warn(lineNo, 'empty-notes', 'Colon with no notes after the link.');
    }
  }
  closeSection();

  if (h1Count === 0 && !errors.some(e => e.code === 'no-h1')) {
    err(1, 'no-h1', 'Missing H1 title.');
  }
  const optionalIndex = sectionNames.indexOf('Optional');
  if (optionalIndex !== -1 && optionalIndex !== sectionNames.length - 1) {
    warn(1, 'optional-last', 'The "Optional" section is conventionally the last one.');
  }
  return { ok: errors.length === 0, errors, warnings };
}
