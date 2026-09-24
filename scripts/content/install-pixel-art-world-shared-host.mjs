// Install a prepared user-local shared library through the running canonical host.
import{chromium}from'playwright';import fs from'node:fs/promises';
const [host,libraryFile,out]=process.argv.slice(2);if(!host||!libraryFile||!out)throw Error('Usage: <host URL> <local library.json> <private output>');
await fs.mkdir(out,{recursive:true});
const b=await chromium.launch();try{const page=await b.newPage(),saveRequests=[];page.on('request',request=>{if(request.headers()['x-oprn-channel']==='oprn:project.save')saveRequests.push({encoding:request.headers()['content-encoding']??'identity',bodyBytes:request.postDataBuffer()?.length??null});});await page.route('**/__paw-library',r=>r.fulfill({path:libraryFile,contentType:'application/json'}));await page.goto(new URL('/__oprn/team',host).href);await page.waitForFunction(()=>window.oprn?.project);
const result=await page.evaluate(async()=>{
 const status=await window.oprn.project.status(),before=await window.oprn.project.load();const p=JSON.parse(before.serialized),l=await(await fetch('/__paw-library')).json();
 if(l.sourceProjectId&&l.sourceProjectId!==status.projectId)throw Error('Library source project differs from canonical host');
 const maps=JSON.stringify(p.maps),spatial=JSON.stringify(p.spatialAuthoring);await window.oprn.project.backup({projectDir:status.projectDir});
 for(const [id,source]of Object.entries(l.assets)){const asset=structuredClone(source),bytes=Uint8Array.from(atob(asset.dataUrl.split(',')[1]),c=>c.charCodeAt(0));const put=await window.oprn.assets.put({projectDir:status.projectDir,bytes,mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});delete asset.dataUrl;asset.ref=put.ref;p.assets.uploaded[id]=asset;}
 Object.assign(p.tilesets,l.tilesets);const saved=await window.oprn.project.save({projectDir:status.projectDir,serialized:JSON.stringify(p),expectedSha:before.sha256});if(saved.kind!=='saved')throw Error('Canonical CAS rejected: '+saved.kind);
 const loaded=await window.oprn.project.load(),after=JSON.parse(loaded.serialized);if(JSON.stringify(after.maps)!==maps||JSON.stringify(after.spatialAuthoring)!==spatial)throw Error('Authored maps or spatial structure changed');
 for(const [id,t]of Object.entries(l.tilesets))if(JSON.stringify(after.tilesets[id])!==JSON.stringify(t))throw Error('Reference projection differs: '+id);
 for(const[id,source]of Object.entries(l.assets)){
  const asset=after.assets.uploaded[id];if(!asset?.ref||asset.kind!==source.kind||JSON.stringify(asset.meta)!==JSON.stringify(source.meta))throw Error('Saved asset metadata differs: '+id);
  const actual=await window.oprn.assets.read({projectDir:status.projectDir,sha256:asset.ref.sha256});
  const expected=Uint8Array.from(atob(source.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
  if(actual.length!==expected.length||expected.some((byte,i)=>byte!==actual[i]))throw Error('Saved asset bytes differ: '+id);
 }
 return{projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,reloadedEqual:true,unchangedMaps:Object.keys(after.maps).length,projectedTilesets:Object.keys(l.tilesets).length,reloadedAssetBytes:Object.keys(l.assets).length};
});result.saveRequests=saveRequests;await fs.writeFile(out+'/proof.json',JSON.stringify(result,null,2));console.log(result);
}finally{await b.close();}
