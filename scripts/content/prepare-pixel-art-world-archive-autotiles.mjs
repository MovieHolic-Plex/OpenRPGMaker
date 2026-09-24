// Validated metadata only. ZIPs and decoded artwork remain on the user's machine.
import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const data=await read('tiledata/pixel-art-world/autotiles-archive.json'),base=await read('tiledata/pixel-art-world/autotiles.json');
const ids=new Set(base.map(p=>p.id)),hashes=new Set(base.map(p=>p.sha256));
const archive=s=>{const u=new URL(s.downloadUrl);if(u.protocol!=='https:'||u.hostname!=='yms.main.jp'||!u.pathname.endsWith('.zip')||!s.archiveMember||s.archiveMember.startsWith('/')||s.archiveMember.split('/').includes('..')||!s.archiveMember.endsWith('/'+s.filename)||!/^[a-f0-9]{64}$/.test(s.archiveSha256))throw Error('Invalid official archive identity');};
for(const p of data.packs){
 if(ids.has(p.id)||hashes.has(p.sha256)||!/^paw-xp-archive-[\w-]+$/.test(p.id)||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error('Repeated/invalid archive source');ids.add(p.id);hashes.add(p.sha256);
 if(p.frames!==1||p.sourceWidth!==96||p.sourceHeight!==128||p.quarterLayout!=='xp-full-edge-v1'||!['lower','upper'].includes(p.defaultLayer)||!['solid','passable'].includes(p.passage)||!['blob','rectangle'].includes(p.shapePolicy)||!['none','floor','wall','roof','material'].includes(p.underlay)||!p.rights.runtimeImportAllowed||p.rights.redistributeArt!==false)throw Error('Invalid XP archive semantics');
 if(p.placement!==(p.defaultLayer==='lower'&&p.shapePolicy==='blob'?'lower-autoshape':'manual-mask'))throw Error('Incorrect shaping mode');
 if(!p.aliases.length||!p.archiveSources.length)throw Error('Missing ZIP member');p.aliases.forEach(archive);p.archiveSources.forEach(archive);
 const e=p.referenceExample;if(!e||e.width<3||e.width>12||e.height<3||e.height>10||e.footprintRows.length!==e.height||e.footprintRows.some(r=>r.length!==e.width||!/^[01]+$/.test(r))||!e.backingKey||!e.purpose)throw Error('Invalid tiny assembly');
}
for(const a of data.byteEditionAliases){const p=base.find(p=>p.id===a.packId);if(!p||p.sha256!==a.pixelEquivalentToSha256||hashes.has(a.sha256))throw Error('Invalid byte-edition alias');hashes.add(a.sha256);a.archiveSources.forEach(archive);}
const listed=data.atlases.flatMap(a=>a.packIds);if(listed.length!==data.packs.length||new Set(listed).size!==listed.length||data.packs.some(p=>!listed.includes(p.id))||data.atlases.some(a=>a.packIds.length+1>24))throw Error('Archive grouping mismatch');
if(data.sources.length!==67||data.packs.length+data.byteEditionAliases.length!==67)throw Error('Audit coverage changed');
await fs.writeFile(new URL('src/assets/pixelArtWorldArchiveAutotiles.json',root),JSON.stringify(data,null,2)+'\n');
console.log({newPixelFamilies:data.packs.length,byteEditionAliases:data.byteEditionAliases.length,atlases:data.atlases.length});
