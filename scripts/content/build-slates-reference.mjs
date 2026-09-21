// Rebuild editable 32px maps from source-atlas drawing recipes. Reference screenshots
// are not an input: every output pixel comes from an attributed Slates atlas.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const input = process.argv[2] ?? 'output/slates-reference/source-project.json';
const out = process.argv[3] ?? 'verify-shots/slates-reference';
const project = JSON.parse(await readFile(input, 'utf8'));
const manifest = JSON.parse(await readFile('public/assets/slates/slates-reference-recipes.json', 'utf8'));
const images = await Promise.all(manifest.sources.map(async p => 'data:image/png;base64,' + (await readFile(p)).toString('base64')));
const specs = [
  { source: 'NewVersion_0', id: 'slates_harbor', name: 'Slates · 항구의 여관', start: { x: 11, y: 8 },
    paths: [[0,0,1,2],[3,0,7,1],[2,1,5,1],[4,2,5,5],[0,4,1,6],[3,6,8,8],[9,7,16,7],[11,8,11,13],[3,13,14,13]], blocked: [[0,0],[7,1],[8,6]] },
  { source: 'ville_0', id: 'slates_town', name: 'Slates · 성문과 상점가', start: { x: 6, y: 8 },
    paths: [[4,0,4,2],[7,0,7,3],[13,0,13,5],[4,3,8,3],[6,4,8,4],[6,5,6,8],[1,8,6,8],[6,9,7,10],[7,9,16,9],[12,6,12,8]], blocked: [[7,4],[1,8]] },
  { source: 'chateau', id: 'slates_castle', name: 'Slates · 푸른 깃발의 성', start: { x: 8, y: 12 },
    paths: [[0,3,0,14],[16,3,16,14],[4,5,12,5],[0,6,16,7],[7,6,9,8],[6,8,10,10],[5,10,11,11],[3,12,13,12],[0,13,16,13],[2,10,3,11],[12,10,12,11]], blocked: [[5,5],[11,5],[6,6],[6,7],[10,6],[10,7],[2,6],[14,6],[8,9],[8,10],[7,12],[9,12]] },
];
const walk = spec => {
  const cells = Array(255).fill(false);
  for (const [x0,y0,x1,y1] of spec.paths) for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) cells[y*17+x]=true;
  for (const [x,y] of spec.blocked) cells[y*17+x]=false;
  if (!cells[spec.start.y*17+spec.start.x]) throw Error('Blocked spawn: '+spec.id);
  return cells;
};
const browser = await chromium.launch();
let rendered;
try {
  const page = await browser.newPage();
  rendered = await page.evaluate(async ({manifest,images,specs}) => {
    const loaded = await Promise.all(images.map(url=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;})));
    const canvas = (w,h) => {const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const cells=[],definitions=[],seen=new Map(),maps={};
    const add = (c,layer,passable,recipe) => {
      const ctx=c.getContext('2d'),pixels=ctx.getImageData(0,0,32,32).data;
      if(layer==='upper'&&!pixels.some((v,i)=>i%4===3&&v))return -1;
      if(layer==='lower'&&pixels.some((v,i)=>i%4===3&&v!==255))throw Error('Incomplete lower tile');
      const url=c.toDataURL();const key=layer+':'+passable+':'+url;
      if(seen.has(key))return seen.get(key);
      const index=1232+cells.length;seen.set(key,index);cells.push(c);definitions.push({index,layer,passable,recipe});return index;
    };
    for (const spec of specs) {
      const recipes=manifest.maps[spec.source].recipes;const lowerTiles=[],upperTiles=[];
      for(let y=0;y<15;y++)for(let x=0;x<17;x++){
        const lower=canvas(32,32),upper=canvas(32,32),lr=[],ur=[];
        for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
          const recipe=recipes[(y*2+dy)*34+x*2+dx];
          const patch=canvas(16,16),ctx=patch.getContext('2d');let opaque=false;
          for(const piece of recipe){
            const [source,sx,sy]=manifest.rects[piece];const part={source,x:sx,y:sy,width:16,height:16,dx:dx*16,dy:dy*16};
            const dest=opaque?upper:lower;dest.getContext('2d').drawImage(loaded[source],sx,sy,16,16,dx*16,dy*16,16,16);(opaque?ur:lr).push(part);
            if(!opaque){ctx.drawImage(loaded[source],sx,sy,16,16,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data;opaque=data.every((v,i)=>i%4!==3||v===255);}
          }
        }
        lowerTiles.push(add(lower,'lower',spec.walkable[y*17+x],lr));upperTiles.push(add(upper,'upper',true,ur));
      }
      maps[spec.id]={lowerTiles,upperTiles};
    }
    const sheet=canvas(1792,Math.ceil((1232+cells.length)/56)*32),ctx=sheet.getContext('2d');ctx.drawImage(loaded[0],0,0);
    cells.forEach((c,i)=>{const t=1232+i;ctx.drawImage(c,t%56*32,Math.floor(t/56)*32);});
    return {dataUrl:sheet.toDataURL(),count:1232+cells.length,width:sheet.width,height:sheet.height,definitions,maps};
  },{manifest,images,specs:specs.map(s=>({...s,walkable:walk(s)}))});
} finally {await browser.close();}
const assetId='slates_reference_32_atlas';
project.assets.uploaded[assetId]={id:assetId,name:'Slates · 항구·도시·성 조합 타일',kind:'tileset',dataUrl:rendered.dataUrl,meta:{tileSize:32,width:rendered.width,height:rendered.height}};
const ts=structuredClone(project.tilesets.slates_32);ts.id='slates_reference_32';ts.name='Slates 32px · 예시 맵 조합';ts.image={type:'uploaded',id:assetId};ts.count=rendered.count;
for(const def of rendered.definitions){
  const i=def.index,p=def.passable;ts.passability[i]={up:p,down:p,left:p,right:p};ts.priority[i]=def.layer;ts.terrain[i]=0;
  ts.tileMeta[i]={label:def.layer==='lower'?(p?'길 / 바닥':'벽 / 물 / 구조물'):'장식 / 그림자',description:'Ivan Voirol의 Slates 원본 조각으로 조합한 32×32 타일. 조합 출처: slates-reference-recipes.json',defaultLayer:def.layer,passage:p?(def.layer==='upper'?'star':'passable'):'solid',source:'user',userLocked:true};
}
project.tilesets[ts.id]=ts;
for(const spec of specs){
  project.maps[spec.id]={id:spec.id,name:spec.name,width:17,height:15,tileSize:32,tilesetId:ts.id,...rendered.maps[spec.id],events:[],bgm:{mode:'none'},encounters:[]};
  if(!project.mapTree.children.some(n=>n.mapId===spec.id))project.mapTree.children.push({mapId:spec.id,children:[]});
}
project.startMapId=specs[0].id;project.startPos=specs[0].start;project.meta.title='Slates · 항구, 상점가와 성';
await mkdir(out,{recursive:true});
await writeFile(`${out}/project.json`,JSON.stringify(project));
await writeFile(`${out}/layout.json`,JSON.stringify({maps:specs,sourceAtlasTiles:1232,compositeTiles:rendered.count-1232},null,2));
await writeFile('public/assets/slates/slates-reference-32px.png',Buffer.from(rendered.dataUrl.split(',')[1],'base64'));
await writeFile('public/assets/slates/slates-reference-tile-provenance.json',JSON.stringify(rendered.definitions));
console.log(JSON.stringify({maps:specs.map(s=>s.id),tileSize:32,count:rendered.count,out}));
