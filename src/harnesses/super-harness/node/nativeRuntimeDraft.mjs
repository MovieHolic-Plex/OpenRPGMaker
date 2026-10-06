import { resolve } from 'node:path';
import { withTsModule } from '../../../../scripts/ontology-ts-loader.mjs';

const args = process.argv.slice(2);
const index = args.indexOf('--packet');
if (index < 0 || !args[index + 1]) throw new Error('Usage: --packet <new frozen packet directory>');
await withTsModule(resolve(import.meta.dirname, 'nativeRuntimeDraft.ts'), 'native-runtime-draft.mjs', async mod => {
  console.log(JSON.stringify(mod.writeNativeRuntimeDraft(resolve(args[index + 1])), null, 2));
});
