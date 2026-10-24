// Minimal front matter reader: flat `key: value` pairs only (no nesting, no anchors).

/**
 * @typedef {Record<string, string | number | boolean>} FrontMatter
 */

/**
 * @param {string} raw
 * @returns {string | number | boolean}
 */
function parseScalar(raw) {
  let value = raw.trim();
  let quote = '';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (quote === '"' && char === '\\') { i += 1; }
      else if (char === quote) {
        if (quote === "'" && value[i + 1] === "'") { i += 1; }
        else { quote = ''; }
      }
    } else if (i === 0 && (char === '"' || char === "'")) {
      quote = char;
    } else if (char === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
      value = value.slice(0, i).trimEnd();
      break;
    }
  }
  if (value.length >= 2 && (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  )) {
    return value.slice(1, -1);
  }
  if (value === 'true') { return true; }
  if (value === 'false') { return false; }
  if (/^-?\d+(\.\d+)?$/.test(value)) { return Number(value); }
  return value;
}

/**
 * Split a document into its front matter and body.
 * Only a block opened by `---` on the very first line counts.
 * @param {string} source
 * @returns {{ data: FrontMatter, body: string }}
 */
export function parseFrontMatter(source) {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) { return { data: {}, body: text }; }
  const end = text.indexOf('\n---', 3);
  if (end === -1) { return { data: {}, body: text }; }
  const after = text.slice(end + 4);
  if (after !== '' && !after.startsWith('\n')) { return { data: {}, body: text }; }
  /** @type {FrontMatter} */
  const data = {};
  for (const line of text.slice(4, end + 1).split('\n')) {
    const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (match && match[2] !== '' && !/^[|>][+-]?$/.test(match[2].trim())) {
      data[match[1].toLowerCase()] = parseScalar(match[2]);
    }
  }
  return { data, body: after.replace(/^\n/, '') };
}
