// Register node:test cases in one process so coverage is aggregated.
import { after } from 'node:test';
import '../test/glob.test.mjs';
import '../test/frontmatter.test.mjs';
import '../test/markdown.test.mjs';
import '../test/generate.test.mjs';
import '../test/check.test.mjs';
import '../test/cli.test.mjs';
import '../test/examples.test.mjs';
import { cleanup } from '../test/helpers.mjs';

after(cleanup);
