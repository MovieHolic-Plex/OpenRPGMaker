// Read-only canonical audit of a real assistant generation, independent of its completion text.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {renderMapPng} from '../qa-game/render.mts';
import type {Project} from '../../src/project/types.ts';
const dir=path.resolve(process.argv[2]!);
const prior=JSON.parse(fs.readFileSync(path.join(dir,'summary.json'),'utf8'));
const before=JSON.parse(fs.readFileSync(path.join(dir,'seed-maps.json'),'utf8'));
const store=await openLocalProjectStore({projectDir:prior.folder});
const snapshot=store.loadSnapshot()!;const p=snapshot.project as Project;store.close();
const portable=structuredClone(p);
for(const asset of Object.values(portable.assets.uploaded))if(asset.ref&&!asset.dataUrl){
 const bytes=fs.readFileSync(path.join(prior.folder,'assets',asset.ref.sha256+'.'+asset.ref.extension));
 if(createHash('sha256').update(bytes).digest('hex')!==asset.ref.sha256)throw Error('Asset hash differs');
 asset.dataUrl=`data:${asset.ref.mime};base64,${bytes.toString('base64')}`;
}
const originalMapsPreserved=Object.entries(before.maps).every(([id,map])=>isDeepStrictEqual(p.maps[id],map))&&
 p.startMapId===before.startMapId&&isDeepStrictEqual(p.startPos,before.startPos);
const maps=prior.generated.map((item:any)=>{
 const map=portable.maps[item.mapId]!,image=renderMapPng(portable,map,1);
 if(image.note)throw Error(image.note);
 return {mapId:map.id,theme:map.worldmapSource?.theme,sourcePreserved:isDeepStrictEqual(map.worldmapSource,item.source),
  characterScale:map.characterScale,locations:map.locations?.length,events:map.events.length,
  privateTileset:map.tilesetId==='worldmap_'+map.id,renderMatchesSavedEvidence:image.png.equals(fs.readFileSync(path.join(dir,map.id+'.png'))),
  atlasSha256:createHash('sha256').update(Buffer.from(portable.assets.uploaded[(p.tilesets[map.tilesetId]!.image as {id:string}).id]!.dataUrl!.split(',')[1]!, 'base64')).digest('hex'),
  journeyPassed:item.journeyCheck?.ok===true,selectedIcons:item.iconSelection?.rendered.length,pendingIcons:item.iconSelection?.pending.length};
});
const passed=originalMapsPreserved&&maps.length===1&&maps.every((map:any)=>map.sourcePreserved&&map.privateTileset&&map.renderMatchesSavedEvidence&&map.journeyPassed&&map.characterScale===.75&&map.events===0);
const proof={passed,folder:prior.folder,projectId:prior.projectId,revision:snapshot.revision,originalMapsPreserved,
 savedAndReopened:true,toolCalls:prior.stats.toolCalls,toolErrors:prior.stats.toolErrors,maps};
fs.writeFileSync(path.join(dir,'reloaded-audit.json'),JSON.stringify(proof,null,2));
console.log(JSON.stringify(proof,null,2));if(!passed)process.exitCode=1;
