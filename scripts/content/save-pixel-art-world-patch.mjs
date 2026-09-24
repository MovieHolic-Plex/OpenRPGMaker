// Apply a reviewed content patch through the running project's compare-and-swap API.
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {isDeepStrictEqual} from 'node:util';
const [host,patchPath,out]=process.argv.slice(2);
if(!host||!patchPath||!out)throw Error('Usage: <host URL> <prepared patch.json> <private output>');
const patch=JSON.parse(await fs.readFile(patchPath,'utf8'));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();try{
 const page=await browser.newPage();await page.goto(new URL('/__oprn/team',host).href);await page.waitForFunction(()=>window.oprn?.project);
 const status=await page.evaluate(()=>window.oprn.project.status()),before=await page.evaluate(()=>window.oprn.project.load());
 if(patch.sourceProjectId&&status.projectId!==patch.sourceProjectId)throw Error('Canonical project identity changed');
 const project=JSON.parse(before.serialized);
 for(const section of ['maps','tilesets'])for(const[id,value]of Object.entries(patch[section])){
  const basis=patch[section==='maps'?'beforeMaps':'beforeTilesets'][id];
  if(!basis||!isDeepStrictEqual(project[section][id],basis))throw Error('Target changed since preparation: '+section+'/'+id);
  project[section][id]=value;
 }
 for(const[id]of Object.entries(patch.assets??{}))if(!Object.hasOwn(patch.beforeAssets??{},id)||!isDeepStrictEqual(project.assets.uploaded[id]??null,patch.beforeAssets[id]))throw Error('Asset changed since preparation: '+id);
 await fs.writeFile(out+'/before-host.json',JSON.stringify(before));await page.evaluate(projectDir=>window.oprn.project.backup({projectDir}),status.projectDir);
 for(const[id,source]of Object.entries(patch.assets??{})){
  if(!source.dataUrl?.startsWith('data:image/png;base64,'))throw Error('Prepared PNG required '+id);
  const asset=await page.evaluate(async({source,projectDir})=>{
   const asset=structuredClone(source),bytes=Uint8Array.from(atob(asset.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
   const put=await window.oprn.assets.put({projectDir,bytes,mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});
   delete asset.dataUrl;asset.ref=put.ref;return asset;
  },{source,projectDir:status.projectDir});project.assets.uploaded[id]=asset;
 }
 const save=await page.evaluate(payload=>window.oprn.project.save(payload),{projectDir:status.projectDir,serialized:JSON.stringify(project),expectedSha:before.sha256});
 if(save.kind!=='saved')throw Error('Canonical CAS rejected: '+save.kind);
 const reload=await page.evaluate(()=>window.oprn.project.load());const after=JSON.parse(reload.serialized);
 if(!isDeepStrictEqual(after.maps,project.maps)||!isDeepStrictEqual(after.tilesets,project.tilesets)||!isDeepStrictEqual(after.assets,project.assets))throw Error('Reload differs from content patch');
 await fs.writeFile(out+'/canonical-reloaded.json',reload.serialized);
 const proof={projectId:status.projectId,projectDir:status.projectDir,host,revision:reload.revision,sha256:reload.sha256,reloadedEqual:true,changedMaps:Object.keys(patch.maps),changedTilesets:Object.keys(patch.tilesets),changedAssets:Object.keys(patch.assets??{})};
 await fs.writeFile(out+'/storage-proof.json',JSON.stringify(proof,null,2));console.log(proof);
}finally{await browser.close();}
