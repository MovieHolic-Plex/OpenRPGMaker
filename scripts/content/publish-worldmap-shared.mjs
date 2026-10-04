import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { withTsModule } from '../ontology-ts-loader.mjs';
// pngjs's bundled CommonJS helpers require Node builtins when the headless renderer loads.
globalThis.require = createRequire(import.meta.url);
// Current human choices and rendered hashes must match the baked source before DB publication.
const checked = spawnSync('python3', ['src/harnesses/worldmap-icons/bake.py', 'check'], { stdio: 'inherit' });
if (checked.status !== 0) process.exit(checked.status ?? 1);
await withTsModule('scripts/content/publish-worldmap-shared.mts', 'worldmap-shared.mjs', api => api.run(process.argv.slice(2)));
