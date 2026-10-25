// src/editor/tools/tileGate.ts
// 타일로 그리는 상태 짝 관문(2026-10-25): 닫힘·올림 키트(예: 내리닫이 쇠창살문 3×2)를 통로 목에 칠하고,
// 막는 일은 보이지 않는 문 이벤트가 한다. 레버·스위치 쪽은 openCommands(changeTile)를 당김 명령에 붙이면
// 그림이 올림으로 바뀌고, 같은 스위치로 문 이벤트가 「아래」 페이지(통과)로 넘어간다.
//
// 왜 타일인가: 옛 캐릭터 쇠창살(Object1 #5)은 한 칸짜리 정면 그림이라 3칸 목에 셋을 늘어세우면
// 「열린 문간에 매달린 벽걸이 사슬」로 읽혔다(2026-10-25 b2 gate 리뷰). 키트는 문틀 + 격자를 한 덩이로 그린다.
//
// 키트 계약(bake_theme earth.portcullis walk_grid): 폭 kw·높이 2. 닫힘·올림 같은 크기. 가운데 열이 문간(닫힘 ★ / 올림 걸음),
// 양옆 열은 문틀(막힘). 목 폭이 kw 와 다르면 키트를 가운데 맞추거나(폭 < kw) 나란히 이어 붙인다(폭 > kw) —
// 넘치는 칸은 목 양끝 벽 위에 얹힌다(벽이어야 한다).

import { isPassable } from "@/project/collision";
import type { Command, GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { upsertEventIntoMap } from "./eventTools";

type Pt = { x: number; y: number };

export interface TileGateKits { readonly closed: string; readonly open: string }

export interface TileGatePlan {
  /** 키트 왼쪽 위 칸들(이어 붙인 순서). */
  readonly origins: readonly Pt[];
  readonly width: number;
  readonly height: number;
  /** 문간 칸(닫힘일 때 문 이벤트가 막는 칸, 키트마다 가운데 열 두 칸). */
  readonly doorCells: readonly Pt[];
  readonly kits: TileGateKits;
}

type Kit = { width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[] };
const kitOf = (ts: TilesetDef, id: string) => ((ts as { structureKits?: Kit[] & { id?: string }[] }).structureKits as (Kit & { id: string })[] | undefined)?.find((k) => k.id === id);

/** 타일셋에 닫힘·올림 키트가 둘 다 있고 크기가 같은가. */
export function hasTileGate(ts: TilesetDef | undefined, kits: TileGateKits): boolean {
  if (!ts) return false;
  const a = kitOf(ts, kits.closed), b = kitOf(ts, kits.open);
  return !!a && !!b && a.width === b.width && a.height === b.height && a.height === 2;
}

const upperBusy = (map: GameMap, i: number) => (map.upperTiles[i] ?? -1) >= 0 || ((map.upperOverlayTiles ?? [])[i] ?? -1) >= 0 || ((map.lowerOverlayTiles ?? [])[i] ?? -1) >= 0;

/**
 * 가로 한 줄 목(neck: 같은 y, 이어진 x)에 관문 키트를 놓을 자리를 정한다. 놓지 못하면 null.
 * 키트 두 줄이 모두 좁은 단면 안에 들어가야 한다: 목 줄과 그 바로 위(또는 아래) 줄이 같은 폭으로 걷고 키트 밖 바로 옆은 벽.
 * 넘치는 칸(목보다 넓은 만큼)은 벽 칸이어야 하고, 키트 칸의 위층은 비어 있어야 한다.
 */
export function planTileGate(draft: Project, map: GameMap, neck: readonly Pt[], kits: TileGateKits): TileGatePlan | null {
  const ts = draft.tilesets[map.tilesetId];
  if (!ts || !hasTileGate(ts, kits) || !neck.length) return null;
  const k = kitOf(ts, kits.closed)!;
  const y = neck[0]!.y;
  if (neck.some((p) => p.y !== y)) return null;
  const xs = neck.map((p) => p.x).sort((a, b) => a - b);
  const left = xs[0]!, w = xs[xs.length - 1]! - left + 1;
  if (w !== xs.length) return null;
  const n = Math.ceil(w / k.width), span = n * k.width;
  const x0 = left - Math.floor((span - w) / 2);
  const pass = (x: number, yy: number) => isPassable(draft, map, x, yy);
  const rowFits = (yy: number) => {
    if (yy < 0 || yy >= map.height || x0 < 1 || x0 + span >= map.width) return false;
    for (let x = x0 - 1; x <= x0 + span; x += 1) {
      const inNeck = x >= left && x < left + w;
      if (pass(x, yy) !== inNeck) return false;
      if (x >= x0 && x < x0 + span && (upperBusy(map, yy * map.width + x) || map.events.some((e) => e.x === x && e.y === yy))) return false;
    }
    return true;
  };
  if (!rowFits(y)) return null;
  // 같은 통로의 다른 단면으로 미끄러질 수 있다(어느 단면이든 막으면 같은 목이다). 두 줄 다 같은 단면이어야 한다.
  // 3/4 시점에서 문틀(돌 + 아치)은 벽 앞면이라 통로가 방으로 트이는 곳 바로 위(아랫줄 밑이 넓은 바닥)가 가장 자연스럽다 —
  // 통로 한가운데 세우면 문틀 위로 통로 바닥이 그대로 보여 벽이 떠 보인다. 그다음 통로가 북쪽 방으로 트이는 곳, 그다음 목 줄 그대로.
  const opensAt = (yy: number) => yy >= 0 && yy < map.height && (pass(x0 - 1, yy) || pass(x0 + span, yy));
  const fits = (t: number) => rowFits(t) && rowFits(t + 1);
  const cands: number[] = [];
  for (let d = 0; d <= 4; d += 1) for (const t of [y - 1 - d, y + d]) if (t >= 0 && !cands.includes(t) && fits(t)) cands.push(t);
  // 미끄러진 단면은 목 줄과 이어진 통로 안이어야 한다(가운데 사이 줄도 같은 단면).
  const linked = (t: number) => { for (let yy = Math.min(t, y); yy <= Math.max(t + 1, y); yy += 1) if (!rowFits(yy)) return false; return true; };
  const ok = cands.filter(linked);
  const top = ok.find((t) => opensAt(t + 2)) ?? ok.find((t) => opensAt(t - 1)) ?? ok.find((t) => t === y - 1 || t === y) ?? -1;
  if (top < 0) return null;
  const origins = Array.from({ length: n }, (_, i) => ({ x: x0 + i * k.width, y: top }));
  const mid = Math.floor(k.width / 2);
  const doorCells = origins.flatMap((o) => [{ x: o.x + mid, y: top }, { x: o.x + mid, y: top + 1 }]);
  // 문간(가운데 열)은 목 안에 있어야 한다 — 넘친 키트의 문간이 벽 위면 열어도 못 지나간다.
  if (doorCells.some((p) => p.x < left || p.x >= left + w)) return null;
  return { origins, width: k.width, height: k.height, doorCells, kits };
}

function kitCells(ts: TilesetDef, plan: TileGatePlan, id: string): { x: number; y: number; tile: number }[] {
  const k = kitOf(ts, id)!;
  return plan.origins.flatMap((o) => k.rows.flatMap((row, dy) => (row.upperTiles ?? []).map((t, dx) => ({ x: o.x + dx, y: o.y + dy, tile: t }))));
}

/** 닫힘 그림을 위층에 칠한다. */
export function paintTileGate(draft: Project, map: GameMap, plan: TileGatePlan): void {
  const ts = draft.tilesets[map.tilesetId]!;
  for (const c of kitCells(ts, plan, plan.kits.closed)) if (c.tile >= 0) map.upperTiles[c.y * map.width + c.x] = c.tile;
}

/** 닫힘 → 올림 그림 바꾸기(changeTile upper). 레버·스위치 이벤트의 명령 끝에 붙인다. */
export function tileGateOpenCommands(draft: Project, map: GameMap, plan: TileGatePlan): Command[] {
  const ts = draft.tilesets[map.tilesetId]!;
  const closed = kitCells(ts, plan, plan.kits.closed);
  return kitCells(ts, plan, plan.kits.open)
    .filter((c, i) => c.tile !== closed[i]!.tile)
    .map((c) => ({ kind: "changeTile", mapId: map.id, layer: "upper", x: c.x, y: c.y, tile: c.tile } as Command));
}

/**
 * 관문을 칠하고 문간 칸마다 보이지 않는 문 이벤트를 둔다(닫힘 = 막고 조사하면 안내, 스위치 켜짐 = 아래 우선순위로 통과).
 * 반환: 문 이벤트 칸과, 스위치를 켜는 쪽(레버)에 붙일 그림 바꾸기 명령.
 */
export function placeTileGate(draft: Project, map: GameMap, plan: TileGatePlan, opts: { idPrefix: string; name: string; switchId: string; closedText: string; closedName?: string; openName?: string }): { cells: Pt[]; openCommands: Command[] } {
  paintTileGate(draft, map, plan);
  const fixed = { type: "fixed", speed: 3, frequency: 3 } as const;
  plan.doorCells.forEach((p, k) => {
    const id = k === 0 ? opts.idPrefix : `${opts.idPrefix}_${p.x}_${p.y}`;
    // 같은 이름 = 한 물체(문간 칸들) — 린트가 「서로 다른 조사물이 같은 그림」으로 보지 않는다.
    upsertEventIntoMap(map, { id, name: opts.name, x: p.x, y: p.y, trigger: { kind: "action" }, commands: [], pages: [
      { id: `${id}_p1`, name: opts.closedName ?? `닫힌 ${opts.name}`, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: fixed,
        commands: [{ kind: "text", body: opts.closedText } as Command] },
      { id: `${id}_p2`, name: opts.openName ?? `열린 ${opts.name}`, conditions: [{ kind: "switch", switchId: opts.switchId, value: true }], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false, movement: fixed, commands: [] },
    ] } as GameEvent);
  });
  return { cells: [...plan.doorCells], openCommands: tileGateOpenCommands(draft, map, plan) };
}
