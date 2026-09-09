
import { SPACE_CATALOG } from "@/project/defaults/spatial/spaceCatalog";
import { OUTDOOR_OBJECT_CATALOG } from "@/project/defaults/spatial/outdoorObjectCatalog";
import { MATERIAL_SLOT_IDS } from "@/editor/operators/materialSlots";
const objIds=new Set(OUTDOOR_OBJECT_CATALOG.map(o=>o.id));
const slots=new Set<string>(MATERIAL_SLOT_IDS);
const planned=["market-square","quiet-courtyard","kitchen-garden","forest-clearing","lakeshore","river-crossing","harbor-pier","snow-camp","mountain-gate","cave-mouth","mine-chamber","ruined-court"];
let bad=0;
console.log("count="+SPACE_CATALOG.length);
const ids=SPACE_CATALOG.map(s=>s.id);
for(const p of planned) if(!ids.includes(p)){console.log("MISSING PLANNED "+p);bad++;}
for(const s of SPACE_CATALOG){
  const problems:string[]=[];
  // 1) 재료 슬롯이 실제 목록에 있나
  if(s.environment==="outdoor"){
    if(!slots.has(s.floor)) problems.push("floor slot '"+s.floor+"' not a material slot");
    for(const a of s.areas) if(!slots.has(a.material)) problems.push("area material '"+a.material+"'");
  }
  // 2) 오브젝트 참조가 실제 정의인가
  const fams=new Set<string>();
  for(const sl of s.slots){
    const o=OUTDOOR_OBJECT_CATALOG.find(x=>x.id===sl.objectId);
    if(!o) problems.push("unknown object "+sl.objectId);
    else o.families.forEach(f=>fams.add(f));
    if(sl.quantity<1) problems.push("quantity<1 "+sl.id);
  }
  // 3) 최소 두 계열
  if(fams.size<2) problems.push("object families="+fams.size);
  // 4) 포트가 경계 안이고, 이름이 있나
  for(const pt of s.ports){
    if(pt.x<0||pt.y<0||pt.x>=s.width||pt.y>=s.height) problems.push("port "+pt.id+" out of bounds ("+pt.x+","+pt.y+") vs "+s.width+"x"+s.height);
    if(!pt.name.trim()) problems.push("port "+pt.id+" unnamed");
  }
  if(s.ports.length<2) problems.push("ports<2");
  // 5) 고정 배치가 경계 안이고 포트를 밟지 않나
  for(const sl of s.slots){
    if(!sl.at) continue;
    const o=OUTDOOR_OBJECT_CATALOG.find(x=>x.id===sl.objectId);
    const w=o?o.width:1, h=o?o.height:1;
    if(sl.at.x<0||sl.at.y<0||sl.at.x+w>s.width||sl.at.y+h>s.height) problems.push("slot "+sl.id+" ("+sl.at.x+","+sl.at.y+")+"+w+"x"+h+" exceeds "+s.width+"x"+s.height);
    if(o&&o.passage==="solid"){
      for(const pt of s.ports){
        if(pt.x>=sl.at.x&&pt.x<sl.at.x+w&&pt.y>=sl.at.y&&pt.y<sl.at.y+h) problems.push("solid slot "+sl.id+" blocks port "+pt.id);
      }
    }
  }
  console.log((problems.length?"FAIL ":"ok   ")+s.id+" | fams="+fams.size+" ports="+s.ports.length+(problems.length?" | "+problems.join("; "):""));
  if(problems.length) bad++;
}
console.log("problems="+bad);
