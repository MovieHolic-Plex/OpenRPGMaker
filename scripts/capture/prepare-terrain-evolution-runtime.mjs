import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";
// The QA map uses one chipset; prepare the same runtime payload as a real web export.
await withTsModule(resolve("src/project/webExport.ts"),"terrain-export.mjs",async({prepareWebExport})=>{
 const p=JSON.parse(readFileSync(".vite-cache/terrain-evolution-fixture.json","utf8"));
 const used=new Set(Object.values(p.maps).map(m=>m.tilesetId));
 p.tilesets=Object.fromEntries(Object.entries(p.tilesets).filter(([id])=>used.has(id)));
 const result=prepareWebExport(p);writeFileSync(".vite-cache/terrain-evolution-runtime.json",result.projectJson);console.log(JSON.stringify(result.summary));
});
