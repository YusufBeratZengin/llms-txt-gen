import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = path.join(root, '.tmp-test');

/**
 * Create a throwaway fixture tree under the ignored .tmp-test directory.
 * @param {Record<string, string>} files
 * @returns {string}
 */
export function fixture(files) {
  fs.mkdirSync(scratch, { recursive: true });
  const dir = fs.mkdtempSync(path.join(scratch, 'fx-'));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

/** Remove everything created by fixture(). */
export function cleanup() {
  fs.rmSync(scratch, { recursive: true, force: true });
}

/**
 * In-memory IO for CLI tests.
 * @param {string} cwd
 */
export function memoryIO(cwd) {
  let out = '';
  let err = '';
  return {
    io: {
      cwd: () => cwd,
      stdout: { write: (/** @type {string} */ t) => { out += t; } },
      stderr: { write: (/** @type {string} */ t) => { err += t; } },
    },
    get out() { return out; },
    get err() { return err; },
  };
}
