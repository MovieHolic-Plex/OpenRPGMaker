// 입구 곁 경비 시야 픽스처 — 편집기 AI 도구(runTool)만으로 저작한다(정본 저장 없음).
// 작은 방(시작) → 문 → 들판. 들판 도착 칸에서 4칸 떨어진 곳에 보초 경비 하나를 놓고(place_field_enemy stationary),
// tune_field_enemies 로 추격형으로 바꾼 뒤 set_field_detection sightRange 8 을 준다. 체크아웃마다 그 체크아웃의 도구로 만든다 —
// 옛 도구는 입구가 가깝다며 시야를 깎고, 새 도구는 저작 값 그대로 둔다.
// CHASER_FORCE_SIGHT=8 이면 도구가 정한 시야를 무시하고 페이지에 8 을 직접 박는다(데모가 하던 우회와 같은 꼴).
// 실행: npx vite-node --script scripts/qa/runtime/chaser-entrance-fixture.mts > fixture.json  (CHASER_FIXTURE_META=meta.json)
import { writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { serialize } from "../../../src/project/io";
import { canMove } from "../../../src/project/collision";

const ctx = { project: createBlankProject() };
const log = (...args: unknown[]) => process.stderr.write(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ") + "\n");
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  log(name, result.summary.slice(0, 220), JSON.stringify(result.warnings ?? []).slice(0, 300));
  return result;
}
call("set_project_settings", { title: "입구 곁 경비", battle: { flow: "gauge", uiStyle: "retro2003", atbSpeed: 1 } });
call("upsert_enemy", { enemy: { id: "enemy_guard", name: "해골 경비", monsterResourceId: "generated-enemy-skeleton-01",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
call("upsert_troop", { troop: { id: "troop_guard", name: "해골 경비", enemyIds: ["enemy_guard"], members: [{ enemyId: "enemy_guard", x: 40, y: 60, hidden: false }] } });
const roomId = ctx.project.startMapId;
const field = call("create_map", { name: "들판", width: 20, height: 15, id: "map_field" });
const fieldId = (field.data as { mapId?: string; id?: string } | undefined)?.mapId ?? "map_field";
// 방 동쪽 끝 ↔ 들판 서쪽 끝.
const room = ctx.project.maps[roomId]!;
call("create_transfer_pair", { a: { mapId: roomId, x: room.width - 2, y: 7 }, b: { mapId: fieldId, x: 1, y: 7 }, trigger: "front" });
ctx.project.startPos = { x: room.width - 4, y: 7 };
const guardAt = { x: 6, y: 7 };
call("place_field_enemy", { mapId: fieldId, x: guardAt.x, y: guardAt.y, troopId: "troop_guard", behavior: "stationary", id: "ev_guard", alert: "exclamation" });
call("tune_field_enemies", { mapIds: [fieldId], sightRange: 8, vision: "any" });
call("set_field_detection", { mapIds: [fieldId], sightRange: 8, allRound: true });
const fmap = ctx.project.maps[fieldId]!; // 도구가 프로젝트를 새 사본으로 바꾸므로 마지막 도구 뒤에 읽는다.
const force = Number(process.env.CHASER_FORCE_SIGHT ?? 0);
const guard = fmap.events.find((e) => e.id === "ev_guard")!;
for (const page of guard.pages ?? []) {
  if (page.movement.type !== "chase") continue;
  if (force > 0) { page.movement.sightRange = force; page.movement.sight = { ...(page.movement.sight ?? { lineOfSight: true, facing: "any" }), range: force, facing: "any" }; }
  log("guard sight", page.movement.sight?.range, page.movement.sightRange);
}
const rows: string[] = [];
const masks: number[][] = [];
for (let y = 0; y < fmap.height; y += 1) {
  let row = ""; const line: number[] = [];
  for (let x = 0; x < fmap.width; x += 1) {
    let m = 0;
    [[0, -1, 1], [0, 1, 2], [-1, 0, 4], [1, 0, 8]].forEach(([dx, dy, bit]) => { if (canMove(ctx.project, fmap, x, y, x + dx!, y + dy!)) m |= bit!; });
    line.push(m); row += x === guardAt.x && y === guardAt.y ? "G" : m ? "." : "#";
  }
  rows.push(row); masks.push(line);
}
log(rows.join("\n"));
const finalSight = (guard.pages ?? []).find((p) => p.movement.type === "chase")?.movement.sight?.range ?? null;
if (process.env.CHASER_FIXTURE_META) writeFileSync(process.env.CHASER_FIXTURE_META, JSON.stringify({ roomId, fieldId, start: ctx.project.startPos, guard: "ev_guard", guardAt, sight: finalSight, masks }));
process.stdout.write(serialize(ctx.project));
