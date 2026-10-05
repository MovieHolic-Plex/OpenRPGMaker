// Read-only recovery/finalization after canonical adoption. Never repeats a save.
import fs from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [dir]=process.argv.slice(2);
if(!dir)throw Error('Usage: verify-approved-field-kit.mjs private-adoption-directory');
const read=async file=>JSON.parse(await fs.readFile(join(dir,file),'utf8'));
const prepared=await read('prepared-canonical.json'),loaded=await read('canonical-reloaded.json');
const receipt=await read('canonical-receipt.json'),report=await read('adoption.json');
const client=await connectHostBridge(receipt.url);
await client.call('oprn:project.open',{projectDir:'host-project'});
const status=await client.call('oprn:project.status');assert.equal(status.projectId,report.projectId);
const media=[];
for(const {id,sha256}of report.newAssets){
 const ref=loaded.assets.uploaded[id].ref;assert.equal(ref.sha256,sha256);
 const expected=Buffer.from(prepared.assets.uploaded[id].dataUrl.split(',')[1],'base64');
 // Each operation is a read; a lost socket may be retried without repeating a mutation.
 let bytes;for(let attempt=0;attempt<2;attempt++){try{bytes=await client.call('oprn:assets.read',{projectDir:'host-project',sha256});break;}catch(e){if(attempt)throw e;}}
 const actual=Buffer.from(bytes,'base64');assert(actual.equals(expected));assert.equal(createHash('sha256').update(actual).digest('hex'),sha256);
 delete prepared.assets.uploaded[id].dataUrl;prepared.assets.uploaded[id].ref=ref;media.push({id,sha256});
}
assert.deepEqual(loaded,prepared);
receipt.mediaByteReloads=media;receipt.preparedDocumentMatches=true;
await fs.writeFile(join(dir,'canonical-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
report.status='saved-and-fresh-reloaded';report.canonicalReceipt=receipt;
await fs.writeFile(join(dir,'adoption.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({revision:receipt.revision,sha256:receipt.sha256,media:media.length,documentMatches:true}));
