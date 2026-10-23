// Small glob dialect: `*`, `**`, `?`, `{a,b}` and `[abc]` over POSIX-style paths.

/**
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  const pattern = glob.replace(/\\/g, '/').replace(/^\.\//, '');
  let out = '';
  let braces = 0;
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if (char === '{') {
      braces += 1;
      out += '(?:';
    } else if (char === '}' && braces > 0) {
      braces -= 1;
      out += ')';
    } else if (char === ',' && braces > 0) {
      out += '|';
    } else if (char === '[') {
      const close = pattern.indexOf(']', i + 2);
      if (close === -1) {
        out += '\\[';
      } else {
        out += `[${pattern.slice(i + 1, close).replace(/\\/g, '\\\\')}]`;
        i = close;
      }
    } else {
      out += char.replace(/[.+^$|()\\\]}]/g, '\\$&');
    }
  }
  if (braces > 0) { throw new Error(`Unbalanced "{" in glob: ${glob}`); }
  return new RegExp(`^${out}$`);
}

/**
 * Build a matcher. A pattern without "/" matches the file name at any depth,
 * like gitignore; a trailing "/" means "everything under that directory".
 * @param {string[]} globs
 * @returns {(path: string) => boolean}
 */
export function createMatcher(globs) {
  const regexes = globs.map(glob => {
    let g = glob.replace(/\\/g, '/');
    const dirOnly = g.endsWith('/');
    if (dirOnly) { g = g.slice(0, -1); }
    if (!g.includes('/')) { g = `**/${g}`; }
    return globToRegExp(dirOnly ? `${g}/**` : g);
  });
  return path => regexes.some(re => re.test(path));
}
