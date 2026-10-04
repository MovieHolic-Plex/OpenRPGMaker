/** Bundles one allowed behavior smoke in /tmp, avoiding shared Vite caches. */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const tmp=await mkdtemp(join(tmpdir(),'jf-behavior-'));
try {
 const outfile=join(tmp,'probe.mjs');
 await build({entryPoints:[resolve('scripts/content/joseon-folklore/behavior/smoke.mts')],outfile,
  bundle:true,platform:'node',format:'esm',target:'node24',alias:{'@':resolve('src')},
  logLevel:'warning',loader:{'.png':'dataurl','.ogg':'dataurl','.woff2':'dataurl'}});
 const result=spawnSync(process.execPath,[outfile,...process.argv.slice(2)],{stdio:'inherit',cwd:process.cwd()});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
} finally {await rm(tmp,{recursive:true,force:true});}
