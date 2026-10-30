// 실험(img-room-test 3단계, 2026-10-30): 목업 → 조각 표. 모델이 목업을 보고 쓴 표(방·구역 칸 사각형, 묶음마다 조각 id·대략 x,y·개수)를
// 세션에 둔다. 함수는 표를 «검사만» 한다 — id 가 칩셋에 있는지, 좌표가 표의 맵 크기 안인지 — 그리고 지은 뒤 맵 타일에서 조각을 찾아
// 표와 맞대어 빠지거나 엉뚱한 곳에 놓인 묶음을 할 일(관문 항목)로 돌려준다. 배치는 하지 않는다.
import type { GameMap, Project } from "@/project/types";
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { workshopHandObjects } from "@/project/workshopTiles";
import type { TilesetDef } from "@/project/types";

/** 칩셋 역할표 + 이 프로젝트에 구운 공방 조각(workshop:…, 조건 O 의 object-gen 조각) — build_hand_interior_room 의 specFor 와 같은 합집합. */
export function specWithWorkshop(tileset: TilesetDef | undefined): HandInteriorSpec | undefined {
  const S = roomSpecOf(tileset); if (!S) return undefined;
  const ws = workshopHandObjects(tileset);
  return Object.keys(ws).length ? { ...S, objects: { ...S.objects, ...ws } as HandInteriorSpec["objects"] } : S;
}

export interface PieceTableRoom { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface PieceTableGroup { readonly name: string; readonly id: string; readonly x: number; readonly y: number; readonly count: number }
export interface PieceTable { readonly mapWidth: number; readonly mapHeight: number; readonly rooms: readonly PieceTableRoom[]; readonly groups: readonly PieceTableGroup[]; readonly tilesetId: string }

export const pieceTableOn = (): boolean => typeof process !== "undefined" && process.env?.OPRN_EXPERIMENT_PIECE_TABLE === "1";

const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined);

/** 표를 읽고 검사한다. 문제가 있으면 problems 를 돌려주고 표는 저장하지 않는다(모델이 고쳐 다시 낸다). */
export function validatePieceTable(project: Project, raw: Record<string, unknown>, tilesetId = "atlas_biome_interior"): { table?: PieceTable; problems: string[] } {
  const problems: string[] = [];
  const S = specWithWorkshop(project.tilesets[tilesetId]);
  if (!S) return { problems: [`tileset ${tilesetId} has no room kit`] };
  const W = int(raw.mapWidth), H = int(raw.mapHeight);
  if (!W || !H || W < 4 || H < 4 || W > 120 || H > 120) problems.push("mapWidth/mapHeight must be the planned map size in cells (4–120)");
  const rooms: PieceTableRoom[] = [];
  for (const [i, r] of (Array.isArray(raw.rooms) ? raw.rooms : []).entries()) {
    const o = (r ?? {}) as Record<string, unknown>; const x = int(o.x), y = int(o.y), w = int(o.w), h = int(o.h);
    const name = String(o.name ?? `room ${i + 1}`);
    if (x === undefined || y === undefined || !w || !h) { problems.push(`room «${name}»: x, y, w, h are required numbers`); continue; }
    if (W && H && (x < 0 || y < 0 || x + w > W || y + h > H)) problems.push(`room «${name}» rect (${x},${y},${w}×${h}) is outside the ${W}×${H} map`);
    rooms.push({ name, x, y, w, h });
  }
  if (!rooms.length) problems.push("rooms: list at least one room/zone with its cell rect");
  const groups: PieceTableGroup[] = [];
  for (const [i, g] of (Array.isArray(raw.groups) ? raw.groups : []).entries()) {
    const o = (g ?? {}) as Record<string, unknown>; const id = String(o.id ?? ""); const x = int(o.x), y = int(o.y); const count = int(o.count) ?? 1;
    const name = String(o.name ?? `group ${i + 1}`);
    if (!S.objects[id]) { problems.push(`group «${name}»: piece id «${id}» is not in the ${tilesetId} chipset (use an id from room_parts)`); continue; }
    if (x === undefined || y === undefined) { problems.push(`group «${name}»: x, y are required`); continue; }
    if (W && H && (x < 0 || y < 0 || x >= W || y >= H)) problems.push(`group «${name}» at (${x},${y}) is outside the ${W}×${H} map`);
    if (count < 1 || count > 40) problems.push(`group «${name}»: count must be 1–40`);
    groups.push({ name, id, x, y, count });
  }
  if (!groups.length) problems.push("groups: list the object groups (piece id, approximate x,y, count)");
  return problems.length ? { problems } : { table: { mapWidth: W!, mapHeight: H!, rooms, groups, tilesetId }, problems };
}

/** 맵 타일에서 칩셋 조각을 찾는다 — 조각 칸의 ≥60% 가 어느 층에든 같은 타일로 있으면 그 자리에 있다고 본다. */
export function findPlacedPieces(map: GameMap, S: HandInteriorSpec, ids: ReadonlySet<string>): { id: string; x: number; y: number }[] {
  const W = map.width, H = map.height;
  const m = map as unknown as Record<string, unknown>;
  const layers = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].map((k) => m[k]).filter((a): a is number[] => Array.isArray(a));
  const extra = m.extraLayers; if (Array.isArray(extra)) for (const l of extra) { const t = (l as { tiles?: unknown }).tiles; if (Array.isArray(t)) layers.push(t as number[]); }
  const has = (x: number, y: number, tile: number) => x >= 0 && y >= 0 && x < W && y < H && layers.some((a) => a[y * W + x] === tile);
  const out: { id: string; x: number; y: number }[] = [];
  for (const id of ids) {
    const o = S.objects[id]; if (!o || !o.cells.length) continue;
    const [ax, ay, at] = o.cells[0]!;
    const need = Math.max(1, Math.ceil(o.cells.length * 0.6));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!has(x, y, at)) continue;
      const ox = x - ax, oy = y - ay;
      let hit = 0; for (const [dx, dy, t] of o.cells) if (has(ox + dx, oy + dy, t)) hit++;
      if (hit >= need) out.push({ id, x: ox, y: oy });
    }
  }
  return out;
}

export interface GroupVerdict { readonly group: PieceTableGroup; readonly near: number; readonly elsewhere: readonly { x: number; y: number }[]; readonly covered: boolean }

/** 표와 지은 맵을 맞댄다. 표 좌표는 대략이라 전체 평행 이동(±6칸) 하나를 먼저 맞추고, 묶음 자리 ±3칸 안의 같은 조각 수를 센다. */
export function compareTableToMap(project: Project, mapId: string, table: PieceTable): { verdicts: GroupVerdict[]; coverage: number; offset: { dx: number; dy: number } } | undefined {
  const map = project.maps[mapId]; const S = specWithWorkshop(project.tilesets[map?.tilesetId ?? ""]);
  if (!map || !S) return undefined;
  const placed = findPlacedPieces(map, S, new Set(table.groups.map((g) => g.id)));
  const near = (g: PieceTableGroup, dx: number, dy: number) => placed.filter((p) => p.id === g.id && Math.max(Math.abs(p.x - (g.x + dx)), Math.abs(p.y - (g.y + dy))) <= 3).length;
  const need = (g: PieceTableGroup) => Math.max(1, Math.ceil(g.count / 2));
  let best = { dx: 0, dy: 0, score: -1 };
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const score = table.groups.reduce((n, g) => n + (near(g, dx, dy) >= need(g) ? 1 : 0), 0) - (Math.abs(dx) + Math.abs(dy)) * 0.01;
    if (score > best.score) best = { dx, dy, score };
  }
  const verdicts = table.groups.map((g) => {
    const n = near(g, best.dx, best.dy);
    return { group: g, near: n, covered: n >= need(g), elsewhere: placed.filter((p) => p.id === g.id).map((p) => ({ x: p.x, y: p.y })).slice(0, 6) };
  });
  return { verdicts, coverage: verdicts.length ? verdicts.filter((v) => v.covered).length / verdicts.length : 0, offset: { dx: best.dx, dy: best.dy } };
}

/** 관문 항목 글(영어 — 모델이 읽는다). 빠진 묶음 하나에 항목 하나. */
export function tableGateProblems(project: Project, mapId: string | undefined, table: PieceTable | undefined): { key: string; text: string; source: "gate" }[] {
  if (!table || !mapId) return [];
  const c = compareTableToMap(project, mapId, table); if (!c) return [];
  return c.verdicts.filter((v) => !v.covered).map((v) => {
    const g = v.group, at = `(${g.x + c.offset.dx},${g.y + c.offset.dy})`;
    const where = v.elsewhere.length ? `found ${v.elsewhere.length} elsewhere at ${v.elsewhere.map((p) => `(${p.x},${p.y})`).join(" ")} — misplaced` : "not on the map — missing";
    return { key: `game:table:${g.name}:${g.id}`, source: "gate" as const,
      text: `[piece table] group «${g.name}» = ${g.count}× ${g.id} near ${at} on map ${mapId}: ${v.near} there, ${where}. Place it as your table says with edit_place (zones[].design groups) or move_object, then inspect; or call piece_table again to revise the table if the design changed on purpose.` };
  });
}
