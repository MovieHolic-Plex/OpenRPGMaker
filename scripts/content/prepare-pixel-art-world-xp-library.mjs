// Bake user-owned XP originals through the editor importer. No artwork belongs in Git.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import pngjs from 'pngjs';

const [devUrl, sourceIndex, sourceProof, output] = process.argv.slice(2);
if (!output) throw Error('Usage: <dev URL> <private source plan.json> <canonical source-proof.json> <private output>');
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const index = await read(sourceIndex), proof = await read(sourceProof);
if (!proof.projectId || !proof.sha256 || !proof.projectDir) throw Error('Canonical source receipt required');
const layout = await read('tiledata/pixel-art-world/xp-library-layout.json');
const catalog = await read('src/assets/pixelArtWorldAutotiles.json');
const hash = b => createHash('sha256').update(b).digest('hex');
const { PNG } = pngjs;
const seedAtlas = new PNG({width:512,height:32});
const seeds = [];
for (const [tile, seed] of layout.backingSeeds.entries()) {
  const filename = index.backingSeeds.find(s => s.key === seed.key)?.localPath;
  if (!filename) throw Error('Missing local seed: '+seed.key);
  const bytes = await fs.readFile(filename);
  if (hash(bytes) !== seed.sha256) throw Error('Seed SHA mismatch: '+seed.key);
  const source = PNG.sync.read(bytes), r = seed.sourceRectPixels;
  if (r.width !== 32 || r.height !== 32 || r.x+r.width>source.width || r.y+r.height>source.height) throw Error('Invalid seed rectangle');
  PNG.bitblt(source,seedAtlas,r.x,r.y,32,32,tile*32,0);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(seedAtlas.data[(y*512+tile*32+x)*4+3]!==255)throw Error('Seed must be opaque: '+seed.key);
  seeds.push({...seed,tile});
}
const packFiles = {};
for(const pack of catalog){
  const filename = index.pathByPackId[pack.id];
  if(!filename)throw Error('Missing source: '+pack.id);
  const bytes = await fs.readFile(filename), source = PNG.sync.read(bytes);
  if(hash(bytes)!==pack.sha256 || source.width!==pack.sourceWidth || source.height!==pack.sourceHeight)throw Error('Source identity mismatch: '+pack.id);
  packFiles[pack.id]=bytes.toString('base64');
}
const listed=layout.atlases.flatMap(a=>a.packIds);
if(new Set(listed).size!==catalog.length || listed.length!==catalog.length || catalog.some(p=>!listed.includes(p.id)))throw Error('Grouping must cover each registered SHA once');
await fs.mkdir(output,{recursive:true});
const lib={version:1,projectDefaults:true,roots:[],places:{},regions:{},tilesets:{},assets:{},maps:{},sourceProjectId:proof.projectId,previews:{}};
const observations=[],browserErrors=[];
const browser=await chromium.launch();
try {
  const page=await browser.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
  await page.route('**/__paw-xp-builder',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Local XP atlas preparation</title>'}));
  await page.goto(new URL('/__paw-xp-builder',devUrl).href);
  for(const group of layout.atlases){
    const prepared=await page.evaluate(async({group,seeds,sourceData,files,requirements})=>{
      const {preparePixelArtWorldAutotile}=await import('/src/editor/pixelArtWorldAutotileImport.ts');
      const {PIXEL_ART_WORLD_AUTOTILES,XP_AUTOTILE_MASKS,normalizeXpAutotileMask}=await import('/src/project/pixelArtWorldAutotiles.ts');
      const {autotileNeighborMask}=await import('/src/project/defaults/autotileEngine.ts');
      const {validateTileset}=await import('/src/project/io/shapeResourceFields.ts');
      const json=x=>'```json\n'+JSON.stringify(x)+'\n```';
      const decode=async url=>{const im=new Image();im.src=url;await im.decode();return im;};
      let image=await decode(sourceData),dataUrl=sourceData;
      const pass=i=>i<seeds.length&&seeds[i].passage==='passable';
      let target={id:group.id,name:'Pixel Art World · '+group.name,kind:'custom',tileSize:32,tilesPerRow:16,count:16,image:{type:'uploaded',id:group.id+'_image'},passability:Array.from({length:16},(_,i)=>({up:pass(i),down:pass(i),left:pass(i),right:pass(i)})),priority:Array(16).fill('lower'),terrain:Array(16).fill(0),tileMeta:Array.from({length:16},(_,i)=>({label:seeds[i]?.key??'정렬 공백',description:seeds[i]?.note??'배치 금지',defaultLayer:'lower',passage:pass(i)?'passable':'solid',source:'imported'})),structureKits:[],referenceDocuments:[{id:'local-backing',name:'받침 사전과 조립 범위',description:'원본 픽셀에서 얻은 벽·바닥·지붕·물 바탕. 완성 장소가 아니다.',documents:[{id:'seeds',name:'원본 받침 사전.md',markdown:'# 받침 사전\n\n'+json(seeds)+'\n\n0기준 픽셀 사각형을 32px 그대로 복사했다. tile 9..15는 정렬 공백, 배치하지 않는다. 벽 받침은 정면 벽 가운데 부분이며 천장·벽 상단·하단을 대신하지 않는다. 수면 받침은 정적 바탕이며 수로 애니메이션은 별도 animationStrips를 사용한다.\n\n각 오브젝트는 4×3 재료 조립 표본이다. 건물·방·작동하는 문을 뜻하지 않는다. 출입구·이벤트·동선과 주변 재료 접합은 장소별로 저작한다.\n\n![받침](image:seeds)'}],images:[{id:'seeds',name:'seed-atlas.png',caption:'0..8 원본 받침, 9..15 빈 정렬칸',dataUrl:sourceData}]}]};
      const imports=[];
      for(const id of group.packIds){
        const pack=PIXEL_ART_WORLD_AUTOTILES.find(p=>p.id===id);
        const requirement=requirements.find(r=>r.packId===id);
        const backingKey=requirement?.recommendedBackingKeys[0]??group.defaultBackingKey;
        const backing=seeds.find(s=>s.key===backingKey);
        if(!backing)throw Error('Missing backing '+id);
        const file=new File([Uint8Array.from(atob(files[id]),c=>c.charCodeAt(0))],pack.filename,{type:'image/png'});
        const p=await preparePixelArtWorldAutotile(file,pack,target,image,{referenceBackingTile:backing.tile,referenceBackingLabel:backing.key});
        const oldCount=target.count;target=p.tileset;dataUrl=p.dataUrl;image=await decode(dataUrl);
        if(p.offset!==Math.ceil(oldCount/16)*16)throw Error('Unexpected import offset');
        const category=target.referenceDocuments.find(c=>c.id===id);
        // A material swatch is deliberately smaller than the connection-diagnostic sheet.
        const width=4,height=3,footprint={width,height,lowerTiles:Array(width*height).fill(0)};
        const placed=footprint.lowerTiles.map((_,i)=>p.tileIds[XP_AUTOTILE_MASKS.indexOf(normalizeXpAutotileMask(autotileNeighborMask(footprint,i%width,Math.floor(i/width),t=>t===0,8)))]);
        const lower=pack.defaultLayer==='lower'?placed:Array(width*height).fill(backing.tile);
        const upper=pack.defaultLayer==='upper'?placed:Array(width*height).fill(-1);
        const canvas=document.createElement('canvas');canvas.width=width*32;canvas.height=height*32;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
        for(const values of [lower,upper])values.forEach((t,i)=>{if(t>=0)ctx.drawImage(image,t%16*32,Math.floor(t/16)*32,32,32,i%width*32,Math.floor(i/width)*32,32,32);});
        const sample=canvas.toDataURL('image/png');
        const template=requirement?.status==='editing-template-not-finished-scene';
        if(!template){
          const instructions=`tilesetId=${group.id}. 4×3 전체 배열의 원점을 정해 배치한다. 원본 ${pack.filename}, SHA ${pack.sha256}. 홈=${pack.defaultLayer}, 통행=${pack.passage}, 받침=${backing.key}(tile ${backing.tile}). ${requirement?.note??''} ${pack.restrictions.join(' ')} 원본 픽셀 반전/늘이기 금지. 고정 표본을 큰 면으로 반복하면 내부 경계가 생기므로 큰 면은 같은 소재 마스크를 재계산한다. 문 그림은 이벤트가 아니다.`;
          const assembly={id:'swatch',name:'4×3 전체 조립',description:'실제 소재의 고정 조립 표본, 완성 장소 아님',documents:[{id:'arrays',name:'배치 배열.md',markdown:instructions+'\n\n'+json({width,height,lowerTiles:lower,upperTiles:upper})+'\n\n![실제 조립](image:swatch)'}],images:[{id:'swatch',name:id+'.png',caption:pack.name+' · '+backing.key+' 받침',dataUrl:sample}]};
          target.structureKits.push({id:id+'_swatch',kind:'section',name:pack.name+' · 4×3 조립 표본',width,height,tileSize:32,rows:Array.from({length:height},(_,y)=>({tiles:lower.slice(y*width,(y+1)*width),upperTiles:upper.slice(y*width,(y+1)*width)})),learnedFrom:'db-authored',referenceDocuments:[assembly,structuredClone(category)],ai:{description:'재료 조립 표본. 방/시설이 아니다.',placementRules:instructions,repeatability:'fixed',layerHome:pack.defaultLayer==='upper'?'perCell':'lower',origin:'ai',tags:['Pixel Art World','XP','조립 표본',backing.key]}});
        }
        imports.push({id,offset:p.offset,tileIds:p.tileIds,backingKey,backingTile:backing.tile,frames:pack.frames,template,sample});
      }
      if(target.count!==group.finalCount)throw Error('Atlas count differs from grouping');
      const previousId=target.id;target.id='shared_'+previousId.replaceAll('-','_');const assetId=target.id+'_image';target.image={type:'uploaded',id:assetId};
      for(const cat of [...target.referenceDocuments,...target.structureKits.flatMap(k=>k.referenceDocuments)])for(const doc of cat.documents)doc.markdown=doc.markdown.replaceAll(previousId,target.id);
      for(const kit of target.structureKits){kit.id='shared_'+kit.id.replaceAll('-','_');kit.ai.placementRules=kit.ai.placementRules.replaceAll(previousId,target.id);}
      validateTileset(target.id,target);
      return {tileset:target,asset:{id:assetId,name:previousId+'.png',kind:'chipset',dataUrl,meta:{tileSize:32,frameWidth:32,frameHeight:32,width:image.width,height:image.height,frames:target.count}},imports};
    },{group,seeds,sourceData:'data:image/png;base64,'+PNG.sync.write(seedAtlas).toString('base64'),files:Object.fromEntries(group.packIds.map(id=>[id,packFiles[id]])),requirements:layout.underlayRequirements});
    lib.tilesets[prepared.tileset.id]=prepared.tileset;lib.assets[prepared.asset.id]=prepared.asset;
    for(const item of prepared.imports){await fs.writeFile(path.join(output,item.id+'.png'),Buffer.from(item.sample.split(',')[1],'base64'));delete item.sample;}
    observations.push({id:prepared.tileset.id,count:prepared.tileset.count,objects:prepared.tileset.structureKits.length,imports:prepared.imports});
    console.log(group.id,prepared.imports.length,'sources prepared');
  }
} finally {await browser.close();}
if(browserErrors.length)throw Error('Browser errors: '+browserErrors.join('; '));
const serialized=JSON.stringify(lib);
await fs.writeFile(path.join(output,'library.json'),serialized);
await fs.writeFile(path.join(output,'preparation-proof.json'),JSON.stringify({source:proof,librarySha256:hash(serialized),catalogSha256:hash(await fs.readFile('src/assets/pixelArtWorldAutotiles.json')),layoutSha256:hash(await fs.readFile('tiledata/pixel-art-world/xp-library-layout.json')),sources:catalog.length,atlases:observations,objects:observations.reduce((n,a)=>n+a.objects,0),browserErrors,pixels:'User local only; unreviewed specimens are not completed places.'},null,2));
console.log({output,tilesets:Object.keys(lib.tilesets).length,sources:catalog.length});
