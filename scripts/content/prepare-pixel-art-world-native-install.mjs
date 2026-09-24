// Package verified importer results for canonical installation; artwork stays user-local.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [catalogFile,preparedDirectory,out]=process.argv.slice(2);
if(!catalogFile||!preparedDirectory||!out)throw Error('Usage: <catalog.json> <prepared directory> <private output>');
const packs=JSON.parse(await fs.readFile(catalogFile,'utf8')),lib={tilesets:{},assets:{}};
for(const pack of packs){
 const prepared=JSON.parse(await fs.readFile(preparedDirectory+'/'+pack.id+'-prepared.json','utf8'));
 const bytes=Buffer.from((prepared.sourceDataUrl??prepared.dataUrl).split(',')[1],'base64');
 if(createHash('sha256').update(bytes).digest('hex')!==pack.sha256)throw Error('Prepared source hash differs: '+pack.id);
 const tile=prepared.tileset,previousId=tile.id,id=pack.id+'-source';
 const width=prepared.imageWidth??pack.width,height=prepared.imageHeight??pack.height;
 if(tile.count!==width*height/1024||width!==pack.width||height<pack.height||tile.tileSize!==32||tile.tilesPerRow!==8)throw Error('Prepared dimensions differ: '+pack.id);
 tile.id=pack.id;tile.image={type:'uploaded',id};
 for(const category of tile.referenceDocuments)for(const document of category.documents)document.markdown=document.markdown.replaceAll(previousId,tile.id);
  for(const kit of tile.structureKits??[])for(const category of kit.referenceDocuments??[])for(const document of category.documents)document.markdown=document.markdown.replaceAll(previousId,tile.id);
 for(const scene of pack.scenes??[]){
  const category=tile.referenceDocuments.find(c=>c.id==='scene-'+scene.id),document=category?.documents.find(d=>d.id==='layout');
  if(!document?.markdown.includes(JSON.stringify(scene,null,2)))throw Error('Prepared scene is stale: '+scene.id);
 }
 lib.tilesets[tile.id]=tile;lib.assets[id]={id,name:pack.filename,kind:'chipset',dataUrl:prepared.dataUrl,meta:{tileSize:32,width,height,frameWidth:32,frameHeight:32,frames:tile.count}};
}
await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/library.json',JSON.stringify(lib));console.log({packs:Object.keys(lib.tilesets),pixels:'local-only'});
