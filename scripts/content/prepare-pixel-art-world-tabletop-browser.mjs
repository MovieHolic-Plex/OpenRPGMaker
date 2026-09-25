// Append verified source-pixel furniture without changing existing tile IDs. No DB writes.
import fs from 'node:fs/promises';import path from 'node:path';import{createHash}from'node:crypto';import{chromium}from'playwright';
const[input,sources,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);if(!input||!sources||!out)throw Error('Usage: <host portable> <user originals directory> <private output> [dev URL]');
const project=JSON.parse(await fs.readFile(input,'utf8'));const recipes=JSON.parse(await fs.readFile('src/assets/pixelArtWorldTabletopComposites.json','utf8'));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();try{
 const page=await browser.newPage();await page.route('**/__paw-tabletop',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-tabletop');
 const library={tilesets:{},assets:{}},beforeTilesets={},reports=[];
 for(const packId of new Set(recipes.map(r=>r.packId))){
  const r=recipes.find(r=>r.packId===packId),tile=project.tilesets[packId],asset=project.assets.uploaded[tile.image.id];const bytes=await fs.readFile(path.join(sources,r.sourceFilename));
  if(createHash('sha256').update(bytes).digest('hex')!==r.sourceSha256)throw Error('Source SHA differs '+packId);
  const prepared=await page.evaluate(async({tile,asset,base64,packId})=>{
   const pack=(await import('/src/project/externalTilesetCatalog.ts')).EXTERNAL_TILESET_PACKS.find(p=>p.id===packId);
   const {appendPixelArtWorldComposites}=await import('/src/editor/pixelArtWorldComposites.ts');
   const decode=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
   const source=await decode('data:image/png;base64,'+base64),current=await decode(asset.dataUrl);
   const r=appendPixelArtWorldComposites(pack,source,tile,current);if(!r)throw Error('Missing composite catalog');
   const id=packId+'-tabletop-v1';r.tileset.image={type:'uploaded',id};
   for(const key of ['passability','priority','terrain'])if(JSON.stringify(r.tileset[key].slice(0,tile.count))!==JSON.stringify(tile[key]))throw Error('Old tile metadata changed');
   const {validateTileset}=await import('/src/project/io/shapeResourceFields.ts');
   validateTileset(r.tileset.id,r.tileset);
   return{...r,asset:{id,name:pack.name+' · 상판 조립',kind:'chipset',dataUrl:r.dataUrl,meta:{tileSize:32,width:r.imageWidth,height:r.imageHeight,frameWidth:32,frameHeight:32,frames:r.tileset.count}}};
  },{tile,asset,packId,base64:bytes.toString('base64')});
  beforeTilesets[packId]=tile;library.tilesets[packId]=prepared.tileset;library.assets[prepared.asset.id]=prepared.asset;
  const category=prepared.tileset.referenceDocuments.find(c=>c.id==='paw-tabletop-composites');
  for(const image of category.images)await fs.writeFile(path.join(out,image.id+'.png'),Buffer.from(image.dataUrl.split(',')[1],'base64'));
  reports.push({id:packId,beforeCount:tile.count,count:prepared.tileset.count,placements:prepared.placements,sourceSha:r.sourceSha256});
 }
 await fs.writeFile(out+'/library.json',JSON.stringify(library));await fs.writeFile(out+'/before-tilesets.json',JSON.stringify(beforeTilesets));await fs.writeFile(out+'/proof.json',JSON.stringify({reports,oldTilesPreserved:true,noSave:true},null,2));console.log(reports);
}finally{await browser.close();}
