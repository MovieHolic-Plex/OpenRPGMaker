// Read-only authored-content proof, no gate runner or canonical writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {catalog,validateVillageStudy} from './validate-diverse-villages.mjs';
const [beforeFile,out]=process.argv.slice(2);
if(!beforeFile||!out)throw Error('Usage: verify-diverse-village-civic.mjs before-project.json proof.json');
const before=JSON.parse(fs.readFileSync(beforeFile));
const project={maps:catalog.maps,tilesets:{forest_harmony:catalog.tileset}},proof={maps:[],faults:[]};
const names=new Set();
await withTsModule('src/project/lint/reachability.ts','civic-proof-reach.mjs',async api=>{
 for(const plan of catalog.plans) {
  const map=catalog.maps[plan.id],old=before.maps[plan.id],added=plan.placements.filter(o=>o.kind==='civic-prop'),allowed=new Set();
  assert.deepEqual(map.lowerTiles,old.lowerTiles);
  for(const o of added){names.add(o.name);for(let y=o.y;y<o.y+o.h;y++)for(let x=o.x;x<o.x+o.w;x++)allowed.add(y*map.width+x);}
  let changes=0;
  for(let i=0;i<map.upperTiles.length;i++)if(old.upperTiles[i]!==map.upperTiles[i]){assert(allowed.has(i),'Changed outside new props');assert.equal(old.upperTiles[i],-1);changes++;}
  const seen=api.computeReachableCells(project,map,plan.entrance.x,plan.entrance.y);
  for(const a of plan.access)assert(seen.has(a.x+','+a.y));
  const result=await validateVillageStudy(project,plan.id);assert(result.valid,JSON.stringify(result));
  proof.maps.push({id:plan.id,addedProps:added.length,places:plan.civicPlaces.length,changedUpperCells:changes,lowerUnchanged:true,existingUpperPreserved:true,allAccessFromEntrance:true,reachableCells:seen.size});
 }
});
const plan=catalog.plans.find(p=>p.id==='reed-bay-village');
const check=async(label,mutate,code,x,y)=>{const copy=structuredClone(project);mutate(copy.maps[plan.id]);const r=await validateVillageStudy(copy,plan.id);assert(r.errors.some(e=>e.code===code&&e.x===x&&e.y===y),label);proof.faults.push({label,code,x,y});};
const fruit=plan.placements.find(o=>o.name==='과일 상자'),table=plan.placements.find(o=>o.placeId===fruit.placeId&&o.name==='가로 탁자');
await check('판매대 제거 후 남은 과일 상자',m=>m.upperTiles[table.y*m.width+table.x]=-1,'civic-anchor-missing',fruit.x,fruit.y);
const garden=plan.civicPlaces.find(z=>z.id==='garden'),flower=plan.placements.find(o=>o.placeId==='garden'&&o.name==='꽃 화단');
await check('정원 소유 집 받침 손상',m=>m.lowerTiles[garden.site.y*m.width+garden.site.x]=-1,'civic-anchor-missing',flower.x,flower.y);
const arch=plan.placements.find(o=>o.placeId==='garden'&&o.name==='덩굴 아치');
await check('아치 한 조각 제거',m=>m.upperTiles[arch.y*m.width+arch.x]=-1,'civic-part-missing',arch.x,arch.y);
proof.addedTypes=[...names].sort();proof.allPropTypes=[...new Set(catalog.plans.flatMap(p=>p.placements.filter(o=>['prop','civic-prop'].includes(o.kind)).map(o=>o.name)))].sort();
fs.writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(proof);
