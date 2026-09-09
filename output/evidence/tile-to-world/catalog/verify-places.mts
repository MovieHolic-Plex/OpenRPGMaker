
import { PLACE_CATALOG } from "@/project/defaults/spatial/placeCatalog";
import { SPACE_CATALOG } from "@/project/defaults/spatial/spaceCatalog";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { FACILITY_ENTRY_PORT_ID } from "@/project/defaults/spatial/placeCatalog";
const fac=new Map(CONCEPT_FACILITY_TEMPLATES.map((f:any)=>[f.id,f]));
console.log("facility ids: "+[...fac.keys()].join(", "));
const spaceById=new Map(SPACE_CATALOG.map(s=>[s.id,s]));
let bad=0;
for(const p of PLACE_CATALOG){
  const problems:string[]=[];
  const childById=new Map(p.children.map(c=>[c.id,c]));
  if(p.children.length!==new Set(p.children.map(c=>c.id)).size) problems.push("duplicate child id");
  for(const c of p.children){
    if(c.kind==="space"&&!spaceById.has(c.designId)) problems.push("unknown space design "+c.designId);
    if(c.kind==="place"&&!fac.has(c.designId)) problems.push("unknown facility "+c.designId);
  }
  for(const l of p.links){
    for(const side of [l.from,l.to]){
      if(side.childId===null) continue;
      const c=childById.get(side.childId);
      if(!c){problems.push("link "+l.id+" unknown child "+side.childId);continue;}
      if(c.kind==="space"){
        const s=spaceById.get(c.designId);
        if(s&&!s.ports.some(pt=>pt.id===side.portId)) problems.push("link "+l.id+" port '"+side.portId+"' absent from space "+c.designId);
      } else {
        const f:any=fac.get(c.designId);
        // 시설은 포트 목록이 없고 진입 방을 갖는다. 계약 이름을 쓰는지, 진입 방이 실제로 있는지 함께 본다.
        const f2:any=f;
        if(side.portId!==FACILITY_ENTRY_PORT_ID) problems.push("link "+l.id+" facility port '"+side.portId+"' is not the contract port '"+FACILITY_ENTRY_PORT_ID+"'");
        const entrances=(f2.places??[]).filter((r:any)=>r.role==="entrance");
        if(entrances.length===0) problems.push("facility "+c.designId+" has no entrance room to derive '"+FACILITY_ENTRY_PORT_ID+"' from");
      }
    }
  }
  console.log((problems.length?"FAIL ":"ok   ")+p.id+" | children="+p.children.length+" links="+p.links.length+(problems.length?" | "+problems.join("; "):""));
  if(problems.length) bad++;
}
console.log("count="+PLACE_CATALOG.length+" problems="+bad);
