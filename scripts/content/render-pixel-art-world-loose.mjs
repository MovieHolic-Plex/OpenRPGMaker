// Private browser prepare/render; never calls import/store/project save.
import {chromium} from 'playwright';import{readFile,writeFile,mkdir}from'node:fs/promises';import{resolve,join}from'node:path';
const input=process.argv[2],origin=process.argv[3]??'http://127.0.0.1:9877',only=process.argv[4]?.split(',');if(!input)throw Error('Usage: node scripts/content/render-pixel-art-world-loose.mjs /absolute/downloads [origin] [packIdsCommaSeparated]');
const out=resolve('output/paw-loose/browser');await mkdir(out,{recursive:true});await writeFile(join(out,'index.html'),'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Private loose preparation</title></head><body></body></html>');
const data=JSON.parse(await readFile('src/assets/pixelArtWorldLooseCatalog.json','utf8'));const table=await readFile(join(input,data.support.filename));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[],blocked=[],report=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(['http:','https:'].includes(u.protocol)&&(u.origin!==origin||!['GET','HEAD'].includes(r.method()))){blocked.push(r.url());return route.abort();}return route.continue();});await page.goto(origin+'/output/paw-loose/browser/index.html');
 for(const pack of data.packs){
  if(only&&!only.includes(pack.id))continue;
  const relative=decodeURIComponent(new URL(pack.downloadUrl).pathname).replace(/^\/dotartworld\//,'');const bytes=await readFile(join(input,'by-source',relative));
  const result=await page.evaluate(async({id,source,support})=>{const{PIXEL_ART_WORLD_LOOSE,PIXEL_ART_WORLD_LOOSE_SUPPORT}=await import('/src/project/pixelArtWorldLoose.ts');const{preparePixelArtWorldLoose}=await import('/src/editor/pixelArtWorldLooseImport.ts');const pack=PIXEL_ART_WORLD_LOOSE.find(p=>p.id===id),f=(b,n)=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],n,{type:'image/png'});return preparePixelArtWorldLoose(f(source,pack.filename),pack,f(support,PIXEL_ART_WORLD_LOOSE_SUPPORT.filename));},{id:pack.id,source:bytes.toString('base64'),support:table.toString('base64')});
  await writeFile(join(out,`${pack.id}-prepared.json`),JSON.stringify(result,null,2)+'\n');
  const final=result.prepared[1],kits=final?.tileset.structureKits??[];
  if(kits.length!==pack.coverage.fixedObjects)throw Error(`Object count ${pack.id}`);
  for(const k of kits){if(k.rows.length!==k.height||k.rows.some(r=>r.tiles.length!==k.width||r.upperTiles.length!==k.width||r.tiles.some(t=>t!==-1))||!k.referenceDocuments?.[0]?.images?.length)throw Error(`Object metadata ${k.id}`);}
  if(final){
   await writeFile(join(out,`${pack.id}-atlas.png`),Buffer.from(final.dataUrl.split(',')[1],'base64'));
   const refs=final.tileset.referenceDocuments[0],pictures=refs.images.filter(i=>i.id.endsWith('-example'));
   const picture=await page.evaluate(async(pictures)=>{const images=[];let w=0,h=0;for(const p of pictures){const im=new Image();im.src=p.dataUrl;await im.decode();images.push(im);w=Math.max(w,(im.width-8)/2);h=Math.max(h,im.height);}const cols=Math.min(4,images.length),c=document.createElement('canvas');c.width=cols*w;c.height=Math.ceil(images.length/cols)*(h+20);const x=c.getContext('2d');x.fillStyle='#e8e5db';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.font='12px sans-serif';images.forEach((im,i)=>{x.drawImage(im,0,0,(im.width-8)/2,im.height,i%cols*w,Math.floor(i/cols)*(h+20),(im.width-8)/2,im.height);x.fillText(pictures[i].id,4+i%cols*w,Math.floor(i/cols)*(h+20)+h+14);});return c.toDataURL();},pictures);
   await writeFile(join(out,`${pack.id}-objects.png`),Buffer.from(picture.split(',')[1],'base64'));
  }
  const refs=result.prepared.flatMap(p=>p.tileset.referenceDocuments);report.push({id:pack.id,filename:pack.filename,sourceSize:[pack.width,pack.height],sourceSha256:result.sourceSha256,tilesets:result.prepared.length,objects:kits.length,sourceOnly:result.sourceOnlyRecipeIds,unassignedOpaquePixels:pack.coverage.unassignedOpaquePixels,categories:refs.length,documents:refs.reduce((n,r)=>n+r.documents.length,0),images:refs.reduce((n,r)=>n+r.images.length,0)});
  console.log(`${pack.id} ${pack.filename}: ${kits.length} objects`);
 }
 if(!only){await page.evaluate(async()=>{const{openExternalTilesetCatalog}=await import('/src/editor/panels/externalTilesetCatalog.ts');openExternalTilesetCatalog(()=>{throw Error('Unexpected mutation');});});await page.locator('article').filter({has:page.locator('[data-testid="paw-loose-105-file"]')}).screenshot({path:join(out,'24px-icons-catalog.png')});}
 const name=only?'partial-report.json':'report.json';await writeFile(join(out,name),JSON.stringify({report,errors,blocked,scope:'Prepare and Object records only; no project/DB writes.'},null,2)+'\n');
 if(!only)await writeFile(join(out,'install-plan.json'),JSON.stringify({preparedFiles:report.map(r=>({id:r.id,path:join(out,`${r.id}-prepared.json`)})),sourceCount:report.length,objects:report.reduce((n,r)=>n+r.objects,0),excluded:'Source-only anchor/fragment regions and exact per-pack uncovered geometry; see holds.',artPolicy:'User files/private derivatives only; never Git/public.',events:[]},null,2)+'\n');
 console.log(JSON.stringify({sources:report.length,objects:report.reduce((n,r)=>n+r.objects,0),errors,blocked}));if(errors.length||blocked.length)process.exitCode=1;
}finally{await browser.close();}
