
import { PLACE_CATALOG } from "@/project/defaults/spatial/placeCatalog";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
const fac=new Map((CONCEPT_FACILITY_TEMPLATES as any[]).map(f=>[f.id,f]));
// 시설의 진입 방(role==="entrance")이 링크가 노리는 포트 이름과 맞는지 본다.
for(const id of ["inn","house","shop","tavern","warehouse","clinic","barracks","church","hunter"]){
  const f:any=fac.get(id);
  const entrances=(f.places??[]).filter((p:any)=>p.role==="entrance").map((p:any)=>p.id);
  console.log(id+" | entrance rooms: "+(entrances.join(",")||"(none)")+" | rooms="+(f.places??[]).length);
}
console.log("--- inn 'single' present? ---");
const inn:any=fac.get("inn");
console.log((inn.places??[]).map((p:any)=>p.id).join(","));
console.log("--- barracks rooms ---");
const b:any=fac.get("barracks");
console.log((b.places??[]).map((p:any)=>p.id+(p.level?"@"+p.level:"")).join(","));
console.log("--- link targets used ---");
for(const p of PLACE_CATALOG) for(const l of p.links) if(l.to.childId){
  const c=p.children.find(x=>x.id===l.to.childId)!;
  if(c.kind==="place") console.log(p.id+" -> "+c.designId+" port="+l.to.portId);
}
