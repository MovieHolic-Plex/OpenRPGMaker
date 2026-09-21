import fs from 'node:fs';import assert from 'node:assert/strict';import {withTsModule} from '../ontology-ts-loader.mjs';
const out='tiledata/castle-tiles-rpgs/executable';fs.mkdirSync(out,{recursive:true});
let project;await withTsModule('src/project/defaults/blankProject.ts','guide-blank.mjs',m=>{project=m.createBlankProject();});
await withTsModule('src/project/tileAssemblyGuide.ts','tile-guide.mjs',m=>{
 const map={id:'forest-assembly-example',name:'실행형 숲 조립 표본',tilesetId:'forest_harmony',tileSize:16,width:20,height:12,lowerTiles:Array(240).fill(1145),upperTiles:Array(240).fill(-1),events:[]};
 const input={mapId:map.id,x:3,y:2,width:14,height:6};const plan=m.forestStripPlan(input.x,input.y,input.width,input.height);plan.entrances=[{x:10,y:9,fromX:10,fromY:10}];
 const built=m.assembleTilePlan(map,plan);project.maps={[built.id]:built};project.startMapId=built.id;project.mapTree={mapId:built.id,children:[]};project.startPos={x:10,y:10};project.meta.title='공용 실행형 타일 조립 표본';
 assert(m.validateTileAssembly(project,built,plan).valid);
 const failures=[];
 for(const [name,layer,x,y,tile,expected] of [
 ['root','lower',3,7,-1,'CUT_ROOT'],['trunk','lower',7,5,-1,'MISSING_TRUNK'],['edge','upper',3,2,1440,'REVERSED_EDGE'],['entrance','lower',10,9,1364,'BLOCKED_ENTRANCE']]){
  const bad=structuredClone(built);bad[layer+'Tiles'][y*bad.width+x]=tile;const r=m.validateTileAssembly(project,bad,plan);assert(r.issues.some(i=>i.code===expected&&i.x===x&&i.y===y),JSON.stringify({name,r}));failures.push({case:name,changed:{layer,x,y,tile},result:r});
 }
 fs.writeFileSync(out+'/input.json',JSON.stringify(input,null,2));fs.writeFileSync(out+'/plan.json',JSON.stringify(plan,null,2));fs.writeFileSync(out+'/output.json',JSON.stringify(built,null,2));fs.writeFileSync(out+'/validation-examples.json',JSON.stringify({valid:m.validateTileAssembly(project,built,plan),failures},null,2));
 fs.writeFileSync('output/castle-executable-guide/example-project.json',JSON.stringify(project));
});console.log('Exact forest output and four coordinate-returning defect cases generated');
