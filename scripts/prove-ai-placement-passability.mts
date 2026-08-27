// AI 배치 툴이 몬스터를 통행 불가 타일에 남기지 못한다는 것을 실면(runTool)에서 증명한다.
//   npx vite-node scripts/prove-ai-placement-passability.mts [outPath]
//
// 실면 정의: 손으로 만든 유닛 테스트가 아니라 어시스턴트/에디터가 실제로 쓰는 실행 경로다.
// assistantSession.ts · editorToolHook.ts · aiProposalSummary.ts 가 모두 runTool(ctx, name, args)
// 를 호출한다 — 인자 정규화 → JSON Schema 검증 → draft 복제 → tree-pair 후처리 →
// projectLint 커밋 게이트까지 같은 순서를 지난다.
// 프로젝트도 픽스처가 아니라 배포되는 데모 게임(잿불의 유산)의 실제 맵 5개를 쓴다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import type { GameMap, Project } from "@/project/types";

const out = process.argv[2] ?? ".omo/evidence/ai-place-passable-20260827/real-surface.log";
const lines: string[] = [];
let failures = 0;

function say(line = ""): void {
  lines.push(line);
  console.log(line);
}

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = actual === expected;
  if (!ok) failures += 1;
  say(`    ${ok ? "OK  " : "FAIL"} ${label}: ${String(actual)} (기대 ${String(expected)})`);
}

function tileIds(map: GameMap, x: number, y: number): string {
  const index = y * map.width + x;
  return `lower=${map.lowerTiles[index]} upper=${map.upperTiles[index]}`;
}

function occupied(map: GameMap): Set<string> {
  return new Set(map.events.map((event) => `${event.x},${event.y}`));
}

function landingWithinRadius(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  taken: ReadonlySet<string>,
  radius: number,
): boolean {
  for (let cy = y - radius; cy <= y + radius; cy += 1) {
    for (let cx = x - radius; cx <= x + radius; cx += 1) {
      if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
      if (taken.has(`${cx},${cy}`)) continue;
      if (isPassable(project, map, cx, cy)) return true;
    }
  }
  return false;
}

/** 경계가 아닌 = 작가가 실제로 그린 벽 중, 반경 3 안에 빈 통행 가능 칸이 있는 첫 칸. */
function firstAuthoredWallWithLanding(project: Project, map: GameMap): { x: number; y: number } | null {
  const taken = occupied(map);
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      if (isPassable(project, map, x, y) || taken.has(`${x},${y}`)) continue;
      if (landingWithinRadius(project, map, x, y, taken, 3)) return { x, y };
    }
  }
  return null;
}

/** 반경 3 전체가 통행 불가/점유인 첫 칸(거부 계약용). */
function firstFullySealedCell(project: Project, map: GameMap): { x: number; y: number } | null {
  const taken = occupied(map);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isPassable(project, map, x, y)) continue;
      if (!landingWithinRadius(project, map, x, y, taken, 3)) return { x, y };
    }
  }
  return null;
}

const project = createEmberQuestProject();
const troopId = project.database.troops[0]?.id;
if (!troopId) throw new Error("데모 프로젝트에 troop 이 없다");

say("== AI 배치 통행 가능 실면 증거 (place_battle_blocker) ==");
say(`surface : runTool(ctx, "place_battle_blocker", args) — src/editor/tools/toolRunner.ts`);
say(`project : ${project.meta.title} (createEmberQuestProject, 배포 데모)`);
say(`troopId : ${troopId}`);
say();

const ctx = { project };
const mapIds = Object.keys(ctx.project.maps);

say(`[1] 실제 맵 ${mapIds.length}개의 작가가 그린 벽 위에 몬스터를 요청한다`);
for (const mapId of mapIds) {
  const map = ctx.project.maps[mapId];
  const wall = firstAuthoredWallWithLanding(ctx.project, map);
  say();
  say(`  ${mapId} "${map.name}" ${map.width}x${map.height} tileset=${map.tilesetId}`);
  if (!wall) {
    say(`    건너뜀: 착지 가능한 벽 칸이 없다`);
    continue;
  }
  const eventId = `ev_battle_proof_${mapId}`;
  say(`    requested : (${wall.x}, ${wall.y})  ${tileIds(map, wall.x, wall.y)}`);
  check(`isPassable(요청 좌표)`, isPassable(ctx.project, map, wall.x, wall.y), false);

  const result = runTool(ctx, "place_battle_blocker", { mapId, x: wall.x, y: wall.y, troopId, id: eventId });
  const data = (result.data ?? {}) as { eventId?: string; x?: number; y?: number; adjusted?: boolean };
  const warnings = (result.diff?.warnings ?? []).filter((warning) => warning.includes("자동 조정"));
  check("result.ok(커밋 게이트 통과)", result.ok, true);
  say(`    summary   : ${result.summary}`);
  for (const warning of warnings) say(`    warning   : ${warning}`);
  say(`    data      : ${JSON.stringify(data)}`);
  check("data.adjusted", data.adjusted, true);
  check("경고 문구 '위치 자동 조정'", warnings.some((warning) => warning.includes("위치 자동 조정")), true);

  const committed = ctx.project.maps[mapId];
  const placed = committed.events.find((event) => event.id === eventId);
  if (!placed) {
    failures += 1;
    say(`    FAIL 커밋된 맵에 이벤트 ${eventId} 가 없다`);
    continue;
  }
  say(`    final     : ${placed.id} at (${placed.x}, ${placed.y})  ${tileIds(committed, placed.x, placed.y)}`);
  check(`isPassable(최종 좌표)`, isPassable(ctx.project, committed, placed.x, placed.y), true);
  check("최종 좌표 ≠ 요청 좌표", placed.x !== wall.x || placed.y !== wall.y, true);
  check("data 좌표 == 커밋된 좌표", `${data.x},${data.y}`, `${placed.x},${placed.y}`);
}
say();

say(`[2] 반경 3이 전부 통행 불가면 착지 대신 거부한다`);
let sealedTested = false;
for (const mapId of mapIds) {
  const map = ctx.project.maps[mapId];
  const sealed = firstFullySealedCell(ctx.project, map);
  if (!sealed) continue;
  const before = map.events.length;
  const refused = runTool(ctx, "place_battle_blocker", { mapId, x: sealed.x, y: sealed.y, troopId, id: "ev_battle_proof_sealed" });
  say(`  ${mapId} requested (${sealed.x}, ${sealed.y})  ${tileIds(map, sealed.x, sealed.y)}`);
  say(`    summary   : ${refused.summary}`);
  say(`    issues    : ${JSON.stringify(refused.issues ?? [])}`);
  check("result.ok", refused.ok, false);
  check("code", refused.issues?.[0]?.code, "battle-blocker-impassable");
  check("이벤트가 추가되지 않음", ctx.project.maps[mapId].events.length, before);
  sealedTested = true;
  break;
}
if (!sealedTested) say(`  건너뜀: 데모 맵에 반경 3이 전부 막힌 칸이 없다(계약은 test/aiEventPlacementPassability.test.ts 가 소유).`);
say();

say(`[3] 프로젝트 전체 불변식 — 모든 맵의 몬스터 이벤트는 통행 가능 칸에 서 있다`);
let monsters = 0;
for (const mapId of mapIds) {
  const map = ctx.project.maps[mapId];
  for (const event of map.events) {
    if (!event.id.startsWith("ev_battle")) continue;
    monsters += 1;
    check(`${mapId} ${event.id} (${event.x}, ${event.y})`, isPassable(ctx.project, map, event.x, event.y), true);
  }
}
say(`  검사한 전투 블로커: ${monsters}개`);
say();

say(failures === 0 ? "VERDICT: PASS — 몬스터는 통행 가능 칸에만 남는다." : `VERDICT: FAIL — ${failures}건`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
console.log(`wrote ${out}`);
if (failures > 0) process.exit(1);
