// link_joseon_interior 증거 — 조선 마을 20호에 방 6종을 잇고, 저장(SQLite) → 다시 열기 → 엔진 canMove 로 왕복이 닿는지 본다.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/joseon-interior-link-proof.mts [출력.json]
// 저장소는 임시 폴더(OPRN_PROOF_DIR, 기본 /tmp/oprn-joseon-link-proof) — 사용자 프로젝트가 아니다.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { initLocalProjectStore } from "../../electron/local-store/store";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { canMove } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { doorEntriesForMap, doorEntryAt } from "@/project/doorEntries";
import { serialize } from "@/project/io";
import type { GameMap, Project } from "@/project/types";

const project = createBlankProject();
const ctx = { project, assistantRun: false };
const call = async (name: string, args: Record<string, unknown>) => {
  await prepareTool(name, args, ctx.project);
  const r = runTool(ctx, name, args, { dryRun: false });
  if (!r.ok) throw new Error(`${name} 실패: ${r.summary} ${JSON.stringify(r.issues ?? []).slice(0, 400)}`);
  return r;
};

const village = await call("import_region_reference", { id: "joseon-v20-64x56", newMapId: "map_jw_village", name: "청석골" });
const vid = (village.data as { mapId: string }).mapId;
const list = await call("list_joseon_doors", { mapId: vid });
const doors = (list.data as { doors: { name: string; door: { x: number; y: number }; step: { x: number; y: number } }[] }).doors;
const plan: [string, { x: number; y: number }][] = [
  ["joseon-in-office-17x15", { x: 17, y: 8 }],   // 기와집 6칸(관아 동헌 자리)
  ["joseon-in-pharmacy-12x10", { x: 35, y: 15 }], // 디딤돌을 줘도 된다
  ["joseon-in-inn-22x16", { x: 51, y: 35 }],     // 초가 주막
  ["joseon-in-school-16x14", { x: 52, y: 26 }],  // 기와 서당
  ["joseon-in-house-15x15", { x: 3, y: 20 }],    // 초가집 4칸
  ["joseon-in-smith-12x10", { x: 36, y: 7 }],    // 초가집 4칸
];
const links: unknown[] = [];
for (const [place, door] of plan) links.push((await call("link_joseon_interior", { mapId: vid, door, place })).data);
// 거부 사례: 같은 문 두 번, 조선이 아닌 맵
const again = runTool(ctx, "link_joseon_interior", { mapId: vid, door: { x: 17, y: 8 }, place: "joseon-in-house-15x15" }, { dryRun: false });

// 저장 → 다시 열기(SQLite 프로젝트 저장소, 별도 핸들)
const dir = process.env.OPRN_PROOF_DIR ?? mkdtempSync(join(tmpdir(), "oprn-joseon-link-"));
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const first = await initLocalProjectStore({ projectDir: dir });
const saved = await first.saveProject(ctx.project);
if (saved.kind !== "saved") throw new Error(`저장이 수락되지 않음: ${saved.kind}`);
const second = await initLocalProjectStore({ projectDir: dir });
const snapshot = second.loadSnapshot();
if (!snapshot) throw new Error("다시 연 저장소에 프로젝트가 없다");
const reloaded: Project = snapshot.project;
// 프로젝트 전체 문자열은 저장소 정규화(배우 기본값 등)로 달라질 수 있다 — 이은 맵(마을 + 방)은 칸·이벤트·문이 그대로여야 한다.
const linkedIds = [vid, ...(links as { interiorMapId: string }[]).map((l) => l.interiorMapId)];
const mapsIdentical = linkedIds.every((id) => JSON.stringify(ctx.project.maps[id]) === JSON.stringify(reloaded.maps[id]));
const storage = { dir, projectId: second.projectId, revision: snapshot.revision, mapsIdentical };
if (process.env.OPRN_PROOF_PROJECT_OUT) writeFileSync(process.env.OPRN_PROOF_PROJECT_OUT, serialize(reloaded));

const step = (p: Project, map: GameMap, x: number, y: number, dx: number, dy: number) => canMove(p, map, x, y, x + dx, y + dy);
function reach(p: Project, map: GameMap, from: { x: number; y: number }): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]); const q = [from];
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: c.x + dx, y: c.y + dy }; const k = `${n.x},${n.y}`;
      if (seen.has(k) || n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || !step(p, map, c.x, c.y, dx, dy)) continue;
      seen.add(k); q.push(n);
    }
  }
  return seen;
}
const vmap = reloaded.maps[vid]!;
const start = { x: 31, y: 28 };
const town = reach(reloaded, vmap, start);
const rows = (links as { door: { x: number; y: number }; step: { x: number; y: number }; interiorMapId: string; entryLanding: { x: number; y: number }; exitCells: { x: number; y: number }[]; enterEventId: string }[]).map((l) => {
  const room = reloaded.maps[l.interiorMapId]!;
  const entry = doorEntryAt(reloaded, vmap, l.step.x, l.step.y, "up");
  const inRoom = reach(reloaded, room, l.entryLanding);
  return {
    room: room.name, door: l.door, step: l.step,
    stepReachableFromStart: town.has(`${l.step.x},${l.step.y}`),
    doorEntry: entry ? { eventId: entry.eventId, matches: entry.eventId === l.enterEventId, onStep: entry.onStep } : null,
    mapDoor: (vmap.doors ?? []).some((d) => l.door.x >= d.x && l.door.x < d.x + d.w && l.door.y >= d.y && l.door.y < d.y + d.h),
    exitReachableFromLanding: l.exitCells.every((c) => inRoom.has(`${c.x},${c.y}`)),
    roomEventsAfterReload: room.events.map((e) => `${e.id}@${e.x},${e.y}`),
  };
});
const out = {
  storage,
  village: vid,
  doorsListed: doors.length,
  doorEntries: doorEntriesForMap(reloaded, vmap).length,
  rejectedDuplicate: !again.ok && /door-event-exists/u.test(JSON.stringify(again.issues ?? again.summary)),
  allOk: mapsIdentical && rows.every((r) => r.stepReachableFromStart && r.doorEntry?.matches && !r.doorEntry.onStep && r.mapDoor && r.exitReachableFromLanding),
  rows,
};
const file = process.argv[2];
if (file) writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
process.exit(out.allOk && out.rejectedDuplicate ? 0 : 1);
