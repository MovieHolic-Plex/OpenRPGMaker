// 실내 출구의 이동 칸 손질 — 가구·벽에 묻힌 이동 칸 치우기(dropBuriedTransfers)와 문 그림 밑 바닥으로 이동 칸 옮기기(doorFloorTransfers). 문·벽 그리기는 exitDress.ts.
import { canMove, isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, unreachableEvents } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";
import { Cell, Layer, Laid, kitOf, innerOf, reband, doorPiece, free, northDoorCells } from "./exitDress";

// ── 바닥 한가운데 이동 칸 → 벽에 난 문 ─────────────────────────────────────────
// 2026-10-29 vm3 deepseek 탈출 판정(major): 「방 이동은 바닥의 희미한 빛 위를 걷는 방식이라 출입구인지 알기 어렵다」 — 현관 홀 남쪽 바닥
// (17,8)(20,8)(23,8)에 응접실·서재·지하실로 가는 투명 접촉 칸이 카펫·의자 옆에 나란히 있었다(벽·문 그림 없음).
// 규칙(실내 방 짓기 칩셋 맵만): 다른 맵으로 가는 투명 접촉 이동 칸이 문 그림·남쪽 틈 위가 아니면, 가장 가까운 외벽에 문을 낸다.
//  - 북쪽 벽: 벽 발치 칸 D(위 두 칸이 벽면)에 칩셋 문 그림(+아치 문틀)을 세우고 이동 칸을 문 앞(D 아래)으로 — 뒷문(builders/interior.addBackDoor)과 같은 모양.
//  - 남쪽 벽: 바닥과 맞닿은 남쪽 띠 한 칸을 틈으로 터서 이동 칸을 틈에 두고, 칩셋에 발깔개가 있으면 틈 앞에 깐다 — 방 짓기의 남쪽 출구와 같은 모양.
//  - 층을 오가는 이동(지하실·2층…)이고 맵에 쓰지 않은 계단 그림이 있으면 그 계단 칸으로(8칸 안). 문·틈은 4칸 안의 벽만 — 멀면 그대로 둔다.
//  - 같은 벽의 문·틈끼리는 한 칸 이상 띄운다. 도착 맵에서 이 맵으로 돌아오는 이동은 새 문 앞 칸으로 맞춘다(짝).
//  - 옮긴 뒤 못 닿는 이벤트가 늘거나 새 이동 칸·착지 칸에 못 닿으면 그 맵을 되돌린다.
// 새 그림은 그리지 않는다(칩셋의 문·문틀·발깔개 조각만).

function transferCmds(ev: GameEvent): { page: number; idx: number; cmd: Record<string, unknown> }[] {
  const out: { page: number; idx: number; cmd: Record<string, unknown> }[] = [];
  (ev.pages ?? []).forEach((p, pi) => (p.commands ?? []).forEach((c, ci) => { const r = c as unknown as Record<string, unknown>; if (r.kind === "transfer") out.push({ page: pi, idx: ci, cmd: r }); }));
  return out;
}

const touchTrigger = (ev: GameEvent) => (ev.pages ?? []).every((p) => { const t = p.trigger as unknown; const kind = typeof t === "string" ? t : (t as { kind?: string } | undefined)?.kind; return kind === "playerTouch" || kind === "touch"; });

const transparentEvent = (ev: GameEvent) => (ev.pages ?? []).every((p) => { const g = p.graphic; return !g || g.transparent === true || (!g.sprite && !g.appearanceId); });

/**
 * 들어설 수 없는 칸(가구·벽 밑)에 묻힌 접촉 이동 — 네 곁 어디서도 걸어 들어갈 수 없고 부딪혀 발동하지도 않는(우선순위 same 아님) 다른 맵 이동 칸.
 * 같은 맵에 같은 목적지로 가는, 걸어 들어갈 수 있는 이동 칸이 따로 있으면 묻힌 칸을 지운다(남은 문이 그 길을 맡는다).
 * 왜(2026-10-29 vm4 argon 추리): 「2층 객실」 (4,3) 서랍장 밑의 「→ 여관 홀」 이동을 자동 플레이가 골라 (4,4)→(4,3) 이동 불가로 멈췄다 — 남쪽 틈 (5,8)이 같은 홀로 갔다.
 */
export function dropBuriedTransfers(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const map = run.ctx.project.maps[mapId];
  if (!map) return notes;
  const project = run.ctx.project;
  const destOf = (e: GameEvent) => transferCmds(e).map((t) => t.cmd.mapId).find((m): m is string => typeof m === "string" && m !== mapId);
  const sameLayer = (e: GameEvent) => (e.pages ?? []).some((p) => (p.priority ?? "same") === "same");
  const enterable = (e: GameEvent) => sameLayer(e) || [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
    const x = e.x + dx!, y = e.y + dy!;
    return x >= 0 && y >= 0 && x < map.width && y < map.height && canMove(project, map, x, y, e.x, e.y);
  });
  const gates = (map.events ?? []).filter((e) => touchTrigger(e) && destOf(e));
  for (const ev of gates) {
    if (enterable(ev)) continue;
    const dest = destOf(ev)!;
    const twin = gates.find((o) => o.id !== ev.id && destOf(o) === dest && enterable(o));
    if (!twin) continue;
    const r = run.call("remove_event", { mapId, eventId: ev.id });
    if (r.ok) notes.push(`들어설 수 없는 칸 (${ev.x},${ev.y})의 → ${project.maps[dest]?.name ?? dest} 이동을 지움(같은 곳으로 가는 (${twin.x},${twin.y}) 가 맡음)`);
  }
  return notes;
}

export function doorFloorTransfers(run: BuildRun, mapId: string, laid?: Laid): string[] {
  const notes: string[] = [];
  const first = run.ctx.project.maps[mapId];
  if (!first) return notes;
  const ids = (first.events ?? []).filter((e) => touchTrigger(e) && transparentEvent(e) && transferCmds(e).some((t) => typeof t.cmd.mapId === "string" && t.cmd.mapId !== mapId)).map((e) => e.id);
  for (const id of ids) {
    const project0 = run.ctx.project;
    const map0 = project0.maps[mapId]!;
    const k = kitOf(project0, map0, laid);
    if (!k) return notes;
    const ev = map0.events.find((e) => e.id === id);
    if (!ev) continue;
    const w = map0.width, H = map0.height;
    const meta = (project0.tilesets[map0.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
    const label = (t: number) => (t >= 0 ? String(meta[t]?.label ?? "") : "");
    const doorArtAt = (m: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < w && y < H && [3, 4].some((L) => /문|door|arch/iu.test(label(layerTileAt(m, L as Layer, y * w + x))) && !/창문|문양|문서|window/iu.test(label(layerTileAt(m, L as Layer, y * w + x))));
    const inn = innerOf(k, map0);
    // 이미 문 그림 위·옆이거나 남쪽 틈(방 짓기 출구)이면 그대로.
    if (ev.y === H - 1 && inn(ev.x, ev.y)) continue;
    if ([[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => doorArtAt(map0, ev.x + dx!, ev.y + dy!))) continue;
    // 맵 가장자리 이동(바깥 거리 끝)은 문이 아니다.
    if (ev.x === 0 || ev.y === 0 || ev.x === w - 1) continue;
    const target = transferCmds(ev).find((t) => typeof t.cmd.mapId === "string" && t.cmd.mapId !== mapId)!;
    const destId = String(target.cmd.mapId);
    // 같은 벽에서 한 칸 띄우기: 이미 있는 문 그림 열·남쪽 틈 열·다른 이동 칸.
    const otherGates = map0.events.filter((e) => e.id !== id && transferCmds(e).length);
    const tooClose = (x: number, y: number) => otherGates.some((e) => e.y === y && Math.abs(e.x - x) <= 1) || [-1, 0, 1].some((dx) => doorArtAt(map0, x + dx, y) || doorArtAt(map0, x + dx, y - 1));
    const reach = reachableCells(project0, map0);
    if (!reach) continue;
    const others = map0.events.filter((e) => e.id !== id);
    type Plan = { kind: "north" | "south" | "stairs"; gate: Cell; landing: Cell; dir: "up" | "down"; apply: (m: GameMap) => boolean; d: number };
    const plans: Plan[] = [];
    // 북쪽 벽 문.
    const piece = doorPiece(k.S, false);
    if (piece) {
      for (const D of northDoorCells(project0, map0, k, reach, others)) {
        if (D.clear) continue;
        const gate = { x: D.x, y: D.y + 1 }, landing = { x: D.x, y: D.y + 2 };
        if (landing.y >= H || !isPassable(project0, map0, landing.x, landing.y) || !reach[landing.y * w + landing.x]) continue;
        if (others.some((e) => (e.x === gate.x && e.y === gate.y) || (e.x === landing.x && e.y === landing.y))) continue;
        if (tooClose(D.x, D.y)) continue;
        const fits = piece.cells.every(([dx, dy, , layer]) => { const i = (D.y + piece.anchorDy + dy!) * w + D.x + dx!; return i >= 0 && free(map0, (layer === 2 ? 2 : 3) as Layer, i); });
        if (!fits) continue;
        plans.push({ kind: "north", gate, landing, dir: "down", d: Math.abs(gate.x - ev.x) + Math.abs(gate.y - ev.y), apply: (m) => {
          for (const [dx, dy, tile, layer] of piece.cells) setLayerTileAt(m, (layer === 2 ? 2 : 3) as Layer, (D.y + piece.anchorDy + dy!) * w + D.x + dx!, tile!);
          const arch = piece.anchorDy === 0 ? k.S.objects["round arch"] : undefined;
          if (arch && arch.w === 3 && arch.cells.every(([dx, dy]) => { const x = D.x - 1 + dx!, y = D.y - 2 + dy!; return x >= 0 && x < w && y >= 0 && k.faces.has(m.lowerTiles[y * w + x]!) && (x === D.x && y === D.y - 1 ? true : free(m, 3, y * w + x)); })) {
            for (const [dx, dy, tile] of arch.cells) {
              const x = D.x - 1 + dx!, y = D.y - 2 + dy!, i = y * w + x;
              if (x === D.x && y === D.y - 1) { const top = layerTileAt(m, 3, i); setLayerTileAt(m, 3, i, tile!); setLayerTileAt(m, 4, i, top); } else setLayerTileAt(m, 3, i, tile!);
            }
          }
          return true;
        } });
      }
    }
    // 남쪽 벽 틈.
    {
      const y = H - 1;
      for (let x = 1; x < w - 1; x++) {
        if (inn(x, y) || !inn(x, y - 1) || inn(x - 1, y) || inn(x + 1, y)) continue;
        if (!isPassable(project0, map0, x, y - 1) || k.faces.has(map0.lowerTiles[(y - 1) * w + x]!) || !reach[(y - 1) * w + x]) continue;
        if (others.some((e) => e.x === x && (e.y === y - 1 || e.y === y))) continue;
        if (otherGates.some((e) => e.y >= y - 1 && Math.abs(e.x - x) <= 1)) continue;
        plans.push({ kind: "south", gate: { x, y }, landing: { x, y: y - 1 }, dir: "up", d: Math.abs(x - ev.x) + Math.abs(y - ev.y), apply: (m) => {
          m.lowerTiles[y * w + x] = m.lowerTiles[(y - 1) * w + x]!;
          for (const L of [2, 3, 4] as const) setLayerTileAt(m, L, y * w + x, -1);
          reband(k, m, (xx, yy) => Math.abs(xx - x) <= 1 && Math.abs(yy - y) <= 1);
          const mat = k.S.objects["doormat"];
          if (mat && mat.w === 2) for (const left of [x, x - 1]) {
            const ok = [left, left + 1].every((xx) => xx >= 0 && xx < w && innerOf(k, m)(xx, y - 1) && !k.faces.has(m.lowerTiles[(y - 1) * w + xx]!) && free(m, 2, (y - 1) * w + xx) && free(m, 3, (y - 1) * w + xx));
            if (!ok) continue;
            for (const [dx, , tile, layer] of mat.cells) setLayerTileAt(m, (layer === 3 ? 3 : 2) as Layer, (y - 1) * w + left + dx!, tile!);
            break;
          }
          return true;
        } });
      }
    }
    // 층을 오가는 이동(지하실·2층·다락…)이고 맵에 쓰이지 않은 계단 그림이 있으면 그 계단이 먼저다(현관 홀의 「가는 계단통」 → 지하실).
    const FLOOR_WORDS = /지하|층|다락|계단|basement|cellar|attic|upstairs|downstairs|floor/iu;
    if (FLOOR_WORDS.test(String(project0.maps[destId]?.name ?? "")) || FLOOR_WORDS.test(String(map0.name ?? ""))) {
      const stairCell = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < H && [3, 4].some((L) => /계단|stair/iu.test(label(layerTileAt(map0, L as Layer, y * w + x))) && !/난간|rail/iu.test(label(layerTileAt(map0, L as Layer, y * w + x))));
      const seen = new Set<number>();
      for (let i = 0; i < w * H; i++) {
        if (seen.has(i) || !stairCell(i % w, Math.floor(i / w))) continue;
        const cluster: number[] = [];
        const q = [i]; seen.add(i);
        for (let n = 0; n < q.length; n++) { const c = q[n]!; cluster.push(c); const cx = c % w, cy = Math.floor(c / w); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, ny = cy + dy, j = ny * w + nx; if (!seen.has(j) && stairCell(nx, ny)) { seen.add(j); q.push(j); } } }
        const xs = cluster.map((c) => c % w), ys = cluster.map((c) => Math.floor(c / w));
        const bottom = Math.max(...ys), cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
        if (otherGates.some((e) => cluster.includes(e.y * w + e.x) || (e.x >= Math.min(...xs) && e.x <= Math.max(...xs) && e.y === bottom + 1))) continue;
        const onStair = isPassable(project0, map0, cx, bottom) && !!reach[bottom * w + cx];
        const gate = onStair ? { x: cx, y: bottom } : { x: cx, y: bottom + 1 }, landing = { x: cx, y: gate.y + 1 };
        if (landing.y >= H || others.some((e) => (e.x === gate.x && e.y === gate.y) || (e.x === landing.x && e.y === landing.y))) continue;
        plans.push({ kind: "stairs", gate, landing, dir: "down", d: -1, apply: () => true });
      }
    }
    // 멀리 옮기지 않는다 — 방 반대편 벽으로 끌고 가면 원래 동선(대사·목표 «남동쪽 → …»)과 어긋난다. 가까운 벽이 없으면 그대로 둔다.
    const far = (p: Plan) => Math.abs(p.gate.x - ev.x) + Math.abs(p.gate.y - ev.y) > (p.kind === "stairs" ? 8 : 4);
    for (let i = plans.length - 1; i >= 0; i--) if (far(plans[i]!)) plans.splice(i, 1);
    plans.sort((a, b) => a.d - b.d || (a.kind === "south" ? 1 : 0) - (b.kind === "south" ? 1 : 0));
    const before = new Set(unreachableEvents(project0, mapId));
    let done = false;
    for (const plan of plans.slice(0, 12)) {
      const m = structuredClone(map0);
      if (!plan.apply(m)) continue;
      m.events = m.events.map((e) => e.id === id ? { ...e, x: plan.gate.x, y: plan.gate.y } : e);
      let next = { ...project0, maps: { ...project0.maps, [mapId]: m } } as Project;
      if (!isPassable(next, m, plan.gate.x, plan.gate.y) || !isPassable(next, m, plan.landing.x, plan.landing.y)) continue;
      const r2 = reachableCells(next, m);
      if (!r2?.[plan.landing.y * w + plan.landing.x]) continue;
      if (unreachableEvents(next, mapId).some((u) => !before.has(u))) continue;
      // 짝: 도착 맵에서 이 맵으로 돌아오는 이동(옛 이동 칸 둘레 2칸 안에 내리던 것)을 새 문 앞으로.
      const dest = next.maps[destId];
      const paired: string[] = [];
      if (dest) {
        const destEvents = dest.events.map((de) => {
          let touched = false;
          const pages = (de.pages ?? []).map((p) => ({ ...p, commands: (p.commands ?? []).map((c) => {
            const r = c as unknown as Record<string, unknown>;
            if (r.kind !== "transfer" || r.mapId !== mapId || typeof r.x !== "number" || typeof r.y !== "number") return c;
            if (Math.abs(r.x - ev.x) + Math.abs(r.y - ev.y) > 2) return c;
            touched = true;
            return { ...r, x: plan.landing.x, y: plan.landing.y, direction: plan.dir } as unknown as typeof c;
          }) }));
          if (touched) paired.push(`${dest.name ?? destId} (${de.x},${de.y})`);
          return touched ? { ...de, pages } as GameEvent : de;
        });
        next = { ...next, maps: { ...next.maps, [destId]: { ...dest, events: destEvents } } } as Project;
      }
      // 이 이동이 내려 주는 칸은 그대로(도착 맵 쪽 문은 그 맵 규칙이 맡는다).
      run.ctx.project = next;
      notes.push(`이동 칸 「→ ${project0.maps[destId]?.name ?? destId}」 (${ev.x},${ev.y})→(${plan.gate.x},${plan.gate.y}) ${plan.kind === "north" ? `북쪽 벽 발치 (${plan.gate.x},${plan.gate.y - 1})에 ${piece?.id} 문` : plan.kind === "stairs" ? "계단 그림 아래" : "남쪽 벽에 틈"}${paired.length ? ` · 되돌아오는 이동 ${paired.join(", ")} 착지 → (${plan.landing.x},${plan.landing.y})` : ""}`);
      done = true;
      break;
    }
    if (!done && plans.length) notes.push(`이동 칸 (${ev.x},${ev.y}): 문을 낼 벽 자리가 길을 막아 그대로 둠`);
  }
  return notes;
}
