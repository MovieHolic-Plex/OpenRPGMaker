// 조수가 지은 연애 한 편의 출하 플레이어 캡처용 입력 — 첫 talkFriendship 인물의 아침 자리까지 BFS 경로.
//   bun scripts/qa/romance-fix2/run-proof.mts <project.json> <outDir>   → <outDir>/project.json(그대로 복사), <outDir>/proof.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deserialize, serialize } from "../../../src/project/io.ts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { isTalkFriendshipEnabled } from "../../../src/project/friendship.ts";
import type { Project } from "../../../src/project/types.ts";
const [file, outDir] = process.argv.slice(2) as [string, string];
mkdirSync(outDir, { recursive: true });
const project = deserialize(readFileSync(file, "utf8")) as Project;
const mapId = project.startMapId; const map = project.maps[mapId]!;
const dirs = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]] as const;
const key = (x: number, y: number) => y * map.width + x;
const npcs = map.events.filter((e) => isTalkFriendshipEnabled(e) && e.characterId);
const people = npcs.map((e) => {
  const morning = (e.schedule ?? []).find((s) => s.when.timePhase === "morning")?.at;
  return { eventId: e.id, characterId: e.characterId!, name: e.name, x: morning?.x ?? e.x, y: morning?.y ?? e.y };
});
const pick = people[0]!;
// 첫 페이지(조건 없는 기본) 대사 줄 수 — 시나리오가 그만큼 넘긴 뒤 호감 피드백을 기다린다. 선택지가 끼면 시나리오를 따로 짠다.
const firstPage = map.events.find((e) => e.id === pick.eventId)!.pages[0]!;
const lineCount = (firstPage.commands ?? []).filter((c) => (c as { kind: string }).kind === "text").length;
const hasChoices = (firstPage.commands ?? []).some((c) => (c as { kind: string }).kind === "choices");
const prev = new Map<number, { from: number; dir: string }>(); const q = [key(project.startPos.x, project.startPos.y)]; prev.set(q[0]!, { from: -1, dir: "" });
for (let h = 0; h < q.length; h++) {
  const c = q[h]!; const cx = c % map.width, cy = Math.floor(c / map.width);
  for (const [d, dx, dy] of dirs) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height || prev.has(key(x, y))) continue;
    if (!isPassable(project, map, x, y) || !canMove(project, map, cx, cy, x, y)) continue;
    prev.set(key(x, y), { from: c, dir: d }); q.push(key(x, y));
  }
}
const adj = dirs.map(([d, dx, dy]) => ({ d, x: pick.x - dx, y: pick.y - dy })).find((a) => prev.has(key(a.x, a.y)));
let route: { kind: "move"; dir: string }[] = [];
if (adj) for (let c = key(adj.x, adj.y); prev.get(c)!.from >= 0; c = prev.get(c)!.from) route.unshift({ kind: "move", dir: prev.get(c)!.dir });
const face = adj ? (adj.x < pick.x ? "right" : adj.x > pick.x ? "left" : adj.y < pick.y ? "down" : "up") : "down";
writeFileSync(`${outDir}/project.json`, serialize(project));
writeFileSync(`${outDir}/proof.json`, JSON.stringify({ mapId, start: project.startPos, people, pick, arrive: adj ?? null, moves: route, face, lineCount, hasChoices }, null, 1));
console.log(JSON.stringify({ people: people.length, pick: pick.name, moves: route.length, adj }));
