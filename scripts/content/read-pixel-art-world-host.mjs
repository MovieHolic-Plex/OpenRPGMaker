// Read the active canonical host and resolve only Pixel Art World image dependencies.
// Keep large documents out of the renderer; use the same authenticated host API.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [host,out]=process.argv.slice(2);
if(!host||!out)throw Error('Usage: <canonical host URL> <private output directory>');
await fs.mkdir(out,{recursive:true});
const bridge=await connectHostBridge(host),status=await bridge.call('oprn:project.status');
let loaded=await bridge.call('oprn:project.load');
const proof={projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256};
const project=JSON.parse(loaded.serialized);loaded=null;
const doorIds=JSON.parse(await fs.readFile('src/assets/pixelArtWorldDoors.json','utf8')).map(p=>'shared_'+p.id.replaceAll('-','_'));
const eventIds=JSON.parse(await fs.readFile('src/assets/pixelArtWorldEventProps.json','utf8')).packs.filter(p=>p.rights.runtimeImportAllowed).map(p=>'shared_'+p.id.replaceAll('-','_'));
const used=new Set(Object.values(project.tilesets).filter(t=>t.id.startsWith('paw-')||t.id.startsWith('shared_paw_')).map(t=>t.image.id));
for(const id of [...doorIds,...eventIds])if(project.assets.uploaded[id])used.add(id);
for(const id of used){
 const asset=project.assets.uploaded[id];
 if(!asset)throw Error('Missing referenced asset '+id);
 if(!asset.dataUrl&&asset.ref){
  const base64=await bridge.call('oprn:assets.read',{projectDir:status.projectDir,sha256:asset.ref.sha256});
  if(createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex')!==asset.ref.sha256)throw Error('Asset bytes do not match reference '+id);
  asset.dataUrl='data:image/png;base64,'+base64;delete asset.ref;
 }
}
const serialized=JSON.stringify(project);
proof.portableSha256=createHash('sha256').update(serialized).digest('hex');
await fs.writeFile(`${out}/current-portable.json`,serialized);
await fs.writeFile(`${out}/source-proof.json`,JSON.stringify(proof,null,2));
console.log(proof);
