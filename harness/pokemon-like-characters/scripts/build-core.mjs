import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build({absWorkingDir:root,entryPoints:[path.join(root,'core/entry.ts')],outfile:path.join(root,'lib/native.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',define:{'import.meta.dirname':'__dirname'},legalComments:'inline'});
