// Focused authored-content contract checks; no project writes or broad test suite.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { inspectHouseholdProps } from './lib/village-household-props.mjs';
const catalog=JSON.parse(fs.readFileSync('tiledata/forest-villages/diverse/catalog.json'));
const checks=[];
for(const plan of catalog.plans){assert.deepEqual(inspectHouseholdProps(catalog.maps[plan.id],plan),[]);assert(plan.houses.every(h=>h.activity&&h.role&&h.reason));}
function check(name,id,mutate,expected,code){
 const m=structuredClone(catalog.maps[id]),p=structuredClone(catalog.plans.find(p=>p.id===id));
 mutate(m,p);const errors=inspectHouseholdProps(m,p),o=expected(p);
 assert(errors.some(e=>e.code===code&&e.x===o.x&&e.y===o.y),name);
 checks.push({name,mapId:id,code,x:o.x,y:o.y});
}
const terrace='terrace-cliff-village',reed='reed-bay-village';
const prop=(p,name)=>p.placements.find(o=>o.kind==='prop'&&o.name===name);
check('owner activity mismatch',terrace,(_,p)=>{p.houses[0].activity='storage';},p=>prop(p,'빨랫줄'),'prop-purpose-mismatch');
check('actual washing anchor removed',terrace,(m,p)=>{const o=prop(p,'빨랫줄');m.upperTiles[o.y*m.width+o.x]=-1;},p=>p.placements.find(o=>o.anchor==='빨랫줄'),'prop-purpose-anchor-missing');
check('actual dock removed',reed,(m,p)=>{const d=p.activitySites.dock;m.upperTiles[d.y*m.width+d.x]=-1;},p=>prop(p,'낚시 바구니'),'prop-purpose-anchor-missing');
check('existing field removed',reed,(m,p)=>{const f=p.activitySites.farm;m.lowerTiles[f.y*m.width+f.x]=240;},p=>p.placements.find(o=>o.kit==='field-tending'&&o.name==='허수아비'),'scarecrow-without-garden');
check('work surface removed',terrace,(m,p)=>{const wood=prop(p,'장작'),o=p.placements.find(o=>o.ownerId===wood.ownerId&&o.name==='가로 탁자');m.upperTiles[o.y*m.width+o.x]=-1;},p=>prop(p,'장작'),'prop-purpose-anchor-missing');
const out=process.argv[2];if(out)fs.writeFileSync(out,JSON.stringify({normal:catalog.plans.map(p=>p.id),checks},null,2));console.log(checks);
