
import { REGION_CATALOG, WORLD_CATALOG, GEOGRAPHY_TERRAIN, regionsOfWorld } from "@/project/defaults/spatial/geographyCatalog";
import { PLACE_CATALOG } from "@/project/defaults/spatial/placeCatalog";
import { MATERIAL_SLOT_IDS } from "@/editor/operators/materialSlots";
const slots=new Set<string>(MATERIAL_SLOT_IDS);
const placeIds=new Set(PLACE_CATALOG.map(p=>p.id));
// 계획서 100~109행 표를 검사 기준으로 박아 둔다. 데이터가 표를 벗어나면 실패다.
const TABLE=[
 {region:"lake-country",places:["lake-village","working-mine"],world:"lake-kingdom"},
 {region:"deep-forest",places:["forest-hamlet","forest-sanctuary"],world:"lake-kingdom"},
 {region:"harbor-coast",places:["harbor-town","harbor-town"],world:"lake-kingdom"},
 {region:"snow-frontier",places:["snow-outpost","forest-hamlet"],world:"northern-frontier"},
 {region:"high-pass",places:["mountain-pass","working-mine"],world:"northern-frontier"},
 {region:"ancient-ruins",places:["old-ruins","forest-sanctuary"],world:"northern-frontier"},
];
let bad=0;
const inBounds=(p:{x:number;y:number})=>p.x>=0&&p.y>=0&&p.x<GEOGRAPHY_TERRAIN.width&&p.y<GEOGRAPHY_TERRAIN.height;
for(const row of TABLE){
  const r=REGION_CATALOG.find(x=>x.id===row.region);
  const problems:string[]=[];
  if(!r){console.log("FAIL missing region "+row.region);bad++;continue;}
  if(r.world!==row.world) problems.push("world="+r.world+" expected "+row.world);
  const designs=r.places.map(p=>p.designId).sort();
  if(JSON.stringify(designs)!==JSON.stringify([...row.places].sort())) problems.push("places="+designs.join(",")+" expected "+row.places.join(","));
  if(new Set(r.places.map(p=>p.id)).size!==r.places.length) problems.push("duplicate child id");
  for(const c of r.places){
    if(!placeIds.has(c.designId)) problems.push("unknown place "+c.designId);
    if(!inBounds(c)) problems.push("child "+c.id+" out of bounds");
  }
  if(!slots.has(r.floor)&&r.floor!=="snow"&&r.floor!=="dirt"&&r.floor!=="sand") problems.push("floor '"+r.floor+"'");
  for(const a of r.areas) if(!slots.has(a.material)) problems.push("area material '"+a.material+"'");
  for(const pt of r.ports) if(!inBounds(pt)) problems.push("port "+pt.id+" out of bounds");
  // 경로 폴리라인 양끝이 마커와 정확히 같아야 한다.
  for(const rt of r.routes){
    const a=r.places.find(p=>p.id===rt.from), b=r.places.find(p=>p.id===rt.to);
    if(!a||!b){problems.push("route "+rt.id+" unknown endpoint");continue;}
    const first=rt.points[0], last=rt.points[rt.points.length-1];
    if(!first||first.x!==a.x||first.y!==a.y) problems.push("route "+rt.id+" first point != marker "+a.id);
    if(!last||last.x!==b.x||last.y!==b.y) problems.push("route "+rt.id+" last point != marker "+b.id);
    if(rt.points.length<2) problems.push("route "+rt.id+" needs >=2 points");
  }
  console.log((problems.length?"FAIL ":"ok   ")+r.id+" | places="+r.places.length+" routes="+r.routes.length+(problems.length?" | "+problems.join("; "):""));
  if(problems.length) bad++;
}
console.log("--- worlds ---");
const WORLDS=[{id:"lake-kingdom",chain:["lake-country","deep-forest","harbor-coast"],entry:"lake-country"},
              {id:"northern-frontier",chain:["snow-frontier","high-pass","ancient-ruins"],entry:"snow-frontier"}];
for(const w of WORLDS){
  const d=WORLD_CATALOG.find(x=>x.id===w.id);
  const problems:string[]=[];
  if(!d){console.log("FAIL missing world "+w.id);bad++;continue;}
  if(JSON.stringify(d.regions.map(r=>r.designId))!==JSON.stringify(w.chain)) problems.push("regions="+d.regions.map(r=>r.designId).join(","));
  if(d.entryRegion!==w.entry) problems.push("entry="+d.entryRegion);
  if(d.ports.length!==3) problems.push("overview must expose all three region entrances, got "+d.ports.length);
  for(const pt of d.ports) if(!inBounds(pt)) problems.push("port "+pt.id+" out of bounds");
  for(const c of d.regions) if(!inBounds(c)) problems.push("region "+c.id+" out of bounds");
  const ids=new Set(d.regions.map(r=>r.id));
  for(const c of d.connections){ if(!ids.has(c.from)) problems.push("conn "+c.id+" from "+c.from); if(!ids.has(c.to)) problems.push("conn "+c.id+" to "+c.to); }
  const owned=regionsOfWorld(w.id).map(r=>r.id).sort();
  if(JSON.stringify(owned)!==JSON.stringify([...w.chain].sort())) problems.push("regionsOfWorld="+owned.join(","));
  console.log((problems.length?"FAIL ":"ok   ")+d.id+" | regions="+d.regions.length+" ports="+d.ports.length+" conns="+d.connections.length+(problems.length?" | "+problems.join("; "):""));
  if(problems.length) bad++;
}
console.log("regions="+REGION_CATALOG.length+" worlds="+WORLD_CATALOG.length+" problems="+bad);
