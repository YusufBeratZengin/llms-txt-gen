// Run: node examples/demo.mjs
// Generates llms.txt for the sample docs folder in examples/site and prints it.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate } from '../src/index.mjs';

export const demoOptions = {
  dir: fileURLToPath(new URL('./site/', import.meta.url)),
  baseUrl: 'https://docs.example.com',
  stripExt: true,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(generate(demoOptions).llmsTxt);
}
