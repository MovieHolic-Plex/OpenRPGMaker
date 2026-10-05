// S3 — AI 배치 충돌·통행 판정 검토 프로브.
// 실제 runTool 경로로 네 가지를 실측한다. 좌표는 맵 크기에서 계산한다(하드코딩 금지).
//
// 함정(실측): runTool 은 context.project 를 새 객체로 바꾼다. map 참조를 캡처해 두고
// 다음 호출 뒤에 그걸로 조회하면 낡은 객체를 본다(이벤트 0개로 보였다). 매번 다시 집는다.
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";

const context = { project: createBlankProject() } as ToolContext;
const mapId = context.project.startMapId;

function cur(): GameMap {
  return context.project.maps[mapId]!;
}
function at(x: number, y: number): boolean {
  return isPassable(context.project, cur(), x, y);
}
function wallCells(cells: readonly [number, number][]): void {
  const m = cur();
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
    m.lowerTiles[y * m.width + x] = TILE.WALL;
    m.upperTiles[y * m.width + x] = TILE.EMPTY;
  }
}
function square(cx: number, cy: number, radius: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = cy - radius; y <= cy + radius; y += 1) for (let x = cx - radius; x <= cx + radius; x += 1) out.push([x, y]);
  return out;
}
const ev = (id: string) => cur().events.find((e) => e.id === id);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const w0 = cur().width, h0 = cur().height;
console.log(JSON.stringify({ case: "map", map: mapId, width: w0, height: h0 }));

// (a) 벽 칸 요청 → 자동 착지
const wx = clamp(Math.floor(w0 / 2), 2, w0 - 3);
const wy = clamp(Math.floor(h0 / 2), 2, h0 - 3);
wallCells([[wx, wy]]);
const aReqPassable = at(wx, wy);
const a = runTool(context, "place_npc", { mapId, x: wx, y: wy, id: "probe_wall", name: "벽테스트", pages: [{ text: "…" }] });
const aEv = ev("probe_wall");
console.log(JSON.stringify({
  case: "a-wall-auto-land", ok: a.ok, requested: `${wx},${wy}`, requestedPassable: aReqPassable,
  landed: aEv ? `${aEv.x},${aEv.y}` : null,
  landedPassable: aEv ? at(aEv.x, aEv.y) : null,
  adjusted: (a.data as { adjusted?: boolean } | undefined)?.adjusted,
}));

// (b) 통행 가능한 칸 요청 → adjusted=false
let bx = 1, by = 1, found = false;
for (let y = 1; y < cur().height - 1 && !found; y += 1) {
  for (let x = 1; x < cur().width - 1 && !found; x += 1) {
    if (Math.max(Math.abs(x - wx), Math.abs(y - wy)) <= 2) continue;
    if (cur().events.some((e) => e.x === x && e.y === y)) continue;
    if (at(x, y)) { bx = x; by = y; found = true; }
  }
}
const b = runTool(context, "place_npc", { mapId, x: bx, y: by, id: "probe_open", name: "평지테스트", pages: [{ text: "…" }] });
const bEv = ev("probe_open");
console.log(JSON.stringify({
  case: "b-open-cell-not-rejected", ok: b.ok, requested: `${bx},${by}`, requestedPassable: at(bx, by),
  landed: bEv ? `${bEv.x},${bEv.y}` : null,
  adjusted: (b.data as { adjusted?: boolean } | undefined)?.adjusted,
}));

// (c) 같은 칸에 둘 → 겹치지 않는다
const c1 = runTool(context, "place_npc", { mapId, x: bx, y: by, id: "probe_stack1", name: "겹침1", pages: [{ text: "…" }] });
const c2 = runTool(context, "place_npc", { mapId, x: bx, y: by, id: "probe_stack2", name: "겹침2", pages: [{ text: "…" }] });
const e1 = ev("probe_stack1"), e2 = ev("probe_stack2");
console.log(JSON.stringify({
  case: "c-no-stacking", ok: c1.ok && c2.ok, requested: `${bx},${by}`,
  first: e1 ? `${e1.x},${e1.y}` : null, second: e2 ? `${e2.x},${e2.y}` : null,
  overlap: e1 && e2 ? e1.x === e2.x && e1.y === e2.y : null,
  firstPassable: e1 ? at(e1.x, e1.y) : null, secondPassable: e2 ? at(e2.x, e2.y) : null,
}));

// (d) 반경 3이 전부 벽이면 거부
const dx0 = 1, dy0 = 1;
const before = cur().events.length;
wallCells(square(dx0 + 3, dy0 + 3, 3));
const d = runTool(context, "place_npc", { mapId, x: dx0 + 3, y: dy0 + 3, id: "probe_blocked", name: "막힘테스트", pages: [{ text: "…" }] });
const dIssues = (d as { issues?: readonly { code?: string; message?: string }[] }).issues ?? [];
console.log(JSON.stringify({
  case: "d-fully-blocked-rejected", ok: d.ok,
  errorCode: dIssues[0]?.code ?? null,
  errorMessage: String(dIssues[0]?.message ?? d.summary ?? "").slice(0, 100),
  eventsAdded: cur().events.length - before,
  leftEvent: cur().events.some((e) => e.id === "probe_blocked"),
}));
