// Import generated cells as candidates. NEVER calls pick/build or writes a live project.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [harnessRoot,manifestFile,packed,sandbox,canonical]=process.argv.slice(2);
if(!canonical)throw Error('Usage: import-candidates <harness-repo> <manifest> <packed> <sandbox> <canonical>');
const records=JSON.parse(fs.readFileSync(manifestFile,'utf8')),project=JSON.parse(fs.readFileSync(canonical,'utf8'));
const seed=JSON.parse(fs.readFileSync(path.join(harnessRoot,'harness-data/monster-collect-species/seed.json'),'utf8'));
seed.style.reference='Original 2004 GBA monster RPG pixel art, cohesive Emerald-like palette';
seed.species=[];
const durable=[];
fs.mkdirSync('assets/emerald-monster-v2/source',{recursive:true});
for(const record of records){
  const copy=path.join('assets/emerald-monster-v2/source','monster-'+record.id+'.png');fs.copyFileSync(record.path,copy);
  durable.push({...record,path:copy});
  for(const [index,id] of record.species.entries()){
    const species=project.database.monsterSpecies.find(s=>s.id==='mx_species_'+id);if(!species)throw Error(id+' missing');
    seed.species.push({id,name:species.name,types:species.types,stage:record.stages[index],design:record.prompt??'Leaf-eared rabbit forest evolution line; original imagegen sheet.',...(index>0&&record.stages[index]===index+1?{evolvesFrom:record.species[index-1]}:{})});
  }
}
if(seed.species.length!==60||new Set(seed.species.map(s=>s.id)).size!==60)throw Error('Expected exact60species');
fs.mkdirSync(path.join(sandbox,'data'),{recursive:true});
fs.writeFileSync(path.join(sandbox,'data/seed.json'),JSON.stringify(seed,null,2));
fs.writeFileSync('assets/emerald-monster-v2/monster-generation.json',JSON.stringify(durable,null,2));
const imported=[], failures=[];
for(const species of seed.species)for(const side of ['front','back']){
  const raw=path.join(packed,species.id+'-'+side+'-raw.png');
  try {
    const output=execFileSync('npm',['run','harness','--','monster-collect-species','import','--species',species.id,'--side',side,'--raw',raw,'--prompt',species.design],{cwd:harnessRoot,env:{...process.env,MONSTER_HARNESS_SANDBOX:sandbox},encoding:'utf8',maxBuffer:1024*1024});
    const dirs=fs.readdirSync(path.join(sandbox,'runs',species.id,side)).sort();
    const run=dirs.at(-1),record=JSON.parse(fs.readFileSync(path.join(sandbox,'runs',species.id,side,run,'run.json'),'utf8'));
    const candidate=record.candidates[0];if(!candidate?.sprite)throw Error('No valid candidate: '+output.slice(-400));
    imported.push({id:species.id,name:species.name,side,run,candidate:1,...candidate});
  }catch(error){failures.push({id:species.id,side,error:String(error).slice(-1500)});}
}
const ledgerFile=path.join(sandbox,'data/ledger.json');
const ledger=fs.existsSync(ledgerFile)?JSON.parse(fs.readFileSync(ledgerFile,'utf8')):{picks:{}};
if(Object.keys(ledger.picks).length)throw Error('Human selections must remain empty');
const receipt={selection:'pending-human',species:seed.species.length,imported,failures,productionLedgerUntouched:true};
fs.writeFileSync(path.join(sandbox,'import-receipt.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({species:60,candidates:imported.length,failures:failures.length,selection:'pending-human'}));
if(failures.length)process.exitCode=1;
