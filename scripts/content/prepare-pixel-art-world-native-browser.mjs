// Generate project-owned AI references through the actual browser importer.
// Inputs and rendered pixels remain in the user's local directories.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const [devUrl,catalogFile,sourceDirectory,out]=process.argv.slice(2);
if(!devUrl||!catalogFile||!sourceDirectory||!out)throw Error('Usage: <dev URL> <catalog.json> <user PNG directory> <private output>');
const packs=JSON.parse(await fs.readFile(catalogFile,'utf8'));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
try {
 const page=await browser.newPage(), errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/__paw-native-prepare',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local reference preparation</title>'}));
 await page.goto(new URL('/__paw-native-prepare',devUrl).href);
 const reports=[];
 for(const pack of packs){
  const bytes=await fs.readFile(path.join(sourceDirectory,pack.filename));
  const prepared=await page.evaluate(async({pack,base64})=>{
   const {EXTERNAL_TILESET_PACKS}=await import('/src/project/externalTilesetCatalog.ts');
   const {prepareExternalTileset}=await import('/src/editor/externalTilesetImport.ts');
   const registered=EXTERNAL_TILESET_PACKS.find(p=>p.id===pack.id);
   if(JSON.stringify(registered)!==JSON.stringify(pack))throw Error('Served catalog differs '+pack.id);
   const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],pack.filename,{type:'image/png'});
   return prepareExternalTileset(file,registered);
  },{pack,base64:bytes.toString('base64')});
  await fs.writeFile(path.join(out,pack.id+'-prepared.json'),JSON.stringify(prepared));
  const refs=prepared.tileset.referenceDocuments;
  for(const scene of pack.scenes??[]){
   const ref=refs.find(r=>r.id==='scene-'+scene.id);
   if(!ref?.documents.some(d=>d.markdown.includes(JSON.stringify(scene,null,2))))throw Error('Scene arrays differ '+scene.id);
   const image=ref.images[0];
   if(!image?.dataUrl.startsWith('data:image/png;base64,'))throw Error('Scene image missing '+scene.id);
   await fs.writeFile(path.join(out,scene.id+'.png'),Buffer.from(image.dataUrl.split(',')[1],'base64'));
  }
  reports.push({id:pack.id,sha256:pack.sha256,scenes:pack.scenes?.length??0,parts:pack.recipes.length,categories:refs.length,documents:refs.reduce((n,r)=>n+r.documents.length,0),images:refs.reduce((n,r)=>n+r.images.length,0)});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await fs.writeFile(path.join(out,'proof.json'),JSON.stringify({reports,errors,scope:'Browser importer preparation; canonical save and shared publication are separate.'},null,2));
 console.log(reports);
}finally{await browser.close();}
