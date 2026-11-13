// 테마 전투 배경 증명(모델 없음): 그 세계·종류의 장소를 구성기로 깔고 실제 빌더의 채우기(populateWorldPlace — 보이는 적·상자·전투 배경)를 돌린 뒤
// 저장된 맵 데이터의 전투 배경 id 와, 그 맵의 적과 싸울 때 런타임이 고르는 배경(resolveBattleBackdrop)을 적는다.
// 출하 플레이어 캡처용으로 시작 칸 바로 위에 같은 테마 적을 한 마리 세운 프로젝트 JSON 도 남긴다(scripts/qa/runtime/theme-backdrop.scenario.mjs).
//   bun scripts/qa/assistant-v2/themeBackdropProof.mts <outDir> [key,key…]
//   → <outDir>/<key>.proof.project.json · proof.json(키 → 맵 전투 배경 · 없는 그림 줄 · 적 무리 · 런타임이 고른 배경)
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { serialize } from "../../../src/project/io/serialize.ts";
import { isPassable } from "../../../src/project/collision.ts";
import { resolveBattleBackdrop } from "../../../src/battle/battleBackdrop.ts";
import { resolveAssetResourceUrl } from "../../../src/assets/generatedAssetResourceResolver.ts";
import { worldById, worldPlaceSpec } from "../../../src/ai/v2/place/world.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { populateWorldPlace } from "../../../src/ai/v2/place/worldPopulate.ts";
import { reachableCells } from "../../../src/ai/v2/judge/eventReach.ts";
import { placeBlueprint, THEME_BACKDROP_PLACES } from "./themeBackdropPlaces.mts";

/* eslint-disable @typescript-eslint/no-explicit-any */

const out = process.argv[2];
if (!out) throw new Error("bun scripts/qa/assistant-v2/themeBackdropProof.mts <outDir> [key,key…]");
const only = process.argv[3]?.split(",");
fs.mkdirSync(out, { recursive: true });
const indexFile = path.join(out, "proof.json");
const index: Record<string, unknown> = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, "utf8")) : {};

for (const entry of THEME_BACKDROP_PLACES) {
  if (only && !only.includes(entry.key)) continue;
  const world = worldById(entry.world)!;
  const kind = world.kinds.find((k) => k.id === entry.kind)!;
  const ctx: any = { project: createBlankProject(), currentMapId: undefined, assistantRun: true };
  ctx.currentMapId = ctx.project.startMapId;
  const calls: any[] = [];
  const run: any = { ctx, calls, call: (tool: string, args: any) => { let r: any; try { r = runTool(ctx, tool, args); } catch (e) { r = { ok: false, summary: `${tool} threw ${(e as Error).message}` }; } calls.push({ tool, ok: r.ok, summary: String(r.summary ?? "").slice(0, 200) }); return r; } };
  const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
  const res: any = builderFor(spec as any)!.build(run, spec as any);
  if (!res.ok || !res.mapIds?.length) { console.error(`${entry.key}: 실패 — ${String(res.summary).slice(0, 200)}`); process.exitCode = 1; continue; }
  const mapId: string = res.entrance?.mapId ?? res.mapIds[0];
  ctx.project.gameBlueprint = placeBlueprint(world.id, ctx.project.maps[mapId].name, kind.id);
  const before = ctx.project.maps[mapId].battleBackground ?? null;
  // 실제 빌더의 채우기 — 이 호출이 맵의 전투 배경을 적고(테마), 대역이면 없는 그림 줄을 낸다.
  const gaps: string[] = [];
  const note = populateWorldPlace(run, mapId, res.entrance?.mapId === mapId ? res.entrance : undefined, 7, (line) => gaps.push(line));
  const p = ctx.project;
  const map = p.maps[mapId];
  const troopOf = (ev: any): string | undefined => (ev.pages ?? []).flatMap((pg: any) => pg.commands ?? []).find((c: any) => c.kind === "battleProcessing")?.troopId;
  const foes = map.events.filter((e: any) => /_wfoe\d+$/u.test(e.id)).map((e: any) => ({ id: e.id, x: e.x, y: e.y, troopId: troopOf(e) }));
  const troopId = foes[0]?.troopId;
  // 캡처용: 시작은 들어온 칸(없으면 걸어 닿는 아래쪽 칸). 걸어 닿는 칸 가운데 아래 칸이 빈 곳에 같은 무리를 세워 둔다 —
  // 시나리오가 그 아래 칸으로 옮겨 위를 보고 조사한다(도구가 출입구·시작점 곁을 거절하므로 될 때까지 다음 칸을 본다).
  const reach = reachableCells(p, map);
  const taken = new Set(map.events.map((e: any) => `${e.x},${e.y}`));
  const walk = (x: number, y: number) => !!reach?.[y * map.width + x] && isPassable(p, map, x, y) && !taken.has(`${x},${y}`);
  let start: { x: number; y: number } | undefined = res.entrance?.mapId === mapId && walk(res.entrance.x, res.entrance.y) ? { x: res.entrance.x, y: res.entrance.y } : undefined;
  for (let y = map.height - 2; y >= 1 && !start; y--) for (let x = 1; x < map.width - 1 && !start; x++) if (walk(x, y)) start = { x, y };
  let stand: any;
  let capture: { foe: { x: number; y: number }; stand: { x: number; y: number } } | undefined;
  if (start && troopId) {
    ctx.project = { ...ctx.project, startMapId: mapId, startPos: start };
    const spots: { x: number; y: number; d: number }[] = [];
    for (let y = 1; y < map.height - 2; y++) for (let x = 1; x < map.width - 1; x++) if (walk(x, y) && walk(x, y + 1)) spots.push({ x, y, d: Math.abs(x - map.width / 2) + Math.abs(y - map.height / 2) });
    for (const spot of spots.sort((a, b) => a.d - b.d)) {
      stand = run.call("place_field_enemy", { mapId, x: spot.x, y: spot.y, troopId, behavior: "stationary", id: "ev_theme_proof_foe" });
      if (stand.ok) { capture = { foe: { x: spot.x, y: spot.y }, stand: { x: spot.x, y: spot.y + 1 } }; break; }
    }
  }
  // 캡처는 전투 화면을 본다 — 기본 오프닝(제목 카드)은 꺼 둔다.
  ctx.project = { ...ctx.project, system: { ...ctx.project.system, opening: { ...(ctx.project.system.opening ?? {}), enabled: false } } };
  const final = ctx.project;
  const resolved = troopId ? resolveBattleBackdrop({ project: final, troopId, location: { mapId, x: capture?.foe.x ?? 0, y: capture?.foe.y ?? 0 } }) : null;
  fs.writeFileSync(path.join(out, `${entry.key}.proof.project.json`), serialize(final));
  const row = {
    world: entry.world, kind: entry.kind, wanted: entry.wanted, mapId, name: map.name,
    mapBattleBackgroundBeforePopulate: before, mapBattleBackground: final.maps[mapId].battleBackground ?? null, gaps,
    populate: note ?? null, foes, proofFoe: stand ? { ok: stand.ok, summary: String(stand.summary).slice(0, 160) } : null, start: start ?? null, capture: capture ?? null,
    troopId: troopId ?? null, troopPreviewBackground: final.database.troops.find((t: any) => t.id === troopId)?.previewBackgroundResourceId ?? null,
    runtimeBackdrop: resolved, runtimeBackdropUrl: resolved ? resolveAssetResourceUrl(resolved, { project: final }) : null,
    battleUiStyle: final.system.battleUiStyle ?? null,
  };
  index[entry.key] = row;
  console.log(`${entry.key}: 맵 전투 배경 ${row.mapBattleBackground} · 런타임 ${row.runtimeBackdrop} (${row.runtimeBackdropUrl}) · 적 ${foes.length} · 없는 그림 ${gaps.filter((g) => g.includes("want=backdrop")).length ? gaps.filter((g) => g.includes("want=backdrop")).join(" / ") : "없음"}`);
}
fs.writeFileSync(indexFile, JSON.stringify(index, null, 1) + "\n");
