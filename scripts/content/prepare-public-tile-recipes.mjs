import fs from 'node:fs';import {createHash} from 'node:crypto';import {withTsModule} from '../ontology-ts-loader.mjs';
const file='src/assets/forestHarmonyTileset.json',t=JSON.parse(fs.readFileSync(file));
// Correct authored prose/metadata, not gameplay priority. Record every correction.
const corrections=[];
for(const g of t.tileGroups){const homes=[...new Set(g.tileIds.map(i=>t.priority[i]).filter(Boolean))];const actual=homes.length===1?homes[0]:'mixed';if(g.defaultLayer!==actual){corrections.push({scope:'group',id:g.id,before:g.defaultLayer,after:actual});g.defaultLayer=actual;}}
for(let i=0;i<t.count;i++){const m=t.tileMeta[i];if(m?.defaultLayer && m.defaultLayer!==t.priority[i]){corrections.push({scope:'tile',id:i,before:m.defaultLayer,after:t.priority[i]});m.defaultLayer=t.priority[i];}}
const proseCorrections=[];
for(const id of ['forest-trees:round-bush','forest-trees:dark-bush','forest-trees:small-bush']) {
 const g=t.tileGroups.find(g=>g.id===id);
 if(g.description.includes('수관은 상위, 밑동은 하위+잔디 받침.')) {
  const before={description:g.description,placementRules:g.placementRules};
  g.description=g.description.replace('수관은 상위, 밑동은 하위+잔디 받침.','이 덤불은 그림 조각 전부가 하위이며 상위 배열은 -1이다.');
  g.placementRules='previewMap의 전체 하위 배열을 온전하게 배치한다. 상위 칸은 -1이며, 받침은 타일별 layerBacking 정책을 따른다.';
  proseCorrections.push({id,before,after:{description:g.description,placementRules:g.placementRules}});
 }
}
if(proseCorrections.length)fs.writeFileSync('tiledata/tilesets/forest_harmony/recipes/layer-prose-corrections.json',JSON.stringify(proseCorrections,null,2)+'\n');
// Native cave entrance has a keyed background in its source atlas. Use the existing
// engine graft/backing mechanism so it can sit inside the cliff without a pink square.
if(!t.tileGrafts.some(g=>g.targetTile===893))t.tileGrafts.push({sourceTile:413,targetTile:893,sourceChipset:'tex_easyrpg_chipset_retro_world'});
t.tileMeta[893].layerBacking=652;
fs.writeFileSync(file,JSON.stringify(t)+'\n');
const recipes=[];const pattern=(id,name,kind,w,h)=>({id,name,kind,tilesetId:t.id,width:w,height:h,lowerTiles:Array(w*h).fill(1141),upperTiles:Array(w*h).fill(-1),roles:Array(w*h).fill('ground'),access:[],doors:[],steps:[]});
const put=(r,x,y,id,layer,role)=>{r[layer+'Tiles'][y*r.width+x]=id;r.roles[y*r.width+x]=role;};
await withTsModule('src/project/forestRecipes.ts','forest.mjs',m=>{
 for(const input of [{recipeId:'strip',x:0,y:0,repeats:2},{recipeId:'tree',x:0,y:0}]){const p=m.compileForestRecipe(t,input),r={...pattern('forest-'+input.recipeId,'숲 '+input.recipeId,'forest',p.width,p.height),lowerTiles:p.lowerTiles,upperTiles:p.upperTiles,source:input};
 r.steps=p.parts.map(p=>({partId:p.id,x:p.x,y:p.y}));r.roles=r.roles.map((_,i)=>{const y=Math.floor(i/r.width),x=i%r.width;return y===r.height-1&&![240,1141,1145].includes(r.lowerTiles[i])?'root':y>=2&&![240,1141,1145].includes(r.lowerTiles[i])?'trunk':x===0?'edge-west':x===r.width-1?'edge-east':'canopy';});if(input.recipeId==='strip')r.steps=[{part:'left-cap',rect:[0,0,4,6]},{part:'resolved-repeat',rect:[4,0,r.width-8,6]},{part:'right-cap',rect:[r.width-4,0,4,6]}];recipes.push(r);}
});
await withTsModule('src/project/defaults/dbExtractedHouseVariants.ts','house.mjs',m=>{
 const map={width:20,height:18,lowerTiles:Array(360).fill(1141),upperTiles:Array(360).fill(-1)};m.stampDbHouseVariant(map,{material:'wood',origin:{x:0,y:0},variant:'compact',includeFence:false});
 const r=pattern('house-wood','통나무 집 + 문 앞 2칸','building',9,9);
 for(let y=0;y<7;y++)for(let x=0;x<9;x++){const n=(y+3)*20+x+4;put(r,x,y,map.lowerTiles[n],'lower',y<4?'roof':y===6?'wall-bottom':'wall');put(r,x,y,map.upperTiles[n],'upper',y<4?'roof':'wall');}
 r.doors=[{x:4,y:6,top:{x:4,y:5},trigger:'action-from-south',transfer:'must-author-target-map-event'}];r.access=[{x:4,y:7,role:'door-approach'},{x:4,y:8,role:'entry'}];r.roles[6*9+4]='door-bottom';r.roles[5*9+4]='door-top';r.steps=[{part:'roof',rect:[0,0,9,4]},{part:'wall',rect:[0,4,9,3]},{part:'windows',cells:[[2,5],[7,5]]},{part:'door',cells:[[4,5],[4,6]]},{part:'approach',cells:[[4,7],[4,8]]}];recipes.push(r);
});
const table=pattern('furniture-table','가로 탁자와 접근칸','furniture',3,2);[234,235,236].forEach((id,x)=>put(table,x,0,id,'upper',['edge-west','furniture','edge-east'][x]));table.access=[{x:1,y:1,role:'interaction'}];table.steps=[{part:'ground',rect:[0,0,3,2]},{part:'left',tile:234,x:0,y:0},{part:'repeat',tile:235,x:1,y:0},{part:'right',tile:236,x:2,y:0}];recipes.push(table);
const fence=pattern('fence-gate','울타리와 남쪽 출입구','fence',7,6);for(let x=1;x<6;x++){put(fence,x,0,379,'upper','rail');if(x!==3)put(fence,x,4,379,'upper','rail');}for(let y=1;y<4;y++){put(fence,0,y,408,'upper','edge-west');put(fence,6,y,408,'upper','edge-east');}for(const[x,y,id,role]of [[0,0,378,'corner-nw'],[6,0,380,'corner-ne'],[0,4,438,'corner-sw'],[6,4,410,'corner-se']])put(fence,x,y,id,'upper',role);fence.access=[{x:3,y:3,role:'inside'},{x:3,y:4,role:'gate'},{x:3,y:5,role:'outside'}];fence.steps=[{part:'corners',cells:[[0,0,378],[6,0,380],[0,4,438],[6,4,410]]},{part:'horizontal',tile:379},{part:'vertical',tile:408},{part:'leave-gate-empty',cells:[[3,4],[3,5]]}];recipes.push(fence);
const cave=pattern('cave-cliff','암벽 동굴 입구와 접근칸','cave',7,6);for(let x=0;x<7;x++){put(cave,x,0,x===0?618:x===6?620:619,'lower','cliff-top');for(let y=1;y<4;y++)put(cave,x,y,x===0?651:x===6?653:652,'lower',x===0?'edge-west':x===6?'edge-east':'cliff-face');}put(cave,3,3,893,'lower','cave-mouth');cave.access=[{x:3,y:4,role:'cave-approach'},{x:3,y:5,role:'entry'}];cave.doors=[{x:3,y:3,trigger:'action-from-south',transfer:'must-author-target-map-event'}];cave.steps=[{part:'cliff-top',rect:[0,0,7,1]},{part:'cliff-face',rect:[0,1,7,3]},{part:'cave-mouth',tile:893,x:3,y:3,backing:652},{part:'approach',cells:[[3,4],[3,5]]}];recipes.push(cave);
for(const r of recipes){r.tileCoordinates=[...new Set([...r.lowerTiles,...r.upperTiles].filter(n=>n>=0))].sort((a,b)=>a-b).map(id=>({id,col:id%30,row:Math.floor(id/30),pixelX:id%30*16,pixelY:Math.floor(id/30)*16,width:16,height:16,home:t.priority[id],backing:t.tileMeta[id]?.layerBacking??null,graft:t.tileGrafts.find(g=>g.targetTile===id)??null}));}
const dir='tiledata/tilesets/forest_harmony/recipes';fs.mkdirSync(dir,{recursive:true});
const catalog={version:2,tileSize:16,tilesetId:t.id,image:t.image,columns:30,count:t.count,tileGrafts:t.tileGrafts,atlasSha256:createHash('sha256').update(fs.readFileSync('public/assets/forest-harmony/chipset.png')).digest('hex'),recipes};
fs.writeFileSync('src/assets/publicForestRecipes.json',JSON.stringify(catalog)+'\n');fs.writeFileSync(dir+'/catalog.json',JSON.stringify(catalog,null,2)+'\n');
// Keep the original before/after audit across regeneration.
const audit=dir+'/layer-corrections.json';if(corrections.length)fs.writeFileSync(audit,JSON.stringify(corrections,null,2)+'\n');
console.log({recipes:recipes.length,layerCorrections:corrections.length});
