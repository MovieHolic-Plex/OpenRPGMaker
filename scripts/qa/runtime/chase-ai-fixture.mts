// 필드 추격 AI 녹화 픽스처 — 편집기 AI 도구(runTool)만으로 저작한다(정본 저장 없음).
// 던전 한 층(author_dungeon, populate 끔)에 추격 적 둘(보통·빠름 프리셋)을 놓는다. 저작 박자(chaseStepMs)는 적지 않는다 —
// 「이미 만든 게임」의 페이지가 새 런타임에서 어떻게 달라지는지 보는 픽스처다.
// stdout: 프로젝트 JSON. stderr: 배치 요약. 환경 CHASE_FIXTURE_META=<경로> 면 좌표 메타를 쓴다.
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
  return result;
}
call("set_project_settings", { title: "추격 AI 녹화", battle: { flow: "gauge", uiStyle: "retro2003", atbSpeed: 1 } });
call("upsert_enemy", { enemy: { id: "enemy_chase_skel", name: "해골", monsterResourceId: "generated-enemy-skeleton-01",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
call("upsert_troop", { troop: { id: "troop_chase_skel", name: "해골", enemyIds: ["enemy_chase_skel"], members: [{ enemyId: "enemy_chase_skel", x: 40, y: 60, hidden: false }] } });
const startId = ctx.project.startMapId;
const dungeon = call("author_dungeon", { mapId: startId, type: "catacomb", genre: "rpg", populate: false, seed: Number(process.env.CHASE_SEED ?? 7), rooms: [
  { kind: "entrance", w: 9, h: 7 }, { kind: "hall", w: 13, h: 9, dir: "E" }, { kind: "crypt", w: 9, h: 7, dir: "S" },
] });
const data = dungeon.data as { width: number; height: number; rooms: { id: string; kind: string; spots?: { x: number; y: number }[]; x?: number; y?: number; w?: number; h?: number }[]; stairsUp?: { front?: { x: number; y: number } } };
const map = ctx.project.maps[startId]!;
const start = ctx.project.startPos;
log("dungeon", map.width, map.height, data.rooms.map((r) => ({ id: r.id, kind: r.kind, spots: r.spots?.length, x: r.x, y: r.y, w: r.w, h: r.h })), data.stairsUp, start);
// 보이는 맵 칸(통행 가능) 그림 — 배치를 고르려고 stderr 에 찍는다.
const rows: string[] = [];
for (let y = 0; y < map.height; y += 1) {
  let row = "";
  for (let x = 0; x < map.width; x += 1) {
    const open = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => canMove(ctx.project, map, x, y, x + dx!, y + dy!));
    row += x === start.x && y === start.y ? "S" : open ? "." : "#";
  }
  rows.push(row);
}
log(rows.join("\n"));
const hall = data.rooms[1]!;
const spots = hall.spots ?? [];
const pick = (fx: number, fy: number) => spots.slice().sort((a, b) => (Math.abs(a.x - fx) + Math.abs(a.y - fy)) - (Math.abs(b.x - fx) + Math.abs(b.y - fy)))[0]!;
const xs = spots.map((s) => s.x), ys = spots.map((s) => s.y);
const a = pick(Math.max(...xs), Math.min(...ys));
const b = pick(Math.max(...xs), Math.max(...ys));
for (const [id, at, pace] of [["ev_chase_normal", a, "normal"], ["ev_chase_fast", b, "fast"]] as const) {
  const placed = runTool(ctx, "place_field_enemy", { mapId: startId, x: at.x, y: at.y, troopId: "troop_chase_skel", behavior: "chase", sightRange: 7, pace, alert: "exclamation", id, giveUpRange: 16 });
  log(id, placed.ok, placed.summary.slice(0, 200), JSON.stringify(placed.warnings ?? []));
}
// 칸마다 네 방향 통행(위·아래·왼쪽·오른쪽 비트 1·2·4·8) — 녹화 봇이 실제 통행 판정 그대로 걷게.
const masks: number[][] = [];
for (let y = 0; y < map.height; y += 1) {
  const line: number[] = [];
  for (let x = 0; x < map.width; x += 1) {
    let m = 0;
    [[0, -1, 1], [0, 1, 2], [-1, 0, 4], [1, 0, 8]].forEach(([dx, dy, bit]) => { if (canMove(ctx.project, map, x, y, x + dx!, y + dy!)) m |= bit!; });
    line.push(m);
  }
  masks.push(line);
}
if (process.env.CHASE_FIXTURE_META) writeFileSync(process.env.CHASE_FIXTURE_META, JSON.stringify({ mapId: startId, start, rows, masks, lure: { x: 18, y: 11 }, chasers: ["ev_chase_normal", "ev_chase_fast"] }));
process.stdout.write(serialize(ctx.project));
