// 런타임 QA 입력: 연애 기본값이 깔린 캠퍼스 프로젝트에 호감 대화 NPC 와 기한 엔딩을 더한다(헤드리스 도구 경로).
//   bun scripts/qa/romance-fix/loop-fixture.mts <defaults/project.json> <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/index.ts";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import type { Project } from "../../../src/project/types.ts";
const [file, outDir, daysArg] = process.argv.slice(2) as [string, string, string?];
const deadlineDays = Number(daysArg ?? 3);
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(file, "utf8")) as Project;
const ctx = { project, assistantRun: true } as never;
const map = project.maps[project.startMapId]!;
// 시작 칸에서 걸어 닿는 칸 중 시작에서 5칸쯤 떨어진 곳에 둔다.
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
    prev.set(key(x, y), { from: cell, dir, d: prev.get(cell)!.d + 1 }); queue.push(key(x, y));
  }
}
const far = [...prev.entries()].filter(([, v]) => v.d >= 6).sort((a, b) => a[1].d - b[1].d)[0]![0];
const npcCell = { x: far % map.width, y: Math.floor(far / map.width) };
let r: any = runTool(ctx, "place_npc", { mapId: map.id, x: npcCell.x, y: npcCell.y, name: "하린", movement: "fixed", characterId: "char_harin", talkFriendship: true, pages: [{ lines: ["오늘도 만났네요."] }] });
if (!r.ok) throw new Error(JSON.stringify(r));
const live = (ctx as any).project as Project;
const npc = live.maps[map.id]!.events.find(e => e.name === "하린")!;
for (const [id, name] of [["ending_good", "함께 걷는 결말"], ["ending_normal", "친구로 남는 결말"], ["ending_bad", "스쳐 지나가는 결말"]] as const) {
  r = runTool(ctx, "define_ending", { id, name, conditions: [], epilogue: [{ kind: "say", speaker: "하린", text: `${name}.` }] }); if (!r.ok) throw new Error(JSON.stringify(r));
}
r = runTool(ctx, "set_deadline_ending", { days: deadlineDays, characterId: "char_harin", tiers: [{ endingId: "ending_good", friendshipAtLeast: 40 }, { endingId: "ending_normal", friendshipAtLeast: 20 }, { endingId: "ending_bad" }] });
if (!r.ok) throw new Error(JSON.stringify(r));
// 상대 옆 칸까지 BFS 경로.
const adj = dirs.map(([d, dx, dy]) => ({ d, x: npc.x - dx, y: npc.y - dy })).find(a => prev.has(key(a.x, a.y)) && !(a.x === npc.x && a.y === npc.y))!;
const moves: { kind: "move"; dir: string }[] = [];
for (let c = key(adj.x, adj.y); prev.get(c)!.from >= 0; c = prev.get(c)!.from) moves.unshift({ kind: "move", dir: prev.get(c)!.dir });
const face = (["up", "down", "left", "right"] as const).find((d, i) => adj.x + dirs[i]![1] === npc.x && adj.y + dirs[i]![2] === npc.y)!;
writeFileSync(`${outDir}/project.json`, serialize((ctx as any).project as Project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ mapId: map.id, start: project.startPos, npc: { x: npc.x, y: npc.y }, at: { x: adj.x, y: adj.y }, face, moves }, null, 1));
console.log(JSON.stringify({ steps: moves.length, at: adj, npc: { x: npc.x, y: npc.y }, face }));
