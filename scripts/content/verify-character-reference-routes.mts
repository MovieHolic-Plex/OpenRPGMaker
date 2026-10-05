import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { QUERY_TOOLS } from '../../src/editor/tools/queryTools';
import { createBlankProject } from '../../src/project/defaults';
import { acceptSharedCharacterGraphics } from '../../src/project/sharedCharacterFaceResolver';
import { installSharedCharacters, ensureSharedCharacters, sharedCharacterSemantics } from '../../src/project/sharedCharacters';
import { CHARSET_SEMANTICS } from '../../src/assets/charsetSemantics';
import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS } from '../../src/assets/facesetFaceAssets';
import { SHARED_PORTRAIT_ASSETS } from '../../src/assets/sharedPortraitAssets';
import { CHARSET_BATTLERS } from '../../src/assets/charsetBattlers';
import { listDatabaseResourceOptions } from '../../src/editor/resourceOptions';
import { listEventResourceOptions } from '../../src/ai/eventResourceCatalog';
import { listMonsterResources } from '../../src/assets/monsterResourceCatalog';
import type { SharedContentSnapshot } from '../../src/project/sharedContentSchema';

// Actual headless tool calls; no model responses or user project writes.
const argv=process.argv.slice(2);
const option=(key:string)=>{const i=argv.indexOf(`--${key}`);if(i<0||!argv[i+1])throw Error(`--${key} required`);return resolve(argv[i+1]!);};
const out=option('out'), inventoryFile=option('inventory'), hostFile=option('host-catalog');
if(existsSync(join(out,'tool-census.json')))throw Error('Use a new output directory.');
mkdirSync(out,{recursive:true});
const inventory=JSON.parse(readFileSync(inventoryFile,'utf8'));
const db=new DatabaseSync(option('shared-db'),{readOnly:true});
let snapshot:SharedContentSnapshot;
try{
  db.exec('PRAGMA query_only=ON; BEGIN');
  const rows=db.prepare('SELECT id,revision,payload FROM content_libraries ORDER BY id').all() as {id:string;revision:string;payload:string}[];
  snapshot={revision:rows.map(row=>`${row.id}:${row.revision}`).join(','),libraries:Object.fromEntries(rows.map(row=>[row.id,JSON.parse(row.payload)]))};
}finally{db.close();}
installSharedCharacters(snapshot);
acceptSharedCharacterGraphics(JSON.parse(readFileSync(hostFile,'utf8')));
const project=createBlankProject();ensureSharedCharacters(project);
const call=async(name:string,args:Record<string,unknown>)=>(await QUERY_TOOLS.find(tool=>tool.name===name)!.run(project,args)).data as any;
const pages=async(kind:string)=>{const results:any[]=[];for(let offset=0;;){const page=await call('list_resources',{kind,query:'*',offset,limit:50});results.push(...page.matches);if(page.nextOffset==null)return results;offset=page.nextOffset;}};
const errors:string[]=[];
const check=(ok:boolean,reason:string)=>{if(!ok)errors.push(reason);};
const walking=[...CHARSET_SEMANTICS,...sharedCharacterSemantics()];
const walkProbes=[];
for(const row of walking){
  const id=`charset:${row.textureKey}:${row.characterIndex}`;
  const npc=await call('list_npc_graphics',{query:row.label});
  const resource=await call('list_resources',{kind:'charset',query:row.label,limit:50});
  const candidate=npc.matches.find((r:any)=>r.selectionId===id);
  const listed=resource.matches.find((r:any)=>r.id===id);
  const frame=25+(row.characterIndex%4)*3+Math.floor(row.characterIndex/4)*48;
  check(candidate?.label===row.label && candidate?.nativeGraphic.pattern===frame,`${id}: NPC name/frame omitted`);
  check(listed?.label===row.label && listed?.nativeGraphic.pattern===frame,`${id}: resource name/frame omitted`);
  walkProbes.push({id,label:row.label,expectedFrame:frame,npc:candidate??null,resource:listed??null});
}
const faces=await pages('faceset'),monsters=await pages('monster'),charsets=await pages('charset');
const expectedFaces=new Set([...AUTHORABLE_FACESET_FACE_ASSETS.map(r=>r.id),...SHARED_PORTRAIT_ASSETS.map(r=>r.id),'generated-face-actor1-bust','generated-face-actor1-full']);
check(faces.length===new Set(faces.map(r=>r.id)).size,'Duplicate face proposals');
check(faces.length===expectedFaces.size && faces.every(row=>expectedFaces.has(row.id)),'Face/portrait proposal coverage mismatch');
const promptIds=new Set(listEventResourceOptions('faceset',project).map(r=>r.id));
const pickerIds=new Set(listDatabaseResourceOptions('faceset',project).map(r=>r.id));
check([...expectedFaces].every(id=>promptIds.has(id)&&pickerIds.has(id)),'Prompt/picker omits known face/portrait');
for(const id of GENERATED_FACESET_FACE_IDS)check(!promptIds.has(id)&&!pickerIds.has(id)&&!faces.some(row=>row.id===id),`${id}: blank cell still offered`);
const monsterDetails=listMonsterResources(project),monsterProbes=[];
for(const row of monsterDetails){
  const result=await call('list_resources',{kind:'monster',query:row.resourceId,limit:50});
  const actual=result.matches.find((r:any)=>r.id===row.resourceId);
  check(actual?.label===row.name,`${row.resourceId}: monster label mismatch`);
  monsterProbes.push({id:row.resourceId,name:row.name,actual:actual??null});
}
const battlerPicker=listDatabaseResourceOptions('battleCharset',project);
for(const row of CHARSET_BATTLERS)check(battlerPicker.find(r=>r.id===row.resourceId)?.name===row.label,`${row.resourceId}: battler label mismatch`);
const projectChecks=[];
for(const entry of inventory.projects){
  const source=new DatabaseSync(entry.file,{readOnly:true});
  try{
    source.exec('PRAGMA query_only=ON; BEGIN');
    const row=source.prepare('SELECT current_json FROM project WHERE id=1').get() as {current_json:string};
    const existing=JSON.parse(row.current_json);
    const options=listDatabaseResourceOptions('faceset',existing);
    const blanks=options.filter(r=>GENERATED_FACESET_FACE_IDS.has(r.id)&&!existing.assets.uploaded[r.id]);
    check(blanks.length===0,'Existing project offers public blank cells');
    projectChecks.push({projectHash:createHash('sha256').update(entry.projectId).digest('hex'),blankProposals:blanks.length});
  }finally{source.close();}
}
const result={createdAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sharedRevision:snapshot.revision,
  modelCalls:0,projectWrites:0,counts:{walking:walking.length,faces:faces.length,faceCells:AUTHORABLE_FACESET_FACE_ASSETS.length,portraits:SHARED_PORTRAIT_ASSETS.length,blankCellsWithheld:GENERATED_FACESET_FACE_IDS.size,monsters:monsters.length,battlers:CHARSET_BATTLERS.length,existingProjects:projectChecks.length},
  errors,walkProbes,faces,monsters,charsets,monsterProbes,projectChecks};
writeFileSync(join(out,'tool-census.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({counts:result.counts,errors}));
if(errors.length)process.exitCode=1;
