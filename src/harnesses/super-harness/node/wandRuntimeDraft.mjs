import { resolve } from 'node:path';
import { withTsModule } from '../../../../scripts/ontology-ts-loader.mjs';
const args = process.argv.slice(2), index = args.indexOf('--packet');
if (index < 0 || !args[index + 1]) throw new Error('Usage: --packet <frozen wand packet directory>');
await withTsModule(resolve(import.meta.dirname, 'wandRuntimeDraft.ts'), 'wand-runtime-draft.mjs', async mod => {
  console.log(JSON.stringify(mod.writeWandRuntimeDraft(resolve(args[index + 1])), null, 2));
});
