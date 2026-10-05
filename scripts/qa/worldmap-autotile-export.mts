// Use the shipping export projection, including its editor-reference trimming.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {openLocalProjectStore} from '../../electron/local-store/store.ts';
import {prepareWebExport} from '../../src/project/webExport.ts';
const store=await openLocalProjectStore({projectDir:process.argv[2]}),snapshot=store.loadSnapshot()!;
const projectId=store.info().projectId;
const result=prepareWebExport(snapshot.project);
const mapsUnchanged=Object.keys(snapshot.project.maps).every(id=>isDeepStrictEqual(result.project.maps[id],snapshot.project.maps[id]));
const graftSourcesPreserved=Object.values(result.project.tilesets).every(t=>(t.tileGrafts??[]).every(g=>Object.entries(snapshot.project.tilesets).filter(([id,t])=>id===g.sourceChipset||t.image.id===g.sourceChipset).every(([id])=>!!result.project.tilesets[id])));
if(!mapsUnchanged||!graftSourcesPreserved)throw Error('Export lost saved map data or graft source');
fs.writeFileSync(process.argv[3],result.projectJson);
const uploadedFiles=[];
if(process.argv[5]){
 const packageDir=path.resolve(process.argv[5]);
 const source=process.argv[6]?await openLocalProjectStore({projectDir:process.argv[6]}):null;
 try{
  for(const item of result.assets.filter(a=>a.kind==='uploaded')){
   const asset=item.asset;let bytes:Uint8Array;
   if(asset.ref){
    try{bytes=await store.assetBytes(asset.ref.sha256);}catch(error){
     if(!source)throw error;
     bytes=await source.assetBytes(asset.ref.sha256);
     const registered=await store.putAsset(bytes,{mime:asset.ref.mime,extension:asset.ref.extension,originalName:asset.name,kind:asset.kind});
     if(registered.sha256!==asset.ref.sha256)throw Error('QA asset copy changed bytes');
    }
   }else{
    const {uploadedAssetBytes}=await import('../../src/project/persistence/assetAccessors.ts');bytes=await uploadedAssetBytes(asset);
   }
   const output=path.join(packageDir,item.zipPath);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
   uploadedFiles.push({path:item.zipPath,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
 }finally{source?.close();}
}
store.close();
fs.writeFileSync(process.argv[4],JSON.stringify({projectId,revision:snapshot.revision,sourceSha256:snapshot.sha256,shippingExport:true,mapsUnchanged,graftSourcesPreserved,keptTilesets:Object.keys(result.project.tilesets),removedTilesets:Object.keys(snapshot.project.tilesets).length-Object.keys(result.project.tilesets).length,uploadedFiles,...result.summary},null,2));
console.log(result.summary);
