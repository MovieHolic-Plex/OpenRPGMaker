// Accept only the actual assistant's opening + newly generated pictures. Preserve all other canon.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import {isDeepStrictEqual} from 'node:util';
const [candidateFile,canonicalFile,portableFile,output,portableOutput]=process.argv.slice(2);
if(!portableOutput)throw Error('Usage: apply-monster-assistant-opening.mjs <candidate> <canon> <portable-cache> <prepared> <new-portable-cache>');
const candidate=JSON.parse(await fs.readFile(candidateFile,'utf8')),canon=JSON.parse(await fs.readFile(canonicalFile,'utf8')),portable=JSON.parse(await fs.readFile(portableFile,'utf8'));
const stripped=p=>{const clone=structuredClone(p);delete clone.assets;delete clone.system.opening;return clone;};
if(!isDeepStrictEqual(stripped(candidate),stripped(canon)))throw Error('Assistant changed data outside opening/assets');
if(!candidate.system.opening?.enabled||!candidate.system.opening.scenes.length)throw Error('Missing enabled opening');
const originalIds=Object.keys(canon.assets.uploaded),newIds=Object.keys(candidate.assets.uploaded).filter(id=>!originalIds.includes(id));
const metadata=a=>{const copy={...a};delete copy.dataUrl;delete copy.ref;return copy;};
const bytes=a=>{const match=/^data:([^;,]+);base64,(.+)$/.exec(a?.dataUrl??'');if(!match)throw Error('Missing materialized bytes');return {mime:match[1],bytes:Buffer.from(match[2],'base64')};};
for(const id of originalIds){const old=canon.assets.uploaded[id],next=candidate.assets.uploaded[id];if(!next||!isDeepStrictEqual(metadata(old),metadata(next)))throw Error('Existing asset changed/removed: '+id);const data=bytes(next);const expected=old.ref?.sha256??createHash('sha256').update(bytes(old).bytes).digest('hex');if(createHash('sha256').update(data.bytes).digest('hex')!==expected)throw Error('Existing bytes changed: '+id);}
const prepared=structuredClone(canon);prepared.system.opening=structuredClone(candidate.system.opening);
for(const id of newIds){const a=candidate.assets.uploaded[id],data=bytes(a);if(!id.startsWith('opening_still_')&&!id.startsWith('opening_layer_')||a.kind!=='backdrop'||data.mime!=='image/png')throw Error('Unexpected new assistant asset: '+id);prepared.assets.uploaded[id]=structuredClone(a);}
const cache=structuredClone(prepared);
for(const id of originalIds){const a=cache.assets.uploaded[id],source=portable.assets.uploaded[id];const data=bytes(source);if(a.ref&&createHash('sha256').update(data.bytes).digest('hex')!==a.ref.sha256)throw Error('Portable cache mismatch: '+id);delete a.ref;a.dataUrl=source.dataUrl;}
await fs.writeFile(output,JSON.stringify(prepared));await fs.writeFile(portableOutput,JSON.stringify(cache));
console.log(JSON.stringify({oldAssetsPreserved:originalIds.length,newAssets:newIds.length,scenes:prepared.system.opening.scenes.length,otherContentPreserved:true,canonicalSaved:false}));
