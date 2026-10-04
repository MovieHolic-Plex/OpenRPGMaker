/** Lightweight executable; no Vitest, full typecheck, app server or shared gates. */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=import.meta.dirname,out=join(mkdtempSync(join(tmpdir(),'pokemon-motion-executable-')),'verify.mjs');
const cjs=out.replace(/\.mjs$/,'.cjs');
await build({entryPoints:[join(dir,process.argv.includes('--references')?'verifyReferences.ts':process.argv.includes('--raster')?'verifyRaster.ts':'verify.ts')],outfile:cjs,bundle:true,platform:'node',format:'cjs',define:{'import.meta.dirname':JSON.stringify(dir)}});
const child=spawnSync(process.execPath,[cjs,...process.argv.slice(2)],{stdio:'inherit'});process.exitCode=child.status??1;
