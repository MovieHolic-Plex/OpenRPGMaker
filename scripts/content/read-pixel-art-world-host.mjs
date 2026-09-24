// Read the active canonical host and resolve only Pixel Art World image dependencies.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [host,out]=process.argv.slice(2);
if(!host||!out)throw Error('Usage: <canonical host URL> <private output directory>');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage();
 await page.goto(new URL('/__oprn/team',host).href);
 await page.waitForFunction(()=>window.oprn?.project);
 const doorIds=JSON.parse(await fs.readFile('src/assets/pixelArtWorldDoors.json','utf8')).map(p=>'shared_'+p.id.replaceAll('-','_'));
 const eventIds=JSON.parse(await fs.readFile('src/assets/pixelArtWorldEventProps.json','utf8')).packs.filter(p=>p.rights.runtimeImportAllowed).map(p=>'shared_'+p.id.replaceAll('-','_'));
 const result=await page.evaluate(async(spriteIds)=>{
  const status=await window.oprn.project.status(),loaded=await window.oprn.project.load();
  const project=JSON.parse(loaded.serialized);
  const used=new Set(Object.values(project.tilesets).filter(t=>t.id.startsWith('paw-')||t.id.startsWith('shared_paw_')).map(t=>t.image.id));
  for(const id of spriteIds)if(project.assets.uploaded[id])used.add(id);
  for(const id of used){
   const asset=project.assets.uploaded[id];
   if(!asset.dataUrl&&asset.ref){
    const bytes=await window.oprn.assets.read({projectDir:status.projectDir,sha256:asset.ref.sha256});
    let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    asset.dataUrl='data:image/png;base64,'+btoa(binary);delete asset.ref;
   }
  }
  return{project,proof:{projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256}};
 },[...doorIds,...eventIds]);
 const serialized=JSON.stringify(result.project);
 result.proof.portableSha256=createHash('sha256').update(serialized).digest('hex');
 await fs.writeFile(`${out}/current-portable.json`,serialized);
 await fs.writeFile(`${out}/source-proof.json`,JSON.stringify(result.proof,null,2));
 console.log(result.proof);
}finally{await browser.close();}
