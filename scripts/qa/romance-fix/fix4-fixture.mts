// 연애 수리 4 런타임 QA 입력: 뼈대 시드(엔딩 셋·기한·HUD)에 호감 인물 하린과 호감 선택지 판을 더한다(헤드리스 도구 경로, 모델 없음).
//   bun scripts/qa/romance-fix/fix4-fixture.mts <seed project.json> <outDir>
// 선택지 셋: [0] changeFriendship +65 → 해피, [1] 「하린 호감도」 변수 +30(읽기 호환) → 평범, [2] 아무것도 안 함 → 혼자.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { Project } from "../../../src/project/types.ts";
const [file, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(file, "utf8")) as Project;
const ctx = { project, assistantRun: true } as never;
const map = project.maps[project.startMapId]!;
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map.width + x;
const prev = new Map<number, { from: number; dir: string; d: number }>();
const queue = [key(project.startPos.x, project.startPos.y)];
prev.set(queue[0]!, { from: -1, dir: "", d: 0 });
for (let head = 0; head < queue.length; head++) {
  const cell = queue[head]!; const cx = cell % map.width, cy = Math.floor(cell / map.width);
  for (const [dir, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y))) continue;
    if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y)) continue;
    if (map.events.some(e => e.x === x && e.y === y)) continue; // 이벤트 칸은 걸어 지나가지 않는다
    prev.set(key(x, y), { from: cell, dir, d: prev.get(cell)!.d + 1 }); queue.push(key(x, y));
  }
}
const cellAt = (minD: number) => { const k = [...prev.entries()].filter(([, v]) => v.d >= minD).sort((a, b) => a[1].d - b[1].d)[0]![0]; return { x: k % map.width, y: Math.floor(k / map.width) }; };
const adjacent = (t: { x: number; y: number }) => dirs.map(([d, dx, dy], i) => ({ d, i, x: t.x - dx, y: t.y - dy })).find(a => prev.has(key(a.x, a.y)) && !(a.x === t.x && a.y === t.y))!;
const routeTo = (c: { x: number; y: number }) => { const moves: { kind: "move"; dir: string }[] = []; for (let k = key(c.x, c.y); prev.get(k)!.from >= 0; k = prev.get(k)!.from) moves.unshift({ kind: "move", dir: prev.get(k)!.dir }); return moves; };
const faceOf = (a: { x: number; y: number }, t: { x: number; y: number }) => (a.x < t.x ? "right" : a.x > t.x ? "left" : a.y < t.y ? "down" : "up");
const log: Record<string, unknown> = {};
// 호감 인물 하린(이름이 변수 「하린 호감도」 와 이어진다).
const harinCell = cellAt(10);
let r: any = runTool(ctx, "place_npc", { mapId: map.id, x: harinCell.x, y: harinCell.y, name: "하린", movement: "fixed", characterId: "char_harin", talkFriendship: true, pages: [{ lines: ["오늘도 만났네요."] }] });
log.harin = r.ok ? "ok" : r.summary;
let live = (ctx as any).project as Project;
live.variables.push({ id: "var_harin_aff", name: "하린 호감도", initial: 0 } as never);
live.session.variables.var_harin_aff = 0;
// 호감 선택지 판.
const boardCell = cellAt(5);
r = runTool(ctx, "upsert_event", { mapId: map.id, event: { id: "ev_pick", name: "약속 게시판", x: boardCell.x, y: boardCell.y, trigger: { kind: "action" },
  pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
    { kind: "text", body: "하린에게 어떻게 다가갈까?" },
    { kind: "choices", options: [
      { text: "먼저 다가가 마음을 전한다", branch: [{ kind: "changeFriendship", npcKey: "char_harin", delta: 65 }, { kind: "text", body: "하린이 활짝 웃는다." }] },
      { text: "함께 차를 마신다", branch: [{ kind: "setVariable", variableId: "var_harin_aff", op: "+=", value: 30 }, { kind: "text", body: "하린과 이야기가 길어졌다." }] },
      { text: "그냥 지나친다", branch: [{ kind: "text", body: "아무 말도 하지 못했다." }] },
    ] },
  ] }] } });
log.board = r.ok ? "ok" : r.summary;
live = (ctx as any).project as Project;
const starter = live.maps[map.id]!.events.find(e => e.id === "ev_segment_starter")!;
const hAt = adjacent(harinCell), bAt = adjacent(boardCell), sAt = adjacent({ x: starter.x, y: starter.y });
const endMapId = Object.keys(live.maps).find(id => id !== map.id && live.maps[id]!.events.some(e => e.id === "ev_segment_end"))!;
const endEv = live.maps[endMapId]!.events.find(e => e.id === "ev_segment_end")!;
const endNear = { x: endEv.x - 1, y: endEv.y };
// 시작 → 게시판 옆 → 수첩 옆(스위치) 순서로 걷는다. 좌표는 BFS 경로(엔진 통행).
const prevCell = (c: { x: number; y: number }) => c;
void prevCell;
const walkFromStart = { board: routeTo(bAt), starter: routeTo(sAt), harin: routeTo(hAt) };
// 게시판 → 수첩 구간은 시작에서의 BFS 로는 안 맞으므로 시작으로 돌아가지 않고 순간이동으로 잇는다(걷기 증명은 시작→게시판 구간).
writeFileSync(`${outDir}/project.json`, serialize((ctx as any).project as Project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({
  mapId: map.id, start: project.startPos, endMapId, endingNames: { happy: "마음이 닿은 결말", normal: "좋은 사이로", solo: "혼자 걷는 길" },
  board: { at: { x: bAt.x, y: bAt.y }, face: faceOf(bAt, boardCell) },
  starter: { at: { x: sAt.x, y: sAt.y }, face: faceOf(sAt, starter), moves: walkFromStart.starter, event: { x: starter.x, y: starter.y } },
  harin: { at: { x: hAt.x, y: hAt.y }, face: faceOf(hAt, harinCell), moves: walkFromStart.harin },
  end: { mapId: endMapId, x: endNear.x, y: endNear.y, face: "right" },
  top: { x: boardCell.x, y: 2 },
  endings: ((ctx as any).project as Project).system && Object.keys((((ctx as any).project) as any).database?.endings ?? {}).length,
}, null, 1));
console.log(JSON.stringify(log), "endings", JSON.stringify(((ctx as any).project as any).database?.endings?.map?.((e: any) => e.id)));
