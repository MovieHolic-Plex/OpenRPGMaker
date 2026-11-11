// 테마 전투 배경의 참고 장소(모델 없음): placeTheme 표가 바라는 배경마다 그 세계·종류의 맵을 구성기로 한 장 깔고
// 프로젝트 JSON(번들 타일셋은 차이 저장)과 1배 그림을 남긴다 — battle-backdrop 하네스 capture 의 --project 로 준다.
//   bun scripts/qa/assistant-v2/themeBackdropPlaces.mts <outDir> [key,key…]
//   → <outDir>/<key>.project.json · <key>.map.png · places.json(키 → 맵 id·크기·세계/종류·테마가 고른 전투 배경)
// 문서 openwiki/harnesses/battle-backdrop.md 「장소 테마 배경(번들 한 장 그림)」.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { serialize } from "../../../src/project/io/serialize.ts";
import { worldById, worldPlaceSpec } from "../../../src/ai/v2/place/world.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { applyThemeBackdrop, placeThemeOf } from "../../../src/ai/v2/place/placeTheme.ts";
import { normalizeGameBlueprint } from "../../../src/project/gameBlueprint.ts";
import { renderMapPng } from "../../qa-game/render.mts";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 바라는 배경 하나 = 번들 키(battle-scenery-<key>) · 그 장소를 대표하는 세계/종류 · 생성기에 줄 한 줄. */
export const THEME_BACKDROP_PLACES: readonly { key: string; world: string; kind: string; wanted: string; note?: string }[] = [
  { key: "tomb", world: "desert_east", kind: "tomb", wanted: "stone burial chamber", note: "A sealed sandstone burial chamber inside a pyramid: block walls, pillars, a sarcophagus and urns against the back wall, torch light." },
  { key: "adobe-room", world: "desert_east", kind: "teahouse", wanted: "adobe room interior", note: "A plastered adobe room of a desert town: arched niches, woven rugs hung on the back wall, low cushions and lamps along the back wall." },
  { key: "ice-cave", world: "snow_north", kind: "ice-cave", wanted: "ice cave interior", note: "Inside an ice cave: blue ice walls, icicles from the ceiling, a frozen flat floor." },
  { key: "log-hall", world: "snow_north", kind: "longhall", wanted: "log hall interior", note: "Inside a northern log long hall: log walls, beams, a hearth and benches against the back wall." },
  { key: "beach", world: "pirate_isles", kind: "beach", wanted: "tropical beach and sea", note: "A tropical beach: palms and the turquoise sea at the horizon in the upper half, flat pale sand below." },
  { key: "shipwreck", world: "pirate_isles", kind: "wreck", wanted: "shipwreck on a reef", note: "A reef at low tide with the broken hull of a wooden ship in the distance; flat wet sand and rock below." },
  { key: "tavern", world: "pirate_isles", kind: "tavern", wanted: "ship deck / tavern interior", note: "Inside a wooden pirate tavern: plank walls, barrels, a bar counter and lanterns against the back wall." },
  { key: "cloud-sea", world: "sky_island", kind: "village", wanted: "sky above a sea of clouds", note: "The grassy edge of a floating island high in the sky: open blue sky and a sea of clouds at the horizon, distant floating islands; flat grass below." },
  { key: "sky-shrine", world: "sky_island", kind: "shrine-hall", wanted: "shrine inner hall", note: "Inner hall of a sky shrine: pale stone columns, an altar against the back wall, soft light from above." },
  { key: "swamp", world: "prehistoric", kind: "swamp", wanted: "primeval reed swamp", note: "A primeval swamp: tall reeds, giant ferns and murky water in the upper half; flat mud bank below." },
  { key: "volcano", world: "prehistoric", kind: "volcano", wanted: "lava field at a volcano", note: "The foot of a smoking volcano: black basalt, glowing lava streams in the distance; flat dark rock below." },
  { key: "edo-town", world: "sengoku_edo", kind: "castle", wanted: "castle yard / Edo town", note: "A Japanese castle yard: white plaster walls with dark tiled roofs, a stone base and pines in the upper half; flat packed earth below." },
  { key: "brick-street", world: "steampunk_city", kind: "street", wanted: "brick street under factory smoke", note: "A brick street of a steam-age city: brick row houses, pipes and chimneys under a smoky sky in the upper half; flat cobblestones below." },
  { key: "boiler-room", world: "steampunk_city", kind: "boiler-room", wanted: "boiler / engine room interior", note: "A boiler room: riveted iron boilers, copper pipes, gauges without readable text and a furnace glow against the back wall; flat iron-plate floor." },
  { key: "station", world: "sf_station", kind: "station", wanted: "station corridor / moon surface", note: "A space station corridor: metal wall panels, a long window showing stars, soft strip lights; flat metal deck floor." },
];

/** 실제 게임과 같은 모양의 청사진 한 장 — 테마는 장소 목록(이름 → 종류)으로 종류를 읽고, 플레이어 로더는 온전한 청사진만 받는다. */
export function placeBlueprint(worldId: string, placeName: string, kindId: string): unknown {
  return normalizeGameBlueprint({
    title: "테마 전투 배경 시험", genre: "모험", setting: worldId, playerGoal: "이 장소의 적과 싸운다.", ending: { name: "끝", how: "끝났다.", feeling: "안도" },
    places: [{ name: placeName, kind: kindId }],
    steps: [{ id: "s1", place: placeName, event: "적", action: "적과 싸운다", gives: "승리", feeling: "긴장" }, { id: "s2", place: placeName, event: "끝", action: "돌아간다", needs: "승리", gives: "엔딩", feeling: "안도" }],
  });
}

function build(entry: (typeof THEME_BACKDROP_PLACES)[number]): { project: any; mapId: string } {
  const world = worldById(entry.world);
  const kind = world?.kinds.find((k) => k.id === entry.kind);
  if (!world || !kind) throw new Error(`세계/종류가 없다: ${entry.world}/${entry.kind}`);
  const ctx: any = { project: createBlankProject(), currentMapId: undefined, assistantRun: true };
  ctx.currentMapId = ctx.project.startMapId;
  const calls: any[] = [];
  const run: any = { ctx, calls, call: (tool: string, args: any) => { let r: any; try { r = runTool(ctx, tool, args); } catch (e) { r = { ok: false, summary: `${tool} threw ${(e as Error).message}` }; } calls.push({ tool, args, ok: r.ok, summary: String(r.summary ?? "").slice(0, 200) }); return r; } };
  const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
  const builder = builderFor(spec as any);
  if (!builder) throw new Error(`빌더가 없다: ${entry.world}/${entry.kind}`);
  const res: any = builder.build(run, spec as any);
  if (!res.ok || !res.mapIds?.length) throw new Error(`${entry.key}: ${String(res.summary).slice(0, 240)}`);
  const mapId = res.entrance?.mapId ?? res.mapIds[0];
  // 테마는 청사진의 장소 목록(이름 → 종류)으로 종류를 읽는다 — 실제 게임과 같은 모양으로 한 줄 적어 둔다.
  const p = ctx.project;
  p.gameBlueprint = placeBlueprint(world.id, p.maps[mapId].name, kind.id);
  return { project: p, mapId };
}

if (import.meta.main) {
  const out = process.argv[2];
  if (!out) throw new Error("bun scripts/qa/assistant-v2/themeBackdropPlaces.mts <outDir> [key,key…]");
  const only = process.argv[3]?.split(",");
  fs.mkdirSync(out, { recursive: true });
  const indexFile = path.join(out, "places.json");
  const index: Record<string, unknown> = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : {};
  for (const entry of THEME_BACKDROP_PLACES) {
    if (only && !only.includes(entry.key)) continue;
    try {
      const { project, mapId } = build(entry);
      const map = project.maps[mapId];
      fs.writeFileSync(path.join(out, `${entry.key}.map.png`), renderMapPng(project, { ...map, events: [] }).png);
      const theme = placeThemeOf(project, mapId);
      const applied = applyThemeBackdrop(project, mapId);
      fs.writeFileSync(path.join(out, `${entry.key}.project.json`), serialize(project));
      index[entry.key] = { world: entry.world, kind: entry.kind, wanted: entry.wanted, note: entry.note, mapId, name: map.name, size: [map.width, map.height], tilesetId: map.tilesetId, theme: theme?.id, battleBackground: project.maps[mapId].battleBackground, gap: applied.gap };
      console.log(`${entry.key}: ${mapId} 「${map.name}」 ${map.width}×${map.height} · 테마 ${theme?.id} · 전투 배경 ${project.maps[mapId].battleBackground}${applied.gap ? " · " + applied.gap : ""}`);
    } catch (e) {
      console.error(`${entry.key}: 실패 — ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1) + "\n");
}
