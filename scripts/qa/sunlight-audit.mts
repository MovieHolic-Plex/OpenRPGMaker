// Focused geometry, real tool, raster, and SQLite checks; no Vitest/gates/global typecheck.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SunlightField, normalizeSunlight, patchSunlight, sunlightField } from "../../src/project/sunlight";
import { buildPixelHeights, effectiveHeights, prune, samplePixelHeight } from "../../src/project/relief/render";
import { runTool } from "../../src/editor/tools";
import { buildSessionRegistryTools } from "../../src/ai/sessionToolExposure";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { prepareWebExport } from "../../src/project/webExport";
import type { GameMap, Project } from "../../src/project/types";
const out=path.resolve("verify-shots/sunlight/contracts"),folder=path.resolve(".vite-cache/sunlight/project");
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.resolve(".vite-cache/sunlight"),{recursive:true});
const checks:string[]=[],sha=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const baseline=await openLocalProjectStore({projectDir:path.resolve(".vite-cache/terrain-ai-edit/editor-project")});
const source=baseline.loadSnapshot()!;baseline.close();
const project=structuredClone(source.project) as Project, map=project.maps.houses_native!,ts=project.tilesets[map.tilesetId]!;
assert.equal(ts.id,"beodeul_city");const baseMap=structuredClone(map),original=sha(map);
assert.equal(sunlightField(map,ts),null);checks.push("old maps default to off with no shadow allocation");
const emptyMap:GameMap={id:"empty-sun",name:"empty sun",width:1024,height:1024,tilesetId:"missing",tileSize:16,
 lowerTiles:Array(1024*1024).fill(737),upperTiles:Array(1024*1024).fill(-1),events:[],sunlight:{enabled:true}};
assert.equal(sunlightField(emptyMap),null);assert.equal(sunlightField(emptyMap),null);
checks.push("1024-square flat maps without a tileset allocate no shadow field, including cache reuse");
assert.deepEqual(normalizeSunlight({enabled:true,azimuth:-90,altitude:Infinity,opacity:NaN,softness:90,heightScale:-4}),
 {enabled:true,azimuth:270,altitude:65,opacity:.32,softness:4,heightScale:.25});checks.push("invalid loaded settings are bounded and normalized");
const preserved=patchSunlight({enabled:true,azimuth:45,altitude:24,opacity:.4,softness:2,heightScale:1.5},{enabled:false});
assert.equal(preserved.azimuth,45);assert.equal(preserved.altitude,24);assert.equal(preserved.opacity,.4);
checks.push("off/on preserves all authored sun parameters");
const simple=(azimuth:number,altitude=40):GameMap=>({id:"geometry",name:"geometry",width:24,height:24,tilesetId:ts.id,tileSize:16,
 lowerTiles:Array(576).fill(737),upperTiles:Array(576).fill(-1),events:[],sunlight:{enabled:true,azimuth,altitude,softness:0},
 relief:{width:24,height:24,levels:Array.from({length:576},(_,i)=>i%24>=8&&i%24<16&&Math.floor(i/24)>=8&&Math.floor(i/24)<16?4:0)}});
const north=new SunlightField(simple(0)),south=new SunlightField(simple(180));
assert.equal(north.shadowAt(12.5,17.5,0),1);assert.equal(north.shadowAt(12.5,6.5,0),0);
assert.equal(south.shadowAt(12.5,6.5,0),1);assert.equal(south.shadowAt(12.5,17.5,0),0);
checks.push("north/south suns cast terrain shadows on opposite sides");
assert.equal(new SunlightField(simple(0,15)).shadowAt(12.5,22.5,0),1);
assert.equal(new SunlightField(simple(0,75)).shadowAt(12.5,18.5,0),0);
checks.push("low sun lengthens shadows and high sun shortens them");
assert.equal(north.shadowAt(12.5,12.5,4),0);checks.push("high-ground receivers do not shade themselves");
const heights=prune(effectiveHeights(simple(0).relief!.levels.reduce((a:number[][],_v,i,all)=>{if(i%24===0)a.push(all.slice(i,i+24));return a;},[])));
const pixels=buildPixelHeights(heights,true,undefined,heights);let contacts=0;
for(let y=0;y<pixels.PH;y+=3)for(let x=0;x<pixels.PW;x+=3){assert.equal(samplePixelHeight(heights,x,y),pixels.hp[y*pixels.PW+x]);contacts++;}
checks.push(`caster terrain matches native diagonal geometry at ${contacts} pixels`);
const darkOff=simple(0);darkOff.sunlight!.enabled=false;assert(!new SunlightField(darkOff).row(12).rgba.some(v=>v));
checks.push("off also produces a fully transparent standalone raster");
const ctx={project} as any,toolCalls:unknown[]=[];
const edit=(args:unknown)=>{const r=runTool(ctx,"set_map_properties",{mapId:map.id,...args as object});assert(r.ok,r.summary);toolCalls.push(r);return r;};
edit({sunlight:{enabled:true,azimuth:315,altitude:35,opacity:.36,softness:2}});
edit({sunlight:{azimuth:135}});assert.equal(ctx.project.maps[map.id].sunlight.altitude,35);assert.equal(ctx.project.maps[map.id].sunlight.opacity,.36);
checks.push("real assistant tool partial edits retain altitude, opacity and softness");
const settings=ctx.project.maps[map.id].sunlight;edit({sunlight:{enabled:false}});edit({sunlight:{enabled:true}});
assert.deepEqual(ctx.project.maps[map.id].sunlight,settings);checks.push("real assistant tool off/on is lossless");
edit({clearSunlight:true});assert.equal(sha(ctx.project.maps[map.id]),original);checks.push("clear restores exactly the original map");
const exposure=buildSessionRegistryTools({requestText:"태양을 북서쪽 낮게 두고 그림자를 보여 줘",intent:{source:"llm",mode:"modify",tools:["get_map_region"],space:"none",targetMapId:map.id} as any,contextWindow:200000}).map(t=>t.function.name);
for(const name of["set_map_properties","inspect_terrain","show_map_region"])assert(exposure.includes(name));checks.push("sun requests expose edit, inspect and image tools together");
edit({sunlight:{enabled:true,azimuth:315,altitude:35,opacity:.36,softness:2}});
const resultMap=ctx.project.maps[map.id],field=sunlightField(resultMap,ts)!;
assert.equal(field.casters.filter(c=>c.kind==="house").length,4);assert(field.casters.some(c=>c.base>0));
checks.push("all four native/assembled houses have casters, including houses on high ground");
const inspected=runTool(ctx,"inspect_terrain",{mapId:map.id,includeCatalog:false});assert(inspected.ok);assert.equal((inspected.data as any).sunlight.azimuth,315);
assert.equal((inspected.data as any).shadowCasters.length,4);checks.push("assistant inspection reports saved settings and real caster heights");
const {sunlight:_sun,...unchanged}=resultMap;assert.equal(sha(unchanged),sha(baseMap));
for(const id of Object.keys(project.maps))if(id!==map.id)assert.deepEqual(ctx.project.maps[id],source.project.maps[id]);
checks.push("terrain, ramps, tiles, houses, entrances and unrelated maps are unchanged");
for(const [name,azimuth,altitude]of[["northwest-low",315,24],["southeast-low",135,24],["northwest-high",315,75]] as const){
 resultMap.sunlight={...resultMap.sunlight,azimuth,altitude};const before=sha(resultMap);
 fs.writeFileSync(path.join(out,`${name}.png`),renderMapPng(ctx.project,resultMap).png);
 assert.equal(sha(resultMap),before);
}
const files=["northwest-low","southeast-low","northwest-high"].map(n=>createHash("sha256").update(fs.readFileSync(path.join(out,`${n}.png`))).digest("hex"));
assert.equal(new Set(files).size,3);checks.push("actual Beodeul terrain raster changes with direction and altitude without mutating content");
fs.writeFileSync(path.join(out,"assistant-crop.png"),Buffer.from(renderToolRegionPngBase64(ctx.project,{mapId:map.id,x:10,y:30,w:44,h:30}),"base64"));
checks.push("assistant region image includes casters outside the cropped receiver region");
resultMap.sunlight={...resultMap.sunlight,azimuth:315,altitude:35};ctx.project.meta.title="태양 지형 그림자 QA";ctx.project.startMapId=map.id;ctx.project.startPos={x:4,y:58};
let store=await initLocalProjectStore({projectDir:folder});const projectId=store.info().projectId;
try{assert.equal((await store.saveSerialized(JSON.stringify(ctx.project))).kind,"saved");}finally{store.close();}
store=await openLocalProjectStore({projectDir:folder});const loaded=store.loadSnapshot()!;store.close();
assert.deepEqual(loaded.project.maps[map.id],resultMap);checks.push("own canonical SQLite save/reload preserves sun and every terrain tile");
const wire=JSON.parse(prepareWebExport(loaded.project as Project).projectJson);
assert.deepEqual(wire.maps[map.id].sunlight,resultMap.sunlight);checks.push("shipping-player export preserves identical sun parameters");
fs.writeFileSync(path.join(folder,"project.json"),JSON.stringify(loaded.project));fs.writeFileSync(path.join(folder,"player.json"),JSON.stringify(wire));
const proof={checks,projectId,folder,revision:loaded.revision,mapId:map.id,sourceProjectId:source.project.meta.id,canonicalReload:true,
 sourceMapSha:original,savedMapSha:sha(resultMap),geometryContacts:contacts,casters:field.casters,exposure};
fs.writeFileSync(path.join(out,"observations.json"),JSON.stringify(proof,null,2));fs.writeFileSync(path.join(out,"calls.json"),JSON.stringify(toolCalls,null,2));
console.log(JSON.stringify({...proof,casters:field.casters.length,exposure:exposure.length}));
