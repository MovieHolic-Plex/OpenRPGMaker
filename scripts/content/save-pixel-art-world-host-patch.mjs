// Apply map/reference-only patches through the host, preserving unrelated data.
import fs from 'node:fs/promises';
import {isDeepStrictEqual as equal} from 'node:util';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [host,file,out]=process.argv.slice(2);
if(!host||!file||!out)throw Error('Usage: <host> <patch.json> <private output>');
const patch=JSON.parse(await fs.readFile(file,'utf8'));
if(Object.keys(patch.assets??{}).length)throw Error('Use asset installer for pixel changes');
const bridge=await connectHostBridge(host),rpc=bridge.call,status=await rpc('oprn:project.status');
if(!patch.sourceProjectId||patch.sourceProjectId!==status.projectId)throw Error('Project identity differs');
let loaded=await rpc('oprn:project.load'),p=JSON.parse(loaded.serialized);
const beforeSha=loaded.sha256;loaded=null;
for(const section of ['maps','tilesets'])for(const[id,value]of Object.entries(patch[section])){
 const bases=patch[section==='maps'?'beforeMaps':'beforeTilesets'];
 if(!Object.hasOwn(bases,id)||!equal(p[section][id]??null,bases[id]))throw Error('Stale patch: '+section+'/'+id);
 if(section==='maps'&&bases[id]===null)p.mapTree.children.push({mapId:id,children:[]});
 p[section][id]=value;
}
await rpc('oprn:project.backup',{projectDir:status.projectDir});
const serialized=JSON.stringify(p);
const saved=await rpc('oprn:project.save',{projectDir:status.projectDir,serialized,expectedSha:beforeSha});
if(saved.kind!=='saved')throw Error('CAS rejected: '+saved.kind);
loaded=await rpc('oprn:project.load');
if(!equal(JSON.parse(loaded.serialized),p))throw Error('Canonical reload differs');
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/canonical-reloaded.json',loaded.serialized);
const proof={projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,reloadedEqual:true,changedMaps:Object.keys(patch.maps),changedTilesets:Object.keys(patch.tilesets),newMapsInTree:Object.keys(patch.maps).filter(id=>patch.beforeMaps[id]===null)};
await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(proof);
