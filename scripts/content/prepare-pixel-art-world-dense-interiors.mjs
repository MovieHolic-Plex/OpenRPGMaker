// Metadata + user-local rendered references. Does not download or publish pixels.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
const [input,nativeLibrary,out,origin='http://127.0.0.1:9816']=process.argv.slice(2);
if(!input||!nativeLibrary||!out)throw Error('Usage: <canonical portable> <prepared Japanese library> <private output> [dev URL]');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const p=await read(input),native=await read(nativeLibrary),plans=await read('tiledata/pixel-art-world/house-variants.json');
const source=await read(path.join(path.dirname(input),'source-proof.json'));
if(p.tilesets['paw-izakaya']?.autotileGroups?.some(g=>g.id==='paw-wall-a01'))throw Error('Ceiling already installed; do not downgrade to the intermediate 480-tile layout. Use prepare-pixel-art-world-izakaya-ceiling.mjs.');
if(!source.projectId||source.portableSha256!==hashInput(await fs.readFile(input)))throw Error('Canonical source receipt differs');
function hashInput(bytes){return createHash('sha256').update(bytes).digest('hex');}
const home=await read('tiledata/pixel-art-world/compact-homes.json');
const recipes=(await read('src/assets/pixelArtWorldHomeCatalog.json')).find(p=>p.id==='paw-home').recipes;
const hash=s=>createHash('sha256').update(s).digest('hex');
if(hash(Buffer.from(p.assets.uploaded[p.tilesets['paw-home'].image.id].dataUrl.split(',')[1],'base64'))!==home.tilesetImageSha256)throw Error('Home atlas differs');
const tile=structuredClone(p.tilesets['paw-home']),maps={},metadata={};
for(const s of Object.values(plans.maps)){
 const n=s.width*s.height,lower=Array(n).fill(s.baseTile),upper=Array(n).fill(-1);
 const ix=(x,y)=>{if(x<0||y<0||x>=s.width||y>=s.height)throw Error('Bounds');return y*s.width+x;};
 for(const r of s.wallRects)for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)lower[ix(r.x+x,r.y+y)]=s.wallFaceRows[y];
 for(const r of s.floorRects)for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)lower[ix(r.x+x,r.y+y)]=r.tile;
 const ceiling=new Set(s.ceilingCells.map(c=>ix(c.x,c.y))),group=tile.autotileGroups.find(g=>g.id===s.ceilingGroupId);
 const dirs=[[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]];
 for(const c of s.ceilingCells){let mask=0;for(const[dx,dy,bit]of dirs){const x=c.x+dx,y=c.y+dy;if(x>=0&&y>=0&&x<s.width&&y<s.height&&ceiling.has(ix(x,y)))mask|=bit;}lower[ix(c.x,c.y)]=group.variantMap[mask];}
 for(const placement of s.placements){
  const r=recipes.find(r=>r.id===placement.recipeId);if(!r)throw Error('Missing recipe');
  const q=r.sourceRect;
  for(let y=0;y<q.height;y++)for(let x=0;x<q.width;x++){const at=ix(placement.x+x,placement.y+y);if(upper[at]!==-1)throw Error('Furniture overlap');upper[at]=(q.y+y)*8+q.x+x;}
  for(const c of r.supportCells){const floor=lower[ix(placement.x+c.x,placement.y+c.y)];if(!(r.placementKind==='wall-mounted'?s.wallFaceRows:s.floorTileIds).includes(floor))throw Error('Unsupported '+r.id);}
 }
 const m={id:s.id,name:s.name,width:s.width,height:s.height,tileSize:32,tilesetId:s.tilesetId,lowerTiles:lower,upperTiles:upper,events:[],encounterRate:0,climate:{mode:'indoor'}};
 maps[m.id]=m;metadata[m.id]={...s,lowerTiles:lower,upperTiles:upper};
}
const scene=(await read('src/assets/pixelArtWorldJapaneseInteriorsLayout.json')).find(p=>p.packId==='paw-izakaya').scenes[0];
const izakaya=structuredClone(p.tilesets['paw-izakaya']);
// The composite atlas remains byte-identical; retain project custom references.
if(native.assets['paw-izakaya-source'].dataUrl!==p.assets.uploaded[izakaya.image.id].dataUrl)throw Error('Unexpected atlas change');
for(const c of native.tilesets['paw-izakaya'].referenceDocuments){const i=izakaya.referenceDocuments.findIndex(old=>old.id===c.id);if(i<0)izakaya.referenceDocuments.push(c);else izakaya.referenceDocuments[i]=c;}
const id='paw-izakaya-dense';
maps[id]={id,name:scene.name,width:scene.width,height:scene.height,tileSize:32,tilesetId:izakaya.id,lowerTiles:scene.lowerTiles,upperTiles:scene.upperTiles,events:[],encounterRate:0,climate:{mode:'indoor'}};
metadata[id]={...scene,id,spawn:{x:4,y:13,direction:'up'},exitTrigger:{x:4,y:14},designNotes:[scene.notes,'독립 표본. 도시 출입 연결·착석·주문 이벤트는 별도 저작한다.']};
const tilesets={[tile.id]:tile,[izakaya.id]:izakaya};
const assets=Object.fromEntries(Object.values(tilesets).map(t=>[t.image.id,p.assets.uploaded[t.image.id]]));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
let result;
try{
 const page=await browser.newPage();await page.route('**/__paw-dense',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto(origin+'/__paw-dense');
 result=await page.evaluate(async({maps,tilesets,assets,metadata})=>{
  const {canMove}=await import('/src/project/collision.ts');
  const pictures={},movement=[];
  for(const m of Object.values(maps)){
   const s=metadata[m.id],q=[s.spawn],seen=new Set([s.spawn.y*m.width+s.spawn.x]);
   for(let k=0;k<q.length;k++)for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const a=q[k],x=a.x+dx,y=a.y+dy,n=y*m.width+x;if(!seen.has(n)&&canMove({tilesets},m,a.x,a.y,x,y)){seen.add(n);q.push({x,y});}}
   for(const t of [...s.approachCells,s.exitTrigger])if(!seen.has(t.y*m.width+t.x))throw Error('Unreachable '+m.id+'/'+JSON.stringify(t));
   const t=tilesets[m.tilesetId],im=new Image();im.src=assets[t.image.id].dataUrl;await im.decode();
   const c=document.createElement('canvas');c.width=m.width*32;c.height=m.height*32;const ctx=c.getContext('2d');
   for(const layer of [m.lowerTiles,m.upperTiles])layer.forEach((t,n)=>{if(t>=0)ctx.drawImage(im,t%8*32,Math.floor(t/8)*32,32,32,n%m.width*32,Math.floor(n/m.width)*32,32,32);});
   pictures[m.id]=c.toDataURL();movement.push({id:m.id,reachable:seen.size,targets:s.approachCells.length+1});
  }
  return {pictures,movement};
 },{maps,tilesets,assets,metadata});
}finally{await browser.close();}
for(const[id,m]of Object.entries(maps)){
 const s=metadata[id],image=result.pictures[id];
 await fs.writeFile(`${out}/${id}.png`,Buffer.from(image.split(',')[1],'base64'));
 const category={id:'assembled-'+id,name:m.name,description:'방 구획·가구 원점·지지와 접근칸·전체 배열. 외부 연결 없는 독립 저작 표본.',documents:[{id:'layout',name:'전체 배열과 동선.md',markdown:`# ${m.name}\n\n${s.designNotes.join('\n\n')}\n\n0기준 32px, 현재 ${m.tilesetId} 전용 배열. 같은 타일셋의 객체 정상/오류 그림과 지지칸 문서를 함께 읽는다.\n\n\`\`\`json\n${JSON.stringify({map:m,...s},null,2)}\n\`\`\`\n\n![실제 배치](image:scene)`}],images:[{id:'scene',name:id+'.png',caption:m.name+' · 실제 원본 타일',dataUrl:image}]};
 const t=tilesets[m.tilesetId];t.referenceDocuments=t.referenceDocuments.filter(c=>c.id!==category.id).concat(category);
}
await fs.writeFile(`${out}/patch.json`,JSON.stringify({sourceProjectId:source.projectId,maps,tilesets,beforeMaps:Object.fromEntries(Object.keys(maps).map(id=>[id,p.maps[id]??null])),beforeTilesets:Object.fromEntries(Object.keys(tilesets).map(id=>[id,p.tilesets[id]])),movement:result.movement}));
await fs.writeFile('tiledata/pixel-art-world/dense-interiors-compiled.json',JSON.stringify({maps:metadata},null,2)+'\n');
console.log(result.movement);
