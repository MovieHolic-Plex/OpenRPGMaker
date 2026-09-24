// Save through the running host, never by opening its SQLite database for writing.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
const [host,out]=process.argv.slice(2);
if(!host||!out)throw Error('Usage: <host URL> <private authoring output directory>');
const basis=JSON.parse(await readFile(`${out}/before-host.json`,'utf8'));
const authored=JSON.parse(await readFile(`${out}/authored.json`,'utf8'));
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(new URL('/__oprn/team',host).href);
 await page.waitForFunction(()=>window.oprn?.project);
 const status=await page.evaluate(()=>window.oprn.project.status());
 const current=await page.evaluate(()=>window.oprn.project.load());
 if(current.sha256!==basis.sha256)throw Error('Host changed since the authoring snapshot; reload and reconcile first');
 await page.evaluate(projectDir=>window.oprn.project.backup({projectDir}),status.projectDir);
 for(const asset of Object.values(authored.assets.uploaded))if(asset.dataUrl){
  const result=await page.evaluate(async({asset,projectDir})=>{
   const bytes=Uint8Array.from(atob(asset.dataUrl.split(',')[1]),c=>c.charCodeAt(0));
   return window.oprn.assets.put({projectDir,bytes,mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});
  },{asset,projectDir:status.projectDir});asset.ref=result.ref;delete asset.dataUrl;
 }
 const result=await page.evaluate(payload=>window.oprn.project.save(payload),{projectDir:status.projectDir,serialized:JSON.stringify(authored),expectedSha:basis.sha256});
 if(result.kind!=='saved')throw Error('Host save was rejected: '+result.kind);
 const reload=await page.evaluate(()=>window.oprn.project.load());const project=JSON.parse(reload.serialized);
 if(!isDeepStrictEqual(project.maps,authored.maps)||!isDeepStrictEqual(project.spatialAuthoring,authored.spatialAuthoring))throw Error('Host reload changed authored maps or room structure');
 await writeFile(`${out}/canonical-reloaded.json`,reload.serialized);
 const proof={projectId:status.projectId,projectDir:status.projectDir,host,revision:reload.revision,sha256:reload.sha256,reloadedThroughHost:true};
 await writeFile(`${out}/storage-proof.json`,JSON.stringify(proof,null,2));
 for(const asset of Object.values(project.assets.uploaded))if(asset.ref){
  const base64=await page.evaluate(async({sha256,projectDir})=>{
   const bytes=await window.oprn.assets.read({sha256,projectDir});let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);
  },{sha256:asset.ref.sha256,projectDir:status.projectDir});asset.dataUrl='data:image/png;base64,'+base64;delete asset.ref;
 }
 await writeFile(`${out}/reloaded-portable.json`,JSON.stringify(project));console.log(proof);
}finally{await browser.close();}
