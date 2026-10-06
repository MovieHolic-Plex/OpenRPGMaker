import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { FACESET_FACE_ASSETS, AUTHORABLE_FACESET_FACE_ASSETS } from '../../src/assets/facesetFaceAssets';
import { FACE_EXPRESSION_SETS } from '../../src/assets/faceExpressionSets';
import { SHARED_PORTRAIT_ASSETS } from '../../src/assets/sharedPortraitAssets';
import { CHARSET_BATTLERS } from '../../src/assets/charsetBattlers';
import { CHARSET_ASSETS } from '../../src/assets/charsetCatalog';
import { CHARSET_SEMANTICS } from '../../src/assets/charsetSemantics';
import { installSharedCharacters, ensureSharedCharacters, sharedCharacterSemantics } from '../../src/project/sharedCharacters';
import { acceptSharedCharacterGraphics } from '../../src/project/sharedCharacterFaceResolver';
import { createBlankProject } from '../../src/project/defaults';
import { QUERY_TOOLS } from '../../src/editor/tools/queryTools';
import { MONSTER_RESOURCE_TOOLS } from '../../src/editor/tools/monsterResourceTools';
import { listMonsterResources } from '../../src/assets/monsterResourceCatalog';
import { resolveAssetResourceUrl, builtinGeneratedResourceIds } from '../../src/assets/generatedAssetResourceResolver';
import { listCharacterFaces } from '../../src/project/characterGraphics';
import reviewed from '../../src/assets/sharedCharacterGraphics.json';
import type { SharedContentSnapshot } from '../../src/project/sharedContentSchema';

const args = process.argv.slice(2);
const option = (name: string) => { const i=args.indexOf(`--${name}`); if(i<0||!args[i+1])throw Error(`--${name} required`);return resolve(args[i+1]!); };
const out=option('out'), sharedDb=option('shared-db'), hostFile=option('host-catalog'), projectsRoot=option('projects-root');
if(existsSync(join(out,'inventory.json')))throw Error('Use a new output directory.');
mkdirSync(join(out,'sources'),{recursive:true});
const hash=(data:string|Uint8Array)=>createHash('sha256').update(data).digest('hex');
const original=new DatabaseSync(sharedDb,{readOnly:true});
let snapshot:SharedContentSnapshot;
try {
  original.exec('PRAGMA query_only=ON; BEGIN');
  const rows=original.prepare("SELECT id,revision,payload FROM content_libraries WHERE json_extract(payload,'$.characters') IS NOT NULL ORDER BY id").all() as {id:string;revision:string;payload:string}[];
  snapshot={revision:rows.map(row=>`${row.id}:${row.revision}`).join(','),libraries:Object.fromEntries(rows.map(row=>[row.id,JSON.parse(row.payload)]))};
  const frozen=new DatabaseSync(join(out,'shared-snapshot.sqlite'));
  try{frozen.exec('CREATE TABLE content_libraries(id TEXT PRIMARY KEY, revision TEXT NOT NULL, payload TEXT NOT NULL)');for(const row of rows)frozen.prepare('INSERT INTO content_libraries VALUES(?,?,?)').run(row.id,row.revision,row.payload);}finally{frozen.close();}
}finally{original.close();}
installSharedCharacters(snapshot);
const host=JSON.parse(readFileSync(hostFile,'utf8'));acceptSharedCharacterGraphics(host);
const project=createBlankProject();ensureSharedCharacters(project);
const fileFor=(url:string|null|undefined)=>{
  if(!url)return null;
  if(url.startsWith('data:image/'))return null;
  const relative=url.replace(/^\//,'');return [resolve(relative),resolve('public',relative)].find(existsSync)??null;
};
const image=(id:string,url:string|null|undefined)=>{
  let file=fileFor(url);
  if(url?.startsWith('data:image/png;base64,')){file=join(out,'sources',`${hash(id).slice(0,20)}.png`);writeFileSync(file,Buffer.from(url.split(',')[1]!,'base64'));}
  return {url:url?.startsWith('data:')?'inline PNG':url,file,sha256:file?hash(readFileSync(file)):null};
};
const faces=FACESET_FACE_ASSETS.map(asset=>({...asset,authorable:AUTHORABLE_FACESET_FACE_ASSETS.some(row=>row.id===asset.id),...image(asset.id,asset.path)}));
const portraits=SHARED_PORTRAIT_ASSETS.map(asset=>({...asset,...image(asset.id,asset.path)}));
const walkSources=CHARSET_ASSETS.map(asset=>({id:asset.textureKey,name:asset.fileName,origin:'bundled',...image(asset.textureKey,asset.path)}));
for(const library of Object.values(snapshot.libraries))for(const asset of Object.values(library.assets))if(asset.kind==='charset')walkSources.push({id:asset.id,name:asset.name,origin:'shared',...image(asset.id,asset.dataUrl)});
const charset=[...CHARSET_SEMANTICS,...sharedCharacterSemantics()];
const monsters=listMonsterResources(project).map(row=>({...row,...image(row.resourceId,resolveAssetResourceUrl(row.resourceId,{project}))}));
const battlers=CHARSET_BATTLERS.map(row=>({...row,...image(row.resourceId,row.path),cast:image(`${row.resourceId}-cast`,row.castPath)}));
const legacyPortraits=builtinGeneratedResourceIds().filter(id=>id.startsWith('generated-face-')||/^generated-actor-.*-face$/.test(id)).map(id=>({id,...image(id,resolveAssetResourceUrl(id,{project}))}));
const call=async(name:string,args:Record<string,unknown>)=>{const tool=[...QUERY_TOOLS,...MONSTER_RESOURCE_TOOLS].find(tool=>tool.name===name)!;return (await tool.run(project,args)).data as any;};
const pages=async(kind:string)=>{const result:any[]=[];let offset=0;for(;;){const page=await call('list_resources',{kind,query:'*',offset,limit:50});result.push(...page.matches);if(page.nextOffset==null)return result;offset=page.nextOffset;}};
const toolResponses={faces:await pages('faceset'),charset:await pages('charset'),monsters:await pages('monster'),monsterDetails:await call('list_monster_resources',{include:'full'})};
const projectFiles=(root:string):string[]=>readdirSync(root,{withFileTypes:true}).flatMap(entry=>{
  if(['node_modules','.git','backups','qa-runs','.vite-cache'].includes(entry.name))return [];
  const path=join(root,entry.name);return entry.isDirectory()?projectFiles(path):entry.name==='project.sqlite'?[path]:[];
});
const projects=[];const uploads=new Map<string,any>();
for(const path of projectFiles(projectsRoot)){
  const db=new DatabaseSync(path,{readOnly:true});
  try{
    db.exec('PRAGMA query_only=ON; BEGIN');
    const row=db.prepare("SELECT project_id,revision,current_json FROM project WHERE id=1").get() as {project_id:string;revision:number;current_json:string};
    if(!row)continue;
    const p=JSON.parse(row.current_json);
    const conversationCount=(db.prepare('SELECT count(*) AS n FROM ai_conversations').get() as {n:number}).n;
    const resources=Object.values(p.assets?.uploaded??{}) as any[];
    const relevant=resources.filter(a=>['charset','faceset','monster'].includes(a.kind));
    projects.push({projectId:row.project_id,file:path,revision:row.revision,conversationCount,charsetLabels:p.charsetLabels??[],faceProfiles:(p.resourceProfiles??[]).filter((r:any)=>['faceset','charset','monster'].includes(r.kind)),uploads:relevant.map(a=>({id:a.id,name:a.name,kind:a.kind}))});
    for(const a of relevant){
      if(a.id.startsWith('shared_charset_actor_'))continue;
      let url=a.dataUrl;let file:string|null=null;
      if(a.storage?.path)file=resolve(dirname(path),a.storage.path);
      if(a.blob?.sha256)file=join(dirname(path),'assets',`${a.blob.sha256}.png`);
      if(a.sha256)file=join(dirname(path),'assets',`${a.sha256}.png`);
      if(a.ref?.sha256)file=join(dirname(path),'assets',`${a.ref.sha256}.${a.ref.extension??'png'}`);
      // SQLite blob descriptors use a relative content-addressed asset path.
      const descriptor=a.source??a.storage??a.blob;
      if(!file&&descriptor?.relativePath)file=resolve(dirname(path),descriptor.relativePath);
      const im=file&&existsSync(file)?{url:'project asset',file,sha256:hash(readFileSync(file))}:image(a.id,url);
      const key=`${a.id}:${im.sha256??hash(JSON.stringify(a))}`;
      const previous=uploads.get(key);
      if(previous){previous.projectIds.push(row.project_id);continue;}
      uploads.set(key,{id:a.id,name:a.name,kind:a.kind,descriptorKeys:Object.keys(a),asset:a,...im,projectIds:[row.project_id]});
    }
  }finally{db.close();}
}
const manifest={createdAt:new Date().toISOString(),sourceCommit:process.env.AUDIT_SOURCE_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sharedRevision:snapshot.revision,hostCatalogSha256:hash(readFileSync(hostFile)),host,reviewed,faces,portraits,walkSources,charset,monsters,battlers,legacyPortraits,toolResponses,projectFaces:listCharacterFaces(project),projects,projectUploads:[...uploads.values()],modelCalls:0};
writeFileSync(join(out,'inventory.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({out,sharedRevision:snapshot.revision,faces:faces.length,authorableFaces:faces.filter(r=>r.authorable).length,expressionSets:FACE_EXPRESSION_SETS.length,portraits:portraits.length,namedWalkSlots:charset.length,monsters:monsters.length,battlers:battlers.length,projects:projects.length,uniqueUploads:uploads.size}));
