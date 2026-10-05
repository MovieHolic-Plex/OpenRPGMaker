// Read-only tool probe against an independently reviewed, frozen pixel census.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { installSharedCharacters, ensureSharedCharacters } from '../../src/project/sharedCharacters';
import { createBlankProject } from '../../src/project/defaults';
import { QUERY_TOOLS } from '../../src/editor/tools/queryTools';
import { firstSceneObjectCatalog } from '../../src/ai/piAgent/firstScene';
import reviewed from '../../src/assets/sharedCharacterGraphics.json';
import type { SharedContentSnapshot } from '../../src/project/sharedContentSchema';

const args=process.argv.slice(2);
const option=(name:string)=>{const index=args.indexOf(`--${name}`);if(index<0||!args[index+1])throw Error(`--${name} required`);return resolve(args[index+1]!);};
const auditPath=option('audit'), sharedPath=option('shared-db'), out=option('out');
if(existsSync(out))throw Error('Preserve the existing proof; choose a new --out file.');
const audit=JSON.parse(readFileSync(auditPath,'utf8'));
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const db=new DatabaseSync(sharedPath,{readOnly:true});
let snapshot:SharedContentSnapshot;
try{
  db.exec('PRAGMA query_only=ON; BEGIN');
  const rows=db.prepare("SELECT id,revision,payload FROM content_libraries WHERE json_extract(payload,'$.characters') IS NOT NULL ORDER BY id").all() as {id:string;revision:string;payload:string}[];
  snapshot={revision:rows.map(row=>`${row.id}:${row.revision}`).join(','),libraries:Object.fromEntries(rows.map(row=>[row.id,JSON.parse(row.payload)]))};
}finally{db.close();}
if(snapshot.revision!==audit.sharedRevision)throw Error('The public library does not match the visual census.');
installSharedCharacters(snapshot);
const project=createBlankProject(); ensureSharedCharacters(project);
const call=async(name:string,args:Record<string,unknown>)=>{
  const result=await QUERY_TOOLS.find(tool=>tool.name===name)!.run(project,args);
  return result.data as {matches:any[];nextOffset?:number|null;total?:number};
};
const all=async(kind:string,query:string)=>{
  const matches:any[]=[];let offset=0;
  for(;;){const page=await call('list_resources',{kind,query,offset,limit:50});matches.push(...page.matches);if(page.nextOffset==null)return matches;if(page.nextOffset<=offset)throw Error('Nonadvancing pagination');offset=page.nextOffset;}
};
const failures:string[]=[];
const rows=[];
for(const cell of audit.cells.filter((cell:any)=>cell.after)){
  const expected=cell.after,id=`charset:${expected.textureKey}:${expected.characterIndex}`;
  const npc=(await call('list_npc_graphics',{query:expected.label})).matches.find(row=>row.selectionId===id);
  const resource=(await all('charset',expected.label)).find(row=>row.id===id);
  // Project labels add their own name as a tag when overriding a catalog row.
  // The public canonical traits must otherwise remain identical to the census.
  const expectedTags=project.charsetLabels?.some(row=>row.textureKey===expected.textureKey&&row.characterIndex===expected.characterIndex)
    ? [expected.label,...expected.tags.filter((tag:string)=>tag!==expected.label)] : expected.tags;
  const index=expected.characterIndex,frame=25+index%4*3+Math.floor(index/4)*48;
  const checks={npcFound:!!npc,resourceFound:!!resource,npcLabel:npc?.label===expected.label,
    resourceLabel:resource?.label===expected.label,npcGender:npc?.gender===expected.gender,npcAge:npc?.age===expected.age,
    npcSlot:npc?.textureKey===expected.textureKey&&npc?.characterIndex===expected.characterIndex,
    npcAppearance:npc?.appearance===expected.appearance,
    resourceAppearance:resource?.description===expected.appearance.slice(0,240),
    npcTags:JSON.stringify(npc?.tags)===JSON.stringify(expectedTags),resourceTags:JSON.stringify(resource?.tags)===JSON.stringify(expectedTags),
    npcSprite:npc?.nativeGraphic.sprite.id===expected.textureKey&&npc?.nativeGraphic.sprite.type===(expected.spriteType??'bundled'),
    resourceSprite:resource?.nativeGraphic.sprite.id===expected.textureKey&&resource?.nativeGraphic.sprite.type===(expected.spriteType??'bundled'),
    npcDirection:npc?.nativeGraphic.direction==='down',resourceDirection:resource?.nativeGraphic.direction==='down',
    npcFrame:npc?.nativeGraphic.pattern===frame,resourceFrame:resource?.nativeGraphic.pattern===frame};
  if(Object.values(checks).some(ok=>!ok))failures.push(cell.key);
  rows.push({key:cell.key,expected,expectedTags,npc,resource,checks});
}
const named=rows.map(row=>`charset:${row.expected.textureKey}:${row.expected.characterIndex}`);
const browse=await all('charset','*');
const browseIds=browse.map(row=>row.id);
if(JSON.stringify([...new Set(browseIds)].sort())!==JSON.stringify(named.sort())||browseIds.length!==named.length)failures.push('full-pagination');
const queries=[];
for(const query of ['king','golem','골렘','animal','monster','흑발 여성 마법사','보라 머리 여성 마법사','금고','나무 통']){
  const npc=(await call('list_npc_graphics',{query})).matches;
  const resources=await all('charset',query);
  queries.push({query,npc:npc.map(row=>({id:row.selectionId,label:row.label})),resources:resources.map(row=>({id:row.id,label:row.label}))});
}
const paired=[];
for(const row of reviewed.mappings.filter(row=>row.status==='mapped')){
  const cell=rows.find(cell=>cell.expected.textureKey===row.textureKey&&cell.expected.characterIndex===row.characterIndex);
  if(!cell)continue;
  const face=(await all('faceset',cell.expected.label)).find(face=>face.id===row.faceResourceId);
  const ok=!!face?.description.includes(`${row.textureKey}#${row.characterIndex} ${cell.expected.label}`);
  if(!ok)failures.push(`paired:${cell.key}`);
  paired.push({key:cell.key,storedWalkingLabel:row.label,currentWalkingLabel:cell.expected.label,faceResourceId:row.faceResourceId,description:face?.description,ok});
}
const objects=(firstSceneObjectCatalog() as {charsetObjects:any[]}).charsetObjects;
for(const object of objects){
  const cell=rows.find(cell=>cell.expected.textureKey===object.nativeGraphic.sprite.id&&cell.npc.nativeGraphic.pattern===object.nativeGraphic.pattern);
  if(!cell||cell.expected.label!==object.label||JSON.stringify(cell.expected.tags)!==JSON.stringify(object.tags))failures.push(`firstScene:${object.label}`);
}
const sourceFiles=['src/assets/charsetSemantics.ts','src/assets/charsetAppearances.ts','src/assets/charsetQuery.ts','src/assets/resourceSearch.ts','src/project/sharedCharacters.ts','src/editor/tools/queryTools.ts','src/ai/piAgent/firstScene.ts','src/editor/content/skyStairMaps.ts'];
const proof={createdAt:new Date().toISOString(),kind:'real-read-tool-probe',modelCalls:0,sharedRevision:snapshot.revision,
  visualAudit:{file:auditPath,sha256:hash(auditPath)},sourceFiles:sourceFiles.map(path=>({path,sha256:hash(path)})),
  counts:{namedSlots:rows.length,npcRows:rows.filter(row=>row.checks.npcFound).length,resourceRows:rows.filter(row=>row.checks.resourceFound).length,
    paginatedResources:browse.length,pairedWalkingDescriptions:paired.length,firstSceneCharsetObjects:objects.length,failures:failures.length},
  failures,queries,rows,paired,firstSceneCharsetObjects:objects,
  limits:['Frozen library revision; later accepted characters are outside this visual census.',
    'Matches actual tool responses to separately inspected pixel identities; not a new model trial.',
    'Portrait pixels/face labels and project author overrides are not claimed to have been visually re-audited.']};
mkdirSync(resolve(out,'..'),{recursive:true});writeFileSync(out,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof.counts));if(failures.length)process.exitCode=1;
