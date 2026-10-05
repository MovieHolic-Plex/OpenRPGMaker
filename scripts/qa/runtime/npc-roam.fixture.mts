// npc-roam.probe.mjs 가 쓰는 픽스처.
//
//   npx vite-node scripts/qa/runtime/npc-roam.fixture.mts
//
// 배포 데모(editor-authored-demo-v3, 1.77MB)를 쓴다 — 빈 프로젝트를 직렬화하면 103MB 라
// 출하 플레이어가 로딩 중 죽는다(2026-10-05 실측). 조수가 실제로 까는 모양 그대로,
// 이름만 주고 movement 를 생략해 place_npc 를 부른다.
//   roam_a 농부 / roam_b 대장장이 / roam_c 나그네  → random 기대
//   stay_a 잡화점 주인 / stay_b 북문 문지기         → fixed 기대
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { serializePretty } from "@/project/io";
import type { GameMap, Project } from "@/project/types";

const DEMO = "test/fixtures/projects/editor-authored-demo-v3.json";
const OUT = "verify-shots/npc-roam/fixture.json";

const project = JSON.parse(readFileSync(DEMO, "utf8")) as Project;
const context = { project } as ToolContext;
const mapId = project.startMapId;
const start = context.project.maps[mapId] as GameMap;
console.log(`startMap=${mapId} size=${start.width}x${start.height} startPos=${JSON.stringify(context.project.startPos)} events=${start.events.length}`);

const NPCS = [
  { id: "roam_a", name: "농부" },
  { id: "roam_b", name: "대장장이" },
  { id: "roam_c", name: "나그네" },
  { id: "stay_a", name: "잡화점 주인" },
  { id: "stay_b", name: "북문 문지기" },
] as const;

/** 시작 지점에서 가까운 순으로, 다른 이벤트와 2칸 이상 떨어진 통행 가능 칸을 고른다. */
function pickCells(count: number): { x: number; y: number }[] {
  const map = context.project.maps[mapId] as GameMap;
  const sx = context.project.startPos?.x ?? Math.floor(map.width / 2);
  const sy = context.project.startPos?.y ?? Math.floor(map.height / 2);
  const taken: { x: number; y: number }[] = [];
  const clear = (x: number, y: number) => Math.max(Math.abs(x - sx), Math.abs(y - sy)) >= 3
    && (map.events ?? []).every((e) => Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) >= 2)
    && taken.every((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) >= 2);
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 1; x += 1) {
      if (!isPassable(context.project, map, x, y)) continue;
      if (!clear(x, y)) continue;
      candidates.push({ x, y, d: Math.abs(x - sx) + Math.abs(y - sy) });
    }
  }
  candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const chosen: { x: number; y: number }[] = [];
  for (const cell of candidates) {
    if (chosen.length >= count) break;
    if (chosen.some((c) => Math.max(Math.abs(c.x - cell.x), Math.abs(c.y - cell.y)) < 2)) continue;
    chosen.push({ x: cell.x, y: cell.y });
  }
  return chosen;
}

const cells = pickCells(NPCS.length);
if (cells.length < NPCS.length) throw new Error(`빈 칸이 ${cells.length}개뿐 — ${NPCS.length}개 필요`);

for (const [index, npc] of NPCS.entries()) {
  const cell = cells[index]!;
  const result = runTool(context, "place_npc", {
    mapId, x: cell.x, y: cell.y, id: npc.id, name: npc.name, pages: [{ text: `${npc.name}입니다.` }],
  });
  if (!result.ok) throw new Error(`place_npc ${npc.id} 실패: ${result.summary}`);
  const event = context.project.maps[mapId]?.events.find((e) => e.id === npc.id);
  if (!event) throw new Error(`${npc.id} 이벤트가 맵에 없다`);
  const moved = event.x !== cell.x || event.y !== cell.y ? ` (요청 ${cell.x},${cell.y} → 자동 착지)` : "";
  console.log(`PLACED ${npc.id} name=${npc.name} movement=${event.pages?.[0]?.movement.type} at=${event.x},${event.y}${moved}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, serializePretty(context.project), "utf8");
console.log(`fixture: ${OUT}`);
