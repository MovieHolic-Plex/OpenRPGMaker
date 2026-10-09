/** Focused CLI launcher: same stage implementation, without loading the editor/catalog. */
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir=import.meta.dirname,temp=mkdtempSync(join(tmpdir(),'pokemon-motion-cli-'));
try {
  const entry=join(temp,'entry.ts'),out=join(temp,'cli.cjs');
  writeFileSync(entry,'import {run} from '+JSON.stringify(join(dir,'cli.ts'))+'; run(process.argv.slice(2)).then(code=>process.exitCode=code);');
  await build({entryPoints:[entry],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent',define:{'import.meta.dirname':JSON.stringify(dir)}});
  const child=spawnSync(process.execPath,[out,...process.argv.slice(2)],{stdio:'inherit'});
  process.exitCode=child.status??1;
} finally { rmSync(temp,{recursive:true,force:true}); }
