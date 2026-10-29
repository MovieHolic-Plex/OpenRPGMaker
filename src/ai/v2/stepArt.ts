// 청사진 단계의 «봉인·제단·결계» 칸에 보이는 그림을 세운다 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 terra jrpg 판정 major «「막힌 바위」 안 보임», 감독 지시 «목표가 가리키는 대상은 그림으로»): 「동굴의 봉인」 단계가
// 동굴 입구 방 맨바닥 (12,27)의 투명 칸이었다(반짝임만). 열쇠를 들고도 판정자는 봉인이 어디인지 몰라 동굴을 30분 돌았다.
// 규칙: 버들항 바깥 맵에서 이름이 봉인·제단·결계·의식·마법진인 청사진 단계 이벤트가 모든 페이지 투명이고 그 칸에 그림이 없으면,
// 3걸음 안에 번들 「돌 제단」(2×2, 버들항 성 지하 카타콤 조각)을 세우고 이벤트를 제단 아랫줄로 옮긴다. 제단 네 칸은 빈 통행 칸·이벤트 없음이어야 하고,
// 세운 뒤 못 닿는 이벤트가 늘면 되돌린다. 새 그림은 그리지 않는다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { unreachableEvents } from "./eventReach";
import { resolveSteps } from "./mysteryCase";
import type { BuildRun } from "./types";

const ALTAR = "kit:beodeul_city/bd-pick-castle-catacombs-altar-stone";
const SEAL = /봉인|제단|결계|의식|마법진|seal|altar/iu;

const allTransparent = (ev: GameMap["events"][number]) => (ev.pages ?? []).length > 0 && (ev.pages ?? []).every((p) => {
  const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown; tileId?: number };
  return g.transparent === true || (!g.sprite && !g.appearanceId && !(typeof g.tileId === "number" && g.tileId > 0));
});
const upperAt = (map: GameMap, x: number, y: number) => {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return ["upperTiles", "upperOverlayTiles"].some((k) => (m[k]?.[y * map.width + x] ?? -1) >= 0);
};

export function dressBareSealSteps(run: BuildRun, mapId: string): string[] {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!project0.gameBlueprint || !map0 || map0.tilesetId !== "beodeul_city") return [];
  if ((map0 as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor") return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project0)) {
    if (r.map.id !== mapId) continue;
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === r.ev.id);
    if (!ev || !SEAL.test(`${ev.name ?? ""} ${r.step.event}`) || !allTransparent(ev) || upperAt(map, ev.x, ev.y)) continue;
    const before = new Set(unreachableEvents(project, mapId));
    const others = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => e.y * map.width + e.x));
    const cands: { tx: number; ty: number; at: { x: number; y: number }; d: number }[] = [];
    for (let ty = ev.y - 4; ty <= ev.y + 3; ty++) for (let tx = ev.x - 4; tx <= ev.x + 3; tx++) {
      if (tx < 1 || ty < 1 || tx + 1 >= map.width - 1 || ty + 1 >= map.height - 1) continue;
      const cells = [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]] as const;
      if (cells.some(([x, y]) => !isPassable(project, map, x, y) || upperAt(map, x, y) || others.has(y * map.width + x))) continue;
      for (const at of [{ x: tx, y: ty + 1 }, { x: tx + 1, y: ty + 1 }]) cands.push({ tx, ty, at, d: Math.abs(at.x - ev.x) + Math.abs(at.y - ev.y) });
    }
    cands.sort((a, b) => a.d - b.d || a.ty - b.ty || a.tx - b.tx);
    for (const c of cands.filter((c) => c.d <= 3).slice(0, 40)) {
      const snapshot = run.ctx.project;
      const stamped = run.call("stamp_object", { objectId: ALTAR, mapId, x: c.tx, y: c.ty });
      if (!stamped.ok) { run.ctx.project = snapshot; continue; }
      const cur = run.ctx.project.maps[mapId]!;
      const pages = (ev.pages ?? []).map((p) => ({ ...p, priority: "same", overlapForbidden: true }));
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...cur, events: cur.events.map((e) => e.id === ev.id ? { ...e, x: c.at.x, y: c.at.y, pages: pages as typeof e.pages } : e) } } } as Project;
      if (unreachableEvents(run.ctx.project, mapId).some((id) => !before.has(id))) { run.ctx.project = snapshot; continue; }
      notes.push(`「${ev.name ?? ev.id}」 투명 칸 (${ev.x},${ev.y}) → 돌 제단 (${c.tx},${c.ty}) 위 (${c.at.x},${c.at.y})`);
      break;
    }
  }
  return notes;
}
