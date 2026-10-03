// Real editor gestures and standalone player footage. Isolated QA content only.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startEditorScreencast } from "./editor-screencast.mjs";

const out=resolve("verify-shots/terrain-evolution");mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:["--disable-background-networking","--no-proxy-server","--js-flags=--max-old-space-size=8192"]});
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[],observed={};
page.on("pageerror",e=>{errors.push(e.message);console.log("page error",e.message);});
const field=name=>page.getByTestId(`terrain-design-${name}`),settle=(ms=400)=>page.waitForTimeout(ms),assert=(v,m)=>{if(!v)throw new Error(m);};
const open=async()=>{if(!await field("panel").isVisible())await field("toggle").click();};
const choose=async tool=>{await open();await field("tool").selectOption(tool);};
const close=async()=>{if(await field("panel").isVisible())await field("close").click();};
const num=async(key,v)=>{await field(key).fill(String(v));await field(key).press("Tab");};
const cellClient=async(x,y)=>page.evaluate(async({x,y})=>{const {reliefLiftField,cellLift}=await import("/src/project/relief/screen.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId],h=m.relief?cellLift(reliefLiftField(m.relief),x,y):0;return window.__oprnEditWorldToClient((x+.5)*m.tileSize,(y+.5-h)*m.tileSize);},{x,y});
const click=async(x,y)=>{const p=await cellClient(x,y);await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.click(p.x,p.y);await settle(200);};
const points=async list=>{await close();for(const[x,y]of list)await click(x,y);await page.keyboard.press("Enter");await settle(700);};
const drag=async(from,to)=>{await close();const a=await cellClient(...from),b=await cellClient(...to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:18});await page.mouse.up();await settle(400);};
const mapRead=fn=>page.evaluate(fn);
const shot=async name=>page.screenshot({path:resolve(out,`${name}.png`)});
let film;
try{
 await page.goto(`${process.env.TERRAIN_CAPTURE_URL??"http://127.0.0.1:9833"}/?blankProject=1`,{waitUntil:"load",timeout:120000});
 for(let n=0;n<3;n++){try{await page.waitForFunction(()=>window.__oprnEditorStore&&window.__oprnEditWorldToClient,null,{timeout:60000});break;}catch(e){if(n===2)throw e;errors.length=0;await page.reload({waitUntil:"load"});}}
 await page.getByTestId("boot-loader").waitFor({state:"hidden",timeout:120000});
 await page.evaluate(async()=>{const {createBlankMap}=await import("/src/project/defaults/defaultMaps.ts"),{editorState}=await import("/src/editor/editorState.ts"),{requestEditorCameraFocus}=await import("/src/editor/editorCameraFocus.ts");const store=window.__oprnEditorStore,p=store.getCurrent(),old=p.maps[p.startMapId],m=createBlankMap("지형 확장 실제 시연",40,30,old.tilesetId,old.tileSize);m.id=old.id;store.updateMap(m.id,d=>Object.assign(d,m),{label:"격리 QA 지도"});editorState.set({currentMapId:m.id,tool:"relief",layer:"lower",zoom:1,terrainBrush:"height",terrainDesignOpen:false,terrainPoints:null,terrainFeatureId:null,terrainVisionPreview:false,terrainSymmetry:"none",reliefDoodad:null});requestEditorCameraFocus({mapId:m.id,tileX:20,tileY:15,immediate:true});});
 await settle(1800);film=await startEditorScreencast(page,out,"editor-2x.mp4",{selector:"body",cropTop:0});
 await film.caption("1. 적용한 고지 재편집 · 제어점을 드래그하고 높이 변경");
 await choose("contour");await field("shape").selectOption("rect");await num("delta",3);await points([[12,7],[21,14]]);
 const featureId=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent();return p.maps[p.startMapId].terrainDesign.features[0].id;});
 await open();await field("features").evaluate(n=>n.open=true);await field("feature").selectOption(featureId);await num("delta",4);await drag([21,14],[23,15]);await page.keyboard.press("Enter");await settle(800);
 observed.reedit=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return {features:m.terrainDesign.features.length,height:m.relief.levels[10*40+22],points:m.terrainDesign.features[0].points};});assert(observed.reedit.height===4&&observed.reedit.features===1,"feature drag/replace failed");await shot("01-reedit");
 await film.caption("2. 자동 경사 연결 · 길 폭 재편집과 여러 고지 통과");
 await choose("road");await field("width").selectOption("3");await points([[6,21],[18,21],[18,10]]);
 const roadId=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent();return p.maps[p.startMapId].terrainDesign.features.at(-1).id;});
 await open();await field("feature").selectOption(roadId);await field("width").selectOption("5");await close();await page.keyboard.press("Enter");await settle(700);
 observed.ramps=await page.evaluate(async()=>{const {inspectTerrainRoute}=await import("/src/project/terrainRoute.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return {ramps:m.relief.ramps.filter(Boolean).length,route:inspectTerrainRoute(p,m,{x:18,y:23},{x:18,y:10},3)};});assert(observed.ramps.route.reachable,"road connection failed");
 for(const [a,b,h]of [[[26,19],[28,23],2],[[32,19],[35,23],5]]){await choose("contour");await field("shape").selectOption("rect");await num("delta",h);await points([a,b]);}
 await choose("road");await field("width").selectOption("1");await points([[24,21],[37,21]]);
 observed.multi=await page.evaluate(async()=>{const {inspectTerrainRoute}=await import("/src/project/terrainRoute.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return inspectTerrainRoute(p,m,{x:24,y:21},{x:37,y:21},1);});assert(observed.multi.reachable,"narrow multi elevation route failed");await shot("02-ramps");
 await film.caption("3. 호수 재편집 · 깊이 색상과 고저차 폭포");
 await choose("lake");await field("shape").selectOption("rect");await num("water-level",3);await num("water-depth",3);await num("shallows",1);await points([[3,5],[9,10]]);
 const lakeId=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent();return p.maps[p.startMapId].terrainDesign.features.at(-1).id;});await open();await field("feature").selectOption(lakeId);await num("water-depth",6);await num("water-level",2);await close();await page.keyboard.press("Enter");await settle(600);
 await choose("lake");await field("shape").selectOption("rect");await num("water-level",0);await points([[3,11],[9,18]]);
 observed.water=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return {high:m.relief.levels[8*40+6],low:m.relief.levels[14*40+6],deep:Math.max(...m.terrainDesign.waterDepth),features:m.terrainDesign.features.filter(f=>f.tool==="lake").length};});assert(observed.water.high===2&&observed.water.deep>1,"lake edit failed");await shot("03-waterfall");
 await film.caption("침식 · 평활화 · 절벽 모서리 다듬기");await choose("ridge");await field("width").selectOption("7");await num("delta",6);await points([[28,7],[34,9]]);
 const finishBefore=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent();return JSON.stringify(p.maps[p.startMapId].relief.levels);});
 for(const method of ["erode","smooth","corners"]){await choose("finish");await field("finish-method").selectOption(method);await num("finish-passes",2);await points([[24,3],[37,3],[37,14],[24,14]]);}
 observed.finish=await mapRead(()=>{const p=window.__oprnEditorStore.getCurrent();return JSON.stringify(p.maps[p.startMapId].relief.levels);});assert(observed.finish!==finishBefore,"finishing made no change");await shot("04-finish");
 await film.caption("4. 게임 상태 경로 검사 · 문·NPC·스위치·몸 크기");
 await page.evaluate(()=>{const store=window.__oprnEditorStore,p=store.getCurrent(),id=p.startMapId;store.update(d=>{d.switches=[...d.switches,{id:"qa_gate_open",name:"QA 문 열림"}];d.maps[id].events.push({id:"qa_gate",name:"검사할 문",x:20,y:26,trigger:{kind:"action"},commands:[],pages:[{id:"closed",name:"닫힘",conditions:[],graphic:{},trigger:{kind:"action"},commands:[],priority:"same",overlapForbidden:true,movement:{type:"fixed",speed:3,frequency:3}},{id:"open",name:"열림",conditions:[{kind:"switch",switchId:"qa_gate_open",value:true}],graphic:{},trigger:{kind:"action"},commands:[],priority:"below",overlapForbidden:false,movement:{type:"fixed",speed:3,frequency:3}}]});for(let y=24;y<=29;y++){if(y===26)continue;d.maps[id].upperTiles[y*40+20]=3;}},{scope:"project",label:"경로 상태 QA 문"});});
 await choose("route");await field("route-door").selectOption("qa_gate");await field("route-doors").selectOption("closed");await close();await click(17,26);await click(23,26);await open();await settle();
 const getRoute=()=>page.evaluate(async()=>{const {terrainRouteResult}=await import("/src/editor/terrainDesignOverlay.ts"),{editorState}=await import("/src/editor/editorState.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId],s=editorState.get();return terrainRouteResult(p,m,s.terrainRoute,s.terrainRouteWidth,s);});
 observed.closed=await getRoute();await field("route-doors").selectOption("authored");await field("route-switch-qa_gate_open").check();await settle();observed.open=await getRoute();
 // Walls intentionally form a narrow door gap; compare body size on the same route.
 await num("body-width",3);await num("body-height",3);await num("pass-rows",3);await settle();observed.large=await getRoute();await num("body-width",1);await num("body-height",1);await num("pass-rows",1);
 assert(observed.open.reachable,"switch-resolved door did not open");await shot("05-route-state");
 await film.caption("5. 공용 도장 · 썸네일·검색·파일 내보내기");await choose("stamp");await field("stamp-mode").selectOption("capture");await field("stamp-name").fill("폭포 호수");await field("stamp-name").press("Tab");await close();await click(2,4);await click(10,19);await open();await field("shared-stamps").evaluate(n=>n.open=true);await field("stamp-share").click();await field("stamp-cards").locator("button").first().waitFor();await field("stamp-search").fill("폭포");await settle(500);
 const download=page.waitForEvent("download");await field("stamp-export").click();await(await download).saveAs(resolve(out,"terrain-stamps.json"));
 observed.library=JSON.parse(readFileSync(resolve(out,"terrain-stamps.json"),"utf8")).stamps.length;assert(observed.library>0,"shared export empty");await shot("06-library");
 const saved=await page.evaluate(async()=>{const {serialize}=await import("/src/project/io.ts");return serialize(window.__oprnEditorStore.getCurrent());});writeFileSync(".vite-cache/terrain-evolution-fixture.json",saved);
 await film.caption("6. 시야 차단 ON/OFF · 고지 시야와 발사체 높이 설정");await field("gameplay").evaluate(n=>n.open=true);await field("vision-radius").scrollIntoViewIfNeeded();await num("vision-radius",16);await field("vision-blocking").check();await field("high-ground-vision").check();await field("projectile-height").check();await field("vision-preview").check();await close();await click(16,20);await settle(700);await shot("07-vision-on");
 observed.vision=await page.evaluate(async()=>{const {terrainLineOfSight,terrainVisionRange,terrainBlocksProjectile}=await import("/src/project/terrainGameplay.ts");const p=window.__oprnEditorStore.getCurrent(),m=p.maps[p.startMapId];return {blocked:!terrainLineOfSight(m,{x:11,y:11},{x:25,y:11}),lowRange:terrainVisionRange(m,{x:11,y:11},8),highRange:terrainVisionRange(m,{x:16,y:11},8),projectileBlocked:terrainBlocksProjectile(m,16,11,1)};});assert(observed.vision.blocked&&observed.vision.highRange>observed.vision.lowRange&&observed.vision.projectileBlocked,"gameplay rules failed");
 await open();await field("vision-blocking").uncheck();await close();await settle(1000);await shot("08-vision-off");await open();await field("vision-blocking").check();await field("vision-preview").uncheck();await close();
 const wire=await page.evaluate(async()=>{const {serialize}=await import("/src/project/io.ts");return serialize(window.__oprnEditorStore.getCurrent());});writeFileSync(".vite-cache/terrain-evolution-fixture.json",wire);
 observed.errors=errors;writeFileSync(resolve(out,"observations.json"),JSON.stringify(observed,null,2));assert(!errors.length,"editor page errors");observed.editorFilm=await film.stop();film=null;
 console.log(JSON.stringify({editor:observed}));
 // Reopen another editor project in the same browser and import from its independent library.
 const other=await context.newPage();await other.goto(`${process.env.TERRAIN_CAPTURE_URL??"http://127.0.0.1:9833"}/?blankProject=1`,{waitUntil:"load",timeout:120000});await other.waitForFunction(()=>window.__oprnEditorStore&&window.__oprnEditWorldToClient,null,{timeout:120000});await other.getByTestId("boot-loader").waitFor({state:"hidden",timeout:120000});
 await other.evaluate(async()=>{const {editorState}=await import("/src/editor/editorState.ts");editorState.set({tool:"relief",layer:"lower",terrainBrush:"stamp",terrainStampCapture:false,terrainDesignOpen:true});});await other.getByTestId("terrain-design-shared-stamps").evaluate(n=>n.open=true);await other.getByTestId("terrain-design-stamp-cards").locator("button").first().waitFor();
 observed.reuse=await other.evaluate(()=>({before:window.__oprnEditorStore.getCurrent().terrainStamps?.length??0,identity:window.__oprnEditorStore.getProjectIdentity()}));assert(observed.reuse.before===0,"other project was not empty");await other.getByTestId("terrain-design-stamp-cards").locator("button").first().click();observed.reuse.after=await other.evaluate(()=>window.__oprnEditorStore.getCurrent().terrainStamps?.length??0);assert(observed.reuse.after>0,"cross project shared stamp failed");await other.screenshot({path:resolve(out,"11-library-other-project.png")});
 observed.errors=errors;writeFileSync(resolve(out,"observations.json"),JSON.stringify(observed,null,2));assert(!errors.length,"editor page errors");console.log(JSON.stringify({reuse:observed.reuse}));
}catch(e){await page.screenshot({path:resolve(".vite-cache/terrain-evolution-debug.png"),timeout:5000}).catch(()=>{});console.error(e);process.exitCode=1;}finally{await browser.close();}
