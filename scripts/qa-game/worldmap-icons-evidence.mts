// Node 24 + scripts/ontology-ts-loader.mjs의 withTsModule로 실행한다.
// 원본 두 정본에는 번들만 보충한다. 새 정본에는 선택 아이콘 도감을 저장한다.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { createBlankProject } from "../../src/project/defaults";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets";
import { WORLDMAP_SELECTED_ICONS } from "../../src/project/defaults/worldmapSelected";
import { WORLDMAP_ICON_TOOLS } from "../../src/editor/tools/worldmapIconTools";
import { isPassable } from "../../src/project/collision";
import { prepareWebExport } from "../../src/project/webExport";
import { WORLD_TERRAIN_TOOLS } from "../../src/editor/tools/worldTerrainTools";
import { setWorldmapBuilder, type WorldmapBuildResult, type WorldmapWorld } from "../../src/editor/worldmap/worldmapBuild";
import type { GameMap, MapId, Project, TilesetId } from "../../src/project/types";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function portable(project: Project, dir: string): Project {
  const p = structuredClone(project);
  for (const asset of Object.values(p.assets.uploaded)) {
    if (asset.ref && !asset.dataUrl) {
      const r = asset.ref;
      const bytes = readFileSync(join(dir, "assets", `${r.sha256}.${r.extension}`));
      assert(createHash("sha256").update(bytes).digest("hex") === r.sha256, "asset hash mismatch");
      asset.dataUrl = `data:${r.mime};base64,${bytes.toString("base64")}`;
      delete asset.ref;
    }
  }
  return p;
}

export async function run(sourceDirs: string[], newDir: string, evidenceDir: string, fixtureDir: string): Promise<void> {
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(fixtureDir, { recursive: true });
  const receipts = [];
  for (const [index, dir] of sourceDirs.entries()) {
    const store = await openLocalProjectStore({ projectDir: dir });
    const p = structuredClone(store.loadSnapshot()!.project);
    const before = sha({ maps: p.maps, startMapId: p.startMapId, startPos: p.startPos });
    ensureBundledTilesets(p);
    const result = await store.saveProject(p);
    assert(result.kind === "saved", "canonical save conflict");
    const projectId = store.projectId;
    store.close();
    const reopen = await openLocalProjectStore({ projectDir: dir });
    const snapshot = reopen.loadSnapshot()!;
    assert(sha({ maps: snapshot.project.maps, startMapId: snapshot.project.startMapId, startPos: snapshot.project.startPos }) === before, "original maps changed");
    const selected = snapshot.project.tilesets.worldmap_selected!;
    assert(selected.structureKits?.length === 79 && selected.referenceDocuments!.some((cat) => cat.id === "wmi-fantasy"), "existing project missing shared icons/references");
    writeFileSync(join(fixtureDir, index === 0 ? "joseon.json" : "maya.json"), JSON.stringify(portable(snapshot.project, dir)));
    receipts.push({ projectId, projectDir: dir, revision: snapshot.revision, mapsUnchanged: true, icons: selected.structureKits!.length,
      referenceCategories: selected.referenceDocuments!.map((cat) => cat.id), saved: true, reopened: true });
    reopen.close();
  }
  const p = createBlankProject();
  p.meta.title = "사람 선택 월드맵 아이콘 도감";
  p.system.opening = undefined;
  const stamp = WORLDMAP_ICON_TOOLS.find((tool) => tool.name === "stamp_worldmap_icon")!;
  const placements: unknown[] = [];
  for (const theme of [...new Set(WORLDMAP_SELECTED_ICONS.map((i) => i.theme))]) {
    const id = `wmi_${theme}` as MapId;
    const width = 64, height = 56;
    const map: GameMap = { ...structuredClone(Object.values(p.maps)[0]!), id, name: theme + " · 선택 아이콘 도감", width, height,
      tilesetId: "worldmap_selected" as TilesetId, tileSize: 16, lowerTiles: Array(width * height).fill(240), upperTiles: Array(width * height).fill(-1),
      lowerOverlayTiles: Array(width * height).fill(-1), upperOverlayTiles: Array(width * height).fill(-1), events: [], characterScale: .5 };
    p.maps[id] = map;
    p.mapTree.children.push({ mapId: id, children: [] });
    const icons = WORLDMAP_SELECTED_ICONS.filter((i) => i.theme === theme);
    for (const [i, icon] of icons.entries()) {
      const at = { x: 3 + (i % 8) * 7, y: 3 + Math.floor(i / 8) * 9 };
      const result = stamp.run(p, { mapId: id, iconId: icon.id, at });
      const data = result.data as { entrance: {x:number;y:number}; approach: {x:number;y:number} };
      assert(isPassable(p, map, data.entrance.x, data.entrance.y), "entrance blocked");
      assert(isPassable(p, map, data.approach.x, data.approach.y), "approach blocked");
      placements.push({ mapId: id, at, ...data });
    }
  }
  p.startMapId = "wmi_fantasy" as MapId;
  p.startPos = { x: 6, y: 9 };
  const newStore = await initLocalProjectStore({ projectDir: newDir });
  assert((await newStore.saveProject(p)).kind === "saved", "new canonical save conflict");
  const projectId = newStore.projectId;
  newStore.close();
  const reopened = await openLocalProjectStore({ projectDir: newDir });
  const saved = reopened.loadSnapshot()!;
  assert(sha(saved.project.maps) === sha(p.maps), "catalog maps did not reload exactly");
  writeFileSync(join(fixtureDir, "icons.json"), JSON.stringify(portable(saved.project, newDir)));
  receipts.push({ projectId, projectDir: newDir, revision: saved.revision, icons: placements.length, saved: true, reopened: true });
  reopened.close();

  // 구조적 거부가 원본을 부분 수정하지 않는지 실제 도구로 확인한다.
  const guards = [];
  const clone = structuredClone(p);
  const inspect = WORLDMAP_ICON_TOOLS.find((tool) => tool.name === "inspect_worldmap_icon")!;
  const checkArgs = {mapId:"wmi_fantasy",iconId:"fantasy/city_capital",at:{x:3+(7%8)*7,y:3+Math.floor(7/8)*9}};
  const capitalIndex = WORLDMAP_SELECTED_ICONS.filter((i)=>i.theme==="fantasy").findIndex((i)=>i.id==="fantasy/city_capital");
  checkArgs.at = {x:3+(capitalIndex%8)*7,y:3+Math.floor(capitalIndex/8)*9};
  assert((inspect.run(clone, checkArgs).data as {ok:boolean}).ok, "inspect rejects intact stamp");
  const missing = {x:checkArgs.at.x,y:checkArgs.at.y+5};
  const broken = structuredClone(clone);
  broken.maps.wmi_fantasy!.upperTiles[missing.y*64+missing.x] = -1;
  const errors = (inspect.run(broken,checkArgs).data as {issues:{code:string;x:number;y:number}[]}).issues;
  assert(errors.length===1 && errors[0]!.code==="MISSING_CELL" && errors[0]!.x===missing.x && errors[0]!.y===missing.y,"missing cell not detected at actual map coordinate");
  for (const args of [
    { mapId: "wmi_fantasy", iconId: "steampunk/capital", at: {x:1,y:1} },
    { mapId: "wmi_fantasy", iconId: "fantasy/city_capital", at: {x:63,y:55} },
    { mapId: "wmi_fantasy", iconId: "fantasy/city_capital", at: {x:3,y:3} },
  ]) {
    const before = sha(clone);
    let error: {code?:string} | undefined;
    try { stamp.run(clone, args); } catch (e) { error = e as {code?:string}; }
    assert(error && sha(clone) === before, "rejected stamp mutated project");
    guards.push(error.code);
  }
  // 다른 타일셋에 이식해도 원래 바닥·id가 유지되며 재사용 시 새 슬롯이 늘지 않는다.
  const map = clone.maps.wmi_modern_sf ?? clone.maps["wmi_modern-sf"]!;
  map.tilesetId = "easyrpg_chipset_world" as TilesetId;
  map.upperTiles.fill(-1);
  const count = clone.tilesets[map.tilesetId]!.count;
  const lowerSha = sha(map.lowerTiles);
  stamp.run(clone, {mapId:map.id,iconId:"modern-sf/capital",at:{x:4,y:4}});
  const after = clone.tilesets[map.tilesetId]!.count;
  stamp.run(clone, {mapId:map.id,iconId:"modern-sf/capital",at:{x:20,y:4}});
  assert(after === count + 36 && clone.tilesets[map.tilesetId]!.count === after && sha(map.lowerTiles) === lowerSha, "graft changed ground or grew twice");
  writeFileSync(join(evidenceDir, "save-reload.json"), JSON.stringify({ receipts, placements, guards, missingCell: errors, crossTileset: {groundPreserved:true,slotsAdded:36,secondStampSlotsAdded:0} }, null, 2) + "\n");
  console.log(JSON.stringify({ receipts, guards, crossTileset: "ground preserved; 36 source cells reused" }, null, 2));
}

/** 저장한 도감의 검사와 기록된 실제 렌더의 재적용. 정본을 수정하지 않는다. */
export async function verifySaved(newDir: string, evidenceDir: string, worldPath: string, imagePath: string): Promise<void> {
  const store = await openLocalProjectStore({ projectDir: newDir });
  const snapshot = store.loadSnapshot()!;
  const projectId = store.projectId;
  const clone = structuredClone(snapshot.project);
  store.close();
  const capitalIndex = WORLDMAP_SELECTED_ICONS.filter((i) => i.theme === "fantasy").findIndex((i) => i.id === "fantasy/city_capital");
  const at = { x: 3 + capitalIndex % 8 * 7, y: 3 + Math.floor(capitalIndex / 8) * 9 };
  const checkArgs = { mapId: "wmi_fantasy", iconId: "fantasy/city_capital", at };
  const inspect = WORLDMAP_ICON_TOOLS.find((t) => t.name === "inspect_worldmap_icon")!;
  assert((inspect.run(clone, checkArgs).data as {ok:boolean}).ok, "intact saved stamp rejected");
  const missing = {x:at.x,y:at.y+5};
  clone.maps.wmi_fantasy!.upperTiles[missing.y * 64 + missing.x] = -1;
  const errors = (inspect.run(clone, checkArgs).data as {issues:{code:string;x:number;y:number}[]}).issues;
  assert(errors.length === 1 && errors[0]!.code === "MISSING_CELL" && errors[0]!.x === missing.x && errors[0]!.y === missing.y, "missing cell coordinates differ");
  const covered = structuredClone(snapshot.project);
  covered.maps.wmi_fantasy!.upperOverlayTiles![at.y*64+at.x] = 0;
  const overlayErrors = (inspect.run(covered,checkArgs).data as {issues:{code:string;x:number;y:number}[]}).issues;
  assert(overlayErrors.length===1 && overlayErrors[0]!.code==="OCCUPIED_OVERLAY","covered stamp passed inspection");

  const world = JSON.parse(readFileSync(worldPath,"utf8")) as WorldmapWorld;
  const built: Extract<WorldmapBuildResult,{ok:true}> = {ok:true,preview:false,theme:"fantasy",world,
    imageDataUrl:`data:image/png;base64,${readFileSync(imagePath).toString("base64")}`,ascii:"recorded build",themeNote:"recorded build",journeyCheck:{ok:true,bad:[]},warnings:[],seconds:0};
  const edit = WORLD_TERRAIN_TOOLS.find((t) => t.name === "edit_world_terrain")!;
  setWorldmapBuilder(async () => structuredClone(built));
  try {
    const args = {newMapId:"wmi_regeneration",ops:[],theme:"fantasy"};
    await edit.prepare!(args,clone);
    edit.run(clone,args);
    const map = clone.maps.wmi_regeneration!;
    let place: {x:number;y:number} | undefined;
    for (let y=0;y<map.height-6 && !place;y++) for (let x=0;x<map.width-6;x++) {
      if ([0,1,2,3,4,5].every((dx) => world.walk[y+5]![x+dx] === "1") && world.walk[y+6]![x+3] === "1") {place={x,y};break;}
    }
    assert(place,"no open backing in recorded world");
    const stamp = WORLDMAP_ICON_TOOLS.find((t)=>t.name === "stamp_worldmap_icon")!;
    stamp.run(clone,{mapId:map.id,iconId:"modern-sf/capital",at:place});
    map.lowerOverlayTiles = Array(map.width*map.height).fill(-1);
    map.upperOverlayTiles = Array(map.width*map.height).fill(-1);
    map.shadowBits = Array(map.width*map.height).fill(0);
    map.lowerOverlayTiles[0] = 0; map.upperOverlayTiles[map.width*map.height-1] = 1; map.shadowBits[2] = 1;
    const layers = (m: GameMap) => [m.upperTiles,m.lowerOverlayTiles,m.upperOverlayTiles,m.shadowBits];
    const oldLayers = sha(layers(map));
    const oldT = structuredClone(clone.tilesets[map.tilesetId]!);
    const again = {mapId:map.id,ops:[]};
    await edit.prepare!(again,clone); edit.run(clone,again);
    const freshT = clone.tilesets[map.tilesetId]!;
    assert(sha(layers(clone.maps[map.id]!)) === oldLayers,"regeneration erased authored layers");
    assert(freshT.count === oldT.count && sha(freshT.tileGrafts) === sha(oldT.tileGrafts),"regeneration erased grafts");
    for (const g of oldT.tileGrafts!) assert(sha([freshT.passability[g.targetTile],freshT.priority[g.targetTile],freshT.tileMeta![g.targetTile]]) === sha([oldT.passability[g.targetTile],oldT.priority[g.targetTile],oldT.tileMeta![g.targetTile]]),"regeneration changed graft passage");
    assert((inspect.run(clone,{mapId:map.id,iconId:"modern-sf/capital",at:place}).data as {ok:boolean}).ok,"regenerated icon changed cells");
    setWorldmapBuilder(async () => ({...structuredClone(built),world:{...structuredClone(world),width:world.width+1}}));
    const resize = {mapId:map.id,ops:[],theme:"modern-town"};
    await edit.prepare!(resize,clone);
    const before = sha(clone);
    let code: string | undefined;
    try {edit.run(clone,resize);} catch (e) {code=(e as {code?:string}).code;}
    assert(code === "authored-worldmap-resize" && sha(clone) === before,"resize partially mutated authored world");
    const receipt = {projectId,projectDir:newDir,revision:snapshot.revision,characterScale:snapshot.project.maps.wmi_fantasy!.characterScale,
      intactStamp:true,missingCell:errors,occupiedOverlay:overlayErrors,regeneration:{layersPreserved:true,graftSlots:oldT.tileGrafts!.length,passagePreserved:true,resizeRejectedAtomically:true},
      renderer:"recorded actual Python output; injected builder; no re-render",canonicalModified:false};
    writeFileSync(join(evidenceDir,"inspection-regeneration.json"),JSON.stringify(receipt,null,2)+"\n");
    console.log(JSON.stringify(receipt,null,2));
  } finally {setWorldmapBuilder(undefined);}
}

/** 정본 도감에 다른 타일셋 이식 예제를 저장하고 출하 플레이어 입력 픽스처를 내보낸다. */
export async function saveGraftDemo(newDir: string, evidenceDir: string, fixtureDir: string): Promise<void> {
  const store = await openLocalProjectStore({projectDir:newDir});
  const p = structuredClone(store.loadSnapshot()!.project);
  const id = "wmi_graft" as MapId;
  const map: GameMap = {...structuredClone(p.maps.wmi_fantasy!),id,name:"선택 아이콘 · 다른 칩셋에 이식",width:32,height:24,
    tilesetId:"easyrpg_chipset_world" as TilesetId,lowerTiles:Array(32*24).fill(240),upperTiles:Array(32*24).fill(-1),
    lowerOverlayTiles:Array(32*24).fill(-1),upperOverlayTiles:Array(32*24).fill(-1),events:[],characterScale:.75};
  p.maps[id]=map;
  if (!p.mapTree.children.some((m)=>m.mapId===id)) p.mapTree.children.push({mapId:id,children:[]});
  const stamp = WORLDMAP_ICON_TOOLS.find((t)=>t.name === "stamp_worldmap_icon")!;
  stamp.run(p,{mapId:id,iconId:"modern-sf/capital",at:{x:4,y:4}});
  stamp.run(p,{mapId:id,iconId:"fantasy/city_capital",at:{x:20,y:4}});
  assert((await store.saveProject(p)).kind === "saved","graft demo save conflict");
  const projectId = store.projectId;
  store.close();
  const reopened = await openLocalProjectStore({projectDir:newDir});
  const saved = reopened.loadSnapshot()!;
  assert(sha(saved.project.maps[id]) === sha(map),"graft map changed after reload");
  const t = saved.project.tilesets[map.tilesetId]!;
  assert(t.tileGrafts?.length === 72,"graft tail missing after reload");
  // 새 프로젝트의 전체 기본 자료는 150MB 이상이다. 이번 입력 QA는 도감의 모든 맵과 그 맵이 쓰는 타일셋만 검사한다.
  const usedTilesets = new Set(Object.values(saved.project.maps).map((m)=>m.tilesetId));
  const runtimeSlice = {...saved.project,tilesets:Object.fromEntries(Object.entries(saved.project.tilesets).filter(([id])=>usedTilesets.has(id)))};
  const prepared = prepareWebExport(portable(runtimeSlice,newDir));
  const fixture = prepared.project;
  fixture.startMapId=id; fixture.startPos={x:7,y:10};
  writeFileSync(join(fixtureDir,"graft.json"),JSON.stringify(fixture));
  const receipt = {projectId,projectDir:newDir,revision:saved.revision,mapId:id,tilesetId:map.tilesetId,graftSlots:t.tileGrafts!.length,
    originalStartPreserved:true,characterScale:saved.project.maps.wmi_fantasy!.characterScale,saved:true,reopened:true,
    runtimeProjection:"catalog maps and used tilesets → prepareWebExport",runtimeBytes:prepared.summary.projectJsonBytes,
    exportIncludesSelectedImage:prepared.assets.some((a)=>a.zipPath==="assets/worldmap-icons/worldmap-selected.png"),
    exportIncludesSelectedCredits:prepared.assets.some((a)=>a.zipPath==="assets/worldmap-icons/ATTRIBUTION.md")};
  writeFileSync(join(evidenceDir,"graft-save-reload.json"),JSON.stringify(receipt,null,2)+"\n");
  reopened.close();
  console.log(JSON.stringify(receipt,null,2));
}
