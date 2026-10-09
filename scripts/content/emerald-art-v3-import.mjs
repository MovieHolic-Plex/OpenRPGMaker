// Calls the actual exported CLI import handler in one process. No pick/build.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const [harnessRoot,manifestFile,packed,sandbox,previousSeed]=process.argv.slice(2);
if(!previousSeed)throw Error('Usage: emerald-art-v3-import <harness-root> <manifest> <packed> <sandbox> <60species-seed>');
if(fs.existsSync(path.join(sandbox,'data/ledger.json')))throw Error('Use a fresh review sandbox');
const records=JSON.parse(fs.readFileSync(manifestFile)),seed=JSON.parse(fs.readFileSync(previousSeed));
const revision=Math.max(...records.map(r=>r.revision??2));
seed.style.maxColors=16;seed.style.reference='Original Emerald-era GBA pixels; logical body40/52/64, same grid/fitting per front/back pair';
for(const family of records)for(const id of family.species){const species=seed.species.find(s=>s.id===id);if(!species)throw Error('Missing '+id);species.design=family.prompt;}
if(seed.species.length!==60)throw Error('Expected60species');
fs.mkdirSync(path.join(sandbox,'data'),{recursive:true});fs.writeFileSync(path.join(sandbox,'data/seed.json'),JSON.stringify(seed,null,2));
process.env.MONSTER_HARNESS_SANDBOX=path.resolve(sandbox);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'emerald-cli-import-'));
const entry=path.resolve(harnessRoot,'src/harnesses/monster-collect-species/node/cli.ts');
const outfile=path.join(tmp,'cli.cjs');
await build({absWorkingDir:harnessRoot,entryPoints:[entry],outfile,bundle:true,format:'cjs',platform:'node',logLevel:'silent',define:{'import.meta.url':JSON.stringify(pathToFileURL(entry).href)}});
const cli=createRequire(import.meta.url)(outfile),imported=[];
for(const species of seed.species)for(const side of ['front','back']){
 const code=await cli.run(['import','--species',species.id,'--side',side,'--raw',path.resolve(packed,species.id+'-'+side+'-raw.png'),'--prompt',species.design,'--block','8']);
 if(code!==0)throw Error('Import failed '+species.id+' '+side);
 const runDir=path.join(sandbox,'runs',species.id,side),run=fs.readdirSync(runDir).sort().at(-1),record=JSON.parse(fs.readFileSync(path.join(runDir,run,'run.json'))),candidate=record.candidates[0];
 if(record.fixedBlock!==8||candidate?.block!==8||!candidate.sprite)throw Error('Reviewed grid option missing '+species.id+' '+side);
 // The CLI palette/orphan cleanup is intentionally authoritative. A second tidy
 // can change a few native colors; publish its final bytes for human review.
 const actual=fs.readFileSync(path.join(runDir,run,candidate.sprite)),draft=fs.readFileSync(path.join(packed,species.id+'-'+side+'.png'));
 if(candidate.issues.some(i=>i.level==='error'))throw Error('Candidate structural error '+species.id+' '+side);
 imported.push({id:species.id,name:species.name,side,run,candidate:1,draftBytesUnchanged:actual.equals(draft),...candidate});
}
const ledgerFile=path.join(sandbox,'data/ledger.json');if(fs.existsSync(ledgerFile)&&Object.keys(JSON.parse(fs.readFileSync(ledgerFile)).picks).length)throw Error('Human picks must remain empty');
fs.writeFileSync(path.join(sandbox,'import-receipt.json'),JSON.stringify({selection:'pending-human',revision,species:60,imported,failures:[],productionLedgerUntouched:true,actualCliEntry:entry,publishedPixels:'Use final CLI candidate PNGs, not pre-import drafts'},null,2));
fs.rmSync(tmp,{recursive:true,force:true});console.log(JSON.stringify({species:60,candidates:imported.length,selection:'pending-human',revision,actualCli:true,draftChanged:imported.filter(r=>!r.draftBytesUnchanged).length}));
