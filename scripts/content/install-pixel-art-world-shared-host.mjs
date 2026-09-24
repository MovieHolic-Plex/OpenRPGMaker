// Install through the running host's official API; no direct SQLite writes.
// Large project documents stay in Node rather than a Chromium renderer.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [host,libraryFile,out]=process.argv.slice(2);
if(!host||!libraryFile||!out)throw Error('Usage: <host URL> <local library.json> <private output>');
await fs.mkdir(out,{recursive:true});
const hash=value=>createHash('sha256').update(JSON.stringify(value)??'undefined').digest('hex');
const bridge=await connectHostBridge(host),rpc=bridge.call;
const status=await rpc('oprn:project.status');
let loaded=await rpc('oprn:project.load'),p=JSON.parse(loaded.serialized);
const beforeSha=loaded.sha256,beforeRevision=loaded.revision;loaded=null;
const l=JSON.parse(await fs.readFile(libraryFile,'utf8'));
if(l.sourceProjectId&&l.sourceProjectId!==status.projectId)throw Error('Library source project differs from canonical host');
const maps=hash(p.maps),spatial=hash(p.spatialAuthoring);
console.log({stage:'canonical-loaded',projectId:status.projectId,revision:beforeRevision});
await rpc('oprn:project.backup',{projectDir:status.projectDir});
for(const[id,source]of Object.entries(l.assets)){
 const asset=structuredClone(source),put=await rpc('oprn:assets.put',{projectDir:status.projectDir,bytes:asset.dataUrl.split(',')[1],mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});
 delete asset.dataUrl;asset.ref=put.ref;p.assets.uploaded[id]=asset;
}
Object.assign(p.tilesets,l.tilesets);console.log({stage:'assets-written',count:Object.keys(l.assets).length});
let serialized=JSON.stringify(p);p=null;
const saved=await rpc('oprn:project.save',{projectDir:status.projectDir,serialized,expectedSha:beforeSha});serialized=null;
if(saved.kind!=='saved')throw Error('Canonical CAS rejected: '+saved.kind);
console.log({stage:'canonical-saved'});
loaded=await rpc('oprn:project.load');const after=JSON.parse(loaded.serialized);delete loaded.serialized;
if(hash(after.maps)!==maps||hash(after.spatialAuthoring)!==spatial)throw Error('Authored maps or spatial structure changed');
for(const[id,t]of Object.entries(l.tilesets))if(hash(after.tilesets[id])!==hash(t))throw Error('Reference projection differs: '+id);
for(const[id,source]of Object.entries(l.assets)){
 const asset=after.assets.uploaded[id];if(!asset?.ref||asset.kind!==source.kind||hash(asset.meta)!==hash(source.meta))throw Error('Saved asset metadata differs: '+id);
 const actual=Buffer.from(await rpc('oprn:assets.read',{projectDir:status.projectDir,sha256:asset.ref.sha256}),'base64'),expected=Buffer.from(source.dataUrl.split(',')[1],'base64');
 if(!actual.equals(expected))throw Error('Saved asset bytes differ: '+id);
}
const result={projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,reloadedEqual:true,unchangedMaps:Object.keys(after.maps).length,projectedTilesets:Object.keys(l.tilesets).length,reloadedAssetBytes:Object.keys(l.assets).length,saveRequests:bridge.requests,transport:'authenticated host HTTP dispatcher; renderer used only for small bridge bootstrap'};
await fs.writeFile(out+'/proof.json',JSON.stringify(result,null,2));console.log(result);
