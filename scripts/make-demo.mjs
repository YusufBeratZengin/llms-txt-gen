// Render docs/demo.svg from the real output of `node examples/demo.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { demoOptions } from '../examples/demo.mjs';
import { generate } from '../src/index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const command = '$ node examples/demo.mjs';

/** @returns {string} */
export function renderDemo() {
  const output = generate(demoOptions).llmsTxt;
  const lines = [command, ...output.trimEnd().split('\n')];
  const escape = (/** @type {string} */ text) => text.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;',
  })[char] ?? char);
  const width = Math.max(760, ...lines.map(line => line.length * 8.5 + 64));
  const height = 100 + lines.length * 23;
  const rows = lines.map((line, index) => {
    const color = index === 0 ? '#a5b4fc'
      : line.startsWith('#') ? '#fbbf24'
        : line.startsWith('>') ? '#8b949e' : '#d1d5db';
    return `    <text x="32" y="${88 + index * 23}" fill="${color}">${escape(line)}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">llms-txt-gen output</title>
  <desc id="desc">Real output of node examples/demo.mjs: an llms.txt generated from a small sample documentation folder.</desc>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="16" fill="#0d1117" stroke="#30363d"/>
  <path d="M17 1h${width - 34}a16 16 0 0 1 16 16v33H1V17A16 16 0 0 1 17 1Z" fill="#161b22"/>
  <g>
    <circle cx="25" cy="25" r="6" fill="#ff5f57"/>
    <circle cx="45" cy="25" r="6" fill="#febc2e"/>
    <circle cx="65" cy="25" r="6" fill="#28c840"/>
  </g>
  <text x="${width / 2}" y="30" text-anchor="middle" fill="#8b949e" font-family="monospace" font-size="13">llms-txt-gen</text>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="14" xml:space="preserve">
${rows}
  </g>
</svg>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  fs.writeFileSync(path.join(root, 'docs/demo.svg'), renderDemo());
  console.log('Generated docs/demo.svg from real output.');
}
