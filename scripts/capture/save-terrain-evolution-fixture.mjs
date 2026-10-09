import { isDeepStrictEqual } from "node:util";
// Save the captured map to an independent canonical SQLite folder and reopen it.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { withTsModule } from "../ontology-ts-loader.mjs";
const folder=resolve(".vite-cache/terrain-evolution-store"),wire=readFileSync(".vite-cache/terrain-evolution-fixture.json","utf8"),expected=JSON.parse(wire);
await withTsModule(resolve("electron/local-store/store.ts"),"terrain-evolution-store.mjs",async({initLocalProjectStore,openLocalProjectStore})=>{
 const first=await initLocalProjectStore({projectDir:folder});let projectId;
 try{const result=await first.saveSerialized(wire);if(result.kind!=="saved")throw new Error("QA save conflict");projectId=first.projectId;}finally{first.close();}
 const reopened=await openLocalProjectStore({projectDir:folder});let result;
 try{const snapshot=reopened.loadSnapshot();if(!snapshot)throw new Error("Missing canonical map");const actual=snapshot.project.maps[snapshot.project.startMapId],before=expected.maps[expected.startMapId];
 for(const key of ["terrainDesign","relief"])if(!isDeepStrictEqual(actual[key],before[key]))throw new Error(`Roundtrip changed ${key}`);
 if(!isDeepStrictEqual(snapshot.project.terrainStamps,expected.terrainStamps))throw new Error("Roundtrip changed stamps");
 result={projectId,store:folder,revision:snapshot.revision,features:actual.terrainDesign?.features?.length,gameplay:actual.terrainDesign?.gameplay,waterCells:actual.terrainDesign?.waterDepth?.filter(Boolean).length,rampCells:actual.relief?.ramps?.filter(Boolean).length,stamps:snapshot.project.terrainStamps?.length,canonicalReload:true,isolatedQAFixture:true};
 }finally{reopened.close();}
 writeFileSync("verify-shots/terrain-evolution/sqlite-roundtrip.json",JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
});
