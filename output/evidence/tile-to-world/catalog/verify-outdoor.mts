
import { OUTDOOR_OBJECT_CATALOG } from "@/project/defaults/spatial/outdoorObjectCatalog";
import { CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_HARNESS_GROUPS } from "@/project/tilesetHarness/combinedTownGroups";
const harness=new Map(COMBINED_TOWN_HARNESS_GROUPS.map(g=>[g.id,g]));
let bad=0;
for(const o of OUTDOOR_OBJECT_CATALOG){
  const tiles=[...new Set(o.cells.map(c=>c.tile))];
  let known=[];
  if(o.authority.startsWith("harness-")){const g=harness.get(o.authority); known=g?[...g.tileIds]:[]; if(g&&g.passage!==o.passage){console.log("PASSAGE MISMATCH "+o.id+" def="+o.passage+" harness="+g.passage);bad++;}}
  else if(o.authority.startsWith("CHIPSET_TILE_GROUPS.")){const k=o.authority.split(".")[1]; known=[...(CHIPSET_TILE_GROUPS as any)[k]??[]];}
  else if(o.authority.startsWith("tileSemanticsCombinedTown:")){known=o.authority.split(":")[1].split(",").map(Number);}
  const missing=tiles.filter(t=>!known.includes(t));
  console.log((missing.length?"FAIL ":"ok   ")+o.id+" | "+o.passage+" | tiles="+tiles.join(",")+(missing.length?" | NOT IN AUTHORITY: "+missing.join(","):""));
  if(missing.length) bad++;
}
console.log("count="+OUTDOOR_OBJECT_CATALOG.length+" problems="+bad);
