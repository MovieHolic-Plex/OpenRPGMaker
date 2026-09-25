// Apply authored maps/references and optional PNG assets through the host's CAS.
import fs from 'node:fs/promises';
import {isDeepStrictEqual as equal} from 'node:util';
import {createHash} from 'node:crypto';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [host,file,out]=process.argv.slice(2);
if(!host||!file||!out)throw Error('Usage: <host> <patch.json> <private output>');
const patch=JSON.parse(await fs.readFile(file,'utf8'));
const bridge=await connectHostBridge(host),rpc=bridge.call,status=await rpc('oprn:project.status');
if(!patch.sourceProjectId||patch.sourceProjectId!==status.projectId)throw Error('Project identity differs');
let loaded=await rpc('oprn:project.load'),p=JSON.parse(loaded.serialized);
const beforeSha=loaded.sha256,beforeRevision=loaded.revision;loaded=null;
console.log({stage:'loaded',revision:beforeRevision});
const assetSignature=source=>{
 if(!source)return null;
 const a=structuredClone(source);
 const contentHash=a.dataUrl?createHash('sha256').update(Buffer.from(a.dataUrl.split(',')[1],'base64')).digest('hex'):a.ref?.sha256;
 if(!contentHash)throw Error('Missing asset content identity');
 delete a.dataUrl;delete a.ref;return {...a,contentHash};
};
for(const[id,asset]of Object.entries(patch.assets??{})){
 if(!Object.hasOwn(patch.beforeAssets??{},id)||!equal(assetSignature(p.assets.uploaded[id]),assetSignature(patch.beforeAssets[id])))throw Error('Stale asset: '+id);
 if(!asset.dataUrl?.startsWith('data:image/png;base64,'))throw Error('Prepared PNG required: '+id);
}
for(const section of ['maps','tilesets'])for(const[id,value]of Object.entries(patch[section])){
 const bases=patch[section==='maps'?'beforeMaps':'beforeTilesets'];
 if(!Object.hasOwn(bases,id)||!equal(p[section][id]??null,bases[id]))throw Error('Stale patch: '+section+'/'+id);
 if(section==='maps'&&bases[id]===null)p.mapTree.children.push({mapId:id,children:[]});
 p[section][id]=value;
}
await rpc('oprn:project.backup',{projectDir:status.projectDir});
for(const[id,source]of Object.entries(patch.assets??{})){
 const asset=structuredClone(source),put=await rpc('oprn:assets.put',{projectDir:status.projectDir,bytes:asset.dataUrl.split(',')[1],mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});
 delete asset.dataUrl;asset.ref=put.ref;p.assets.uploaded[id]=asset;
}
const serialized=JSON.stringify(p);
const saved=await rpc('oprn:project.save',{projectDir:status.projectDir,serialized,expectedSha:beforeSha});
if(saved.kind!=='saved')throw Error('CAS rejected: '+saved.kind);
console.log({stage:'saved'});
loaded=await rpc('oprn:project.load');
if(!equal(JSON.parse(loaded.serialized),p))throw Error('Canonical reload differs');
for(const[id,source]of Object.entries(patch.assets??{})){
 const bytes=await rpc('oprn:assets.read',{projectDir:status.projectDir,sha256:p.assets.uploaded[id].ref.sha256});
 if(!Buffer.from(bytes,'base64').equals(Buffer.from(source.dataUrl.split(',')[1],'base64')))throw Error('Asset reload differs: '+id);
}
await fs.mkdir(out,{recursive:true});
await fs.writeFile(out+'/canonical-reloaded.json',loaded.serialized);
const proof={projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,reloadedEqual:true,changedMaps:Object.keys(patch.maps),changedTilesets:Object.keys(patch.tilesets),changedAssetBytes:Object.keys(patch.assets??{}),newMapsInTree:Object.keys(patch.maps).filter(id=>patch.beforeMaps[id]===null)};
await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(proof);
