// Canonical campaign creation/save/reload through the running host's own service.
// Credentials remain inside hostBridgeClient; no SQLite or legacy DB writes here.
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
import {withTsModule} from '../ontology-ts-loader.mjs';

const [operation,host,out,file,expectedSourceSha] = process.argv.slice(2);
if (!['create','save','read'].includes(operation) || !host || !out) {
  throw Error('Usage: node scripts/content/monster-expedition-store.mjs create|save|read <host> <private-output-directory> [project.json] [expected-source-sha]');
}
await fs.mkdir(out,{recursive:true});
const identityPath=resolve(out,'canonical-identity.json');
let identity;
try { identity=JSON.parse(await fs.readFile(identityPath,'utf8')); }
catch(error) { if(error.code!=='ENOENT') throw error; }

if(operation==='create') {
  if(identity) throw Error('Canonical destination already exists; use read or save.');
  const serialized=await withTsModule(resolve('src/project/examples/monsterExpedition/seed.ts'),'expedition-seed.mjs',mod=>mod.serializeExpeditionSeed());
  const base=await connectHostBridge(host);
  const created=await base.call('oprn:start.createProject',{title:'별빛섬 몬스터 원정',seed:serialized});
  identity={projectId:created.projectId,hostProject:created.projectDir,host,
    projectDir:'/home/main/.local/share/oprn/web-workspace/.oprn-projects/'+created.projectDir};
  await fs.writeFile(identityPath,JSON.stringify(identity,null,2));
}
if(!identity)throw Error('Create the canonical destination first.');
const target=new URL(identity.host);target.searchParams.set('hostProject',identity.hostProject);
const client=await connectHostBridge(target.href);
await client.call('oprn:project.open',{projectDir:'host-project'});
const before=await client.call('oprn:project.load',{projectDir:'host-project'});
let expected;
const media=[];
if(operation==='save') {
  if(!file)throw Error('Prepared project JSON required.');
  if(expectedSourceSha && before.sha256 !== expectedSourceSha) throw Error('Canonical source changed since preparation; read and prepare again.');
  expected=JSON.parse(await fs.readFile(file,'utf8'));
  if(expected.meta.title!=='별빛섬 몬스터 원정')throw Error('Unexpected campaign identity.');
  await client.call('oprn:project.backup',{projectDir:'host-project'});
  for(const [id,asset] of Object.entries(expected.assets.uploaded)) {
    if(!asset.dataUrl)continue;
    const match=/^data:([^;,]+);base64,(.+)$/.exec(asset.dataUrl);
    if(!match)throw Error('Unsupported media encoding: '+id);
    const mime=match[1],bytes=match[2];
    const extension=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav'})[mime];
    if(!extension)throw Error('Unsupported media type: '+mime);
    const put=await client.call('oprn:assets.put',{projectDir:'host-project',bytes,mime,extension,originalName:asset.name,kind:asset.kind});
    media.push({id,bytes,sha256:put.ref.sha256});
    delete asset.dataUrl;asset.ref=put.ref;
  }
  const serialized=JSON.stringify(expected);
  const saved=await client.call('oprn:project.save',{projectDir:'host-project',serialized,expectedSha:before.sha256});
  if(saved.kind!=='saved')throw Error('Save rejected: '+saved.kind);
}
// A new connection and reopen prove service persistence rather than a browser store snapshot.
const fresh=await connectHostBridge(target.href);
await fresh.call('oprn:project.open',{projectDir:'host-project'});
const status=await fresh.call('oprn:project.status');
const loaded=await fresh.call('oprn:project.load',{projectDir:'host-project'});
if(status.projectId!==identity.projectId)throw Error('Reload identity differs.');
const digest=createHash('sha256').update(loaded.serialized).digest('hex');
if(digest!==loaded.sha256)throw Error('Reload digest differs.');
if(operation==='save'&&!isDeepStrictEqual(JSON.parse(loaded.serialized),expected))throw Error('Reloaded document differs.');
for(const asset of media) {
  const bytes=await fresh.call('oprn:assets.read',{projectDir:'host-project',sha256:asset.sha256});
  if(!Buffer.from(bytes,'base64').equals(Buffer.from(asset.bytes,'base64')))throw Error('Reloaded media differs: '+asset.id);
}
await fs.writeFile(resolve(out,'canonical-reloaded.json'),loaded.serialized);
await fs.writeFile(resolve(out,'canonical-receipt.json'),JSON.stringify({...identity,url:target.href,revision:loaded.revision,sha256:loaded.sha256,reloadedThroughFreshConnection:true,mediaByteReloads:media.map(({id,sha256})=>({id,sha256})),maps:Object.keys(JSON.parse(loaded.serialized).maps).length},null,2));
console.log(JSON.stringify({...identity,url:target.href,revision:loaded.revision,sha256:loaded.sha256}));
