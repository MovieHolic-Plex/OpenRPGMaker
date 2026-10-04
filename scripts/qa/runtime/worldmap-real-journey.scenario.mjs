// SQLite에서 다시 읽은 원본을 사용한다. WM_JOURNEY_PROJECT는 --project와 같은 파일이다.
import { readFileSync } from "node:fs";
const project = JSON.parse(readFileSync(process.env.WM_JOURNEY_PROJECT, "utf8"));
const joseon = project.maps.map_hanyang !== undefined;
const start = project.startPos;
const town = joseon ? { id:"map_hanyang", x:31, y:55 } : { id:"map_beodeul_river_7", x:1, y:21 };
const opening = project.system.opening;
const scene = (id) => `[data-testid="cinematic-sequence"][data-scene-id="${id}"]`;
const ready = (mapId,x,y) => ({kind:"waitForAttr",testid:"runtime-state-json",attr:"data-live-flags",value:`${mapId}|${x}|${y}|true|false`});
// 타이틀 연출의 첫 입력은 메뉴 확정 대신 연출만 끝낸다.
const titleOps = project.system.titleScreen?.sequence !== undefined ? [
  {kind:"key",key:"Enter"}, {kind:"waitForAttr",testid:"title-screen",attr:"data-seq-state",value:"done"},
] : [];
const openingOps = opening?.enabled && opening.scenes?.length ? [
  ...opening.scenes.map((s) => ({ kind:"cinematic", action:"key", key:"Enter", selector:scene(s.id) })),
  { kind:"cinematic", action:"key", key:"Enter", selector:'[data-testid="cinematic-sequence"]', absent:true },
] : [{ kind:"key", key:"Enter" }];
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id:"worldmap-real-journey",
  beats:[
    {id:"title",note:"저장한 원본 타이틀",expect:{testidPresent:["title-screen"]}},
    {id:"world-start",note:"오프닝 뒤 축소 캐릭터로 실제 지리 지도 시작",ops:[...titleOps,...openingOps,{kind:"waitForRuntime"},ready(project.startMapId,start.x,start.y)],
      expect:{mapId:project.startMapId,x:start.x,y:start.y,playerSpriteTextureLoaded:true,testidAbsent:["title-screen","cinematic-sequence"]},shot:true},
    {id:"enter-town",note:"실제 키 입력으로 성문에 들어가 시작 고을 도착",ops:[{kind:"key",key:"ArrowUp"},{kind:"waitForPosition",mapId:town.id,x:town.x,y:town.y},ready(town.id,town.x,town.y)],
      expect:{mapId:town.id,x:town.x,y:town.y,playerSpriteTextureLoaded:true},shot:true},
    {id:"return-world",note:"고을 출입구를 실제로 밟아 세계 지도 복귀",ops:joseon ? [
      {kind:"key",key:"ArrowLeft"},{kind:"waitForPosition",mapId:town.id,x:30,y:55},
      {kind:"key",key:"ArrowLeft"},{kind:"waitForPosition",mapId:project.startMapId,x:start.x,y:start.y},
    ] : [{kind:"key",key:"ArrowDown"},{kind:"waitForPosition",mapId:project.startMapId,x:start.x,y:start.y}],
      expect:{mapId:project.startMapId,x:start.x,y:start.y,playerSpriteTextureLoaded:true},shot:true},
  ],
};
