// 팩 프리셋 물체(구조물 킷, learnedFrom "pack-preset")를 조수가 이름으로 찍는 도구.
//
// 사람 팔레트 킷(list_structure_kits)은 「사람 스탬프 전용」이라 조수가 쓰지 않는다. 팩 프리셋 물체는
// 사용자가 팩을 올릴 때 프리셋이 심은 것이고, 그 타일셋에서 여러 칸 물체를 놓는 유일한 길이다
// (가로등·자판기처럼 칸이 여러 개면 번호를 하나씩 칠하다 어긋난다). 배경: openwiki/teaching-assistant-tilesets.md

import type { GameMap, Project, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { isPassable } from "@/project/collision";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { requireMap } from "./mapHelpers";

const KIND_TAGS = new Set(["decal", "prop", "tall", "wallmount", "door", "overhead"]);

function packObjects(tileset: TilesetDef | undefined): SectionStructureKitDef[] {
  return (tileset?.structureKits ?? []).filter((kit) => kit.learnedFrom === "pack-preset");
}

function objectKind(kit: SectionStructureKitDef): string {
  return kit.ai?.tags?.find((tag) => KIND_TAGS.has(tag)) ?? "prop";
}

function growth(kit: SectionStructureKitDef): { x: boolean; y: boolean } {
  const axis = kit.ai?.growthAxis;
  return { x: axis === "horizontal" || axis === "both", y: axis === "vertical" || axis === "both" };
}

function findObject(tileset: TilesetDef | undefined, query: string): SectionStructureKitDef {
  const objects = packObjects(tileset);
  if (objects.length === 0) {
    throw new ToolError("이 맵의 타일셋에는 팩 물체가 없습니다 — 팩 프리셋으로 만든 타일셋에서만 쓴다.", { code: "no-pack-objects" });
  }
  const needle = query.trim();
  const exact = objects.find((kit) => kit.id === needle) ?? objects.find((kit) => kit.name === needle);
  if (exact) return exact;
  const lowered = needle.toLowerCase();
  const partial = objects.filter((kit) => kit.id.toLowerCase().includes(lowered) || (kit.name ?? "").includes(needle));
  if (partial.length === 1) return partial[0]!;
  const hint = (partial.length > 1 ? partial : objects).slice(0, 8).map((kit) => `${kit.id}(${kit.name})`).join(", ");
  throw new ToolError(
    `물체를 찾지 못했습니다: "${query}"${partial.length > 1 ? " — 여러 개가 맞습니다" : ""}. 후보: ${hint}. list_tileset_objects 로 id 를 확인하세요.`,
    { code: "object-not-found" },
  );
}

function positiveInt(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 64) {
    throw new ToolError(`${name} 는 1~64 정수여야 합니다: ${String(value)}`, { code: "invalid-args" });
  }
  return value as number;
}

function roadUnder(project: Project, map: GameMap, x: number, y: number): boolean {
  const tileset = project.tilesets[map.tilesetId];
  const tile = map.lowerTiles[y * map.width + x] ?? -1;
  return tile >= 0 && tileset?.tileMeta?.[tile]?.tags?.includes("road") === true;
}

function wallUnder(project: Project, map: GameMap, x: number, y: number): boolean {
  const tileset = project.tilesets[map.tilesetId];
  const tile = map.lowerTiles[y * map.width + x] ?? -1;
  const role = tile >= 0 ? tileset?.tileMeta?.[tile]?.role : undefined;
  return role === "wall" || role === "roof";
}

/**
 * 차선 화살표가 중앙선의 어느 쪽에 있는지 본다(우측통행). 2026-09-25 헤드리스 실측: 가로 차도 → 를 중앙선 위(북쪽) 차로에
 * 찍어 역주행 화살표가 됐다. 중앙선을 못 찾으면 말하지 않는다.
 */
function arrowLaneWarning(tileset: TilesetDef | undefined, map: GameMap, objectId: string, x: number, y: number): string | null {
  const laneTile = (id: string): number | undefined => packObjects(tileset).find((kit) => kit.id === id)?.rows[0]?.upperTiles?.[0];
  const horizontal = objectId === "arrow_right" || objectId === "arrow_left";
  const vertical = objectId === "arrow_up" || objectId === "arrow_down";
  if (!horizontal && !vertical) return null;
  const line = laneTile(horizontal ? "lane_line_horizontal" : "lane_line_vertical");
  if (line === undefined) return null;
  const span = horizontal ? map.height : map.width;
  const at = (i: number): number => horizontal ? map.upperTiles[i * map.width + x]! : map.upperTiles[y * map.width + i]!;
  let nearest: number | null = null;
  for (let i = 0; i < span; i += 1) {
    if (at(i) === line && (nearest === null || Math.abs(i - (horizontal ? y : x)) < Math.abs(nearest - (horizontal ? y : x)))) nearest = i;
  }
  if (nearest === null) return null;
  const pos = horizontal ? y : x;
  const wrong = objectId === "arrow_right" ? pos < nearest
    : objectId === "arrow_left" ? pos > nearest
    : objectId === "arrow_up" ? pos < nearest
    : pos > nearest;
  if (!wrong) return null;
  const rule = horizontal
    ? `가로 차도는 → 가 중앙선(${nearest}행) 아래 차로, ← 가 위 차로`
    : `세로 차도는 ↑ 가 중앙선(${nearest}열) 오른쪽 차로, ↓ 가 왼쪽 차로`;
  return `차선 화살표가 반대 차로에 있습니다(우측통행: ${rule}). 역주행 표시가 되니 다른 차로로 옮기세요.`;
}

/**
 * 중앙선은 칸 한가운데에 선이 그려진 1칸 물체다 — 차도 폭이 짝수면 어느 줄에 찍어도 반 칸 치우친다
 * (2026-09-25 헤드리스 실측: 6칸 차도에서 차로가 3.5칸·2.5칸). 홀수 폭 차도의 가운데 줄을 알려 준다.
 */
function centerLineWarning(project: Project, map: GameMap, objectId: string, x: number, y: number): string | null {
  const horizontal = objectId === "lane_line_horizontal";
  if (!horizontal && objectId !== "lane_line_vertical") return null;
  const road = (i: number): boolean => horizontal ? roadUnder(project, map, x, i) : roadUnder(project, map, i, y);
  const pos = horizontal ? y : x;
  if (!road(pos)) return null;
  let start = pos;
  let end = pos;
  while (start > 0 && road(start - 1)) start -= 1;
  while (end < (horizontal ? map.height : map.width) - 1 && road(end + 1)) end += 1;
  const width = end - start + 1;
  const axis = horizontal ? "행" : "열";
  if (width % 2 === 0) {
    return `차도 폭이 ${width}칸(짝수)이라 중앙선이 반 칸 치우칩니다 — 중앙선은 칸 한가운데에 그려진다. 차도를 홀수 폭(5·7칸)으로 다시 깔고 가운데 ${axis}에 찍으세요.`;
  }
  const middle = start + (width - 1) / 2;
  return pos === middle ? null : `중앙선이 차도 가운데(${middle}${axis})가 아닙니다 — ${start}~${end}${axis} 차도의 가운데 ${axis}은 ${middle}.`;
}

const listTilesetObjects: ToolDefinition = {
  name: "list_tileset_objects",
  description:
    "팩 프리셋 타일셋(사용자가 올린 RPG Maker 팩으로 만든 타일셋)의 여러 칸 물체 목록 — 가로등·신호등·자판기·벤치·창문·문·차선·횡단보도 등. "
    + "id·이름·크기·종류(decal 바닥 표시/prop 막힘/tall 밑줄만 막힘/wallmount 벽·옥상 부착/door 문/overhead 머리 위)·이어 찍기 축. "
    + "놓을 때는 stamp_tileset_object.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      query: { type: "string", description: "선택. 이름·id·설명에 든 낱말로 거른다(예: \"가로등\")" },
    },
    required: ["mapId"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const tileset = project.tilesets[map.tilesetId];
    const query = typeof args.query === "string" ? args.query.trim() : "";
    const objects = packObjects(tileset)
      .filter((kit) => !query || kit.id.includes(query) || (kit.name ?? "").includes(query) || (kit.ai?.description ?? "").includes(query))
      .map((kit) => {
        const axes = growth(kit);
        return {
          id: kit.id,
          name: kit.name ?? kit.id,
          width: kit.width,
          height: kit.height,
          kind: objectKind(kit),
          ...(axes.x || axes.y ? { repeat: axes.x && axes.y ? "x,y" : axes.x ? "x" : "y" } : {}),
          ...(kit.ai?.description ? { description: kit.ai.description } : {}),
        };
      });
    return {
      summary: objects.length === 0
        ? `${map.name} 타일셋(${map.tilesetId})에 ${query ? `"${query}" 에 맞는 ` : ""}팩 물체가 없습니다.`
        : `${map.name} 타일셋의 팩 물체 ${objects.length}개${query ? `("${query}")` : ""}`,
      data: { tilesetId: map.tilesetId, objects },
    };
  },
};

const stampTilesetObject: ToolDefinition = {
  name: "stamp_tileset_object",
  description:
    "팩 프리셋 물체 하나를 at(왼쪽 위 칸) 또는 base(땅에 닿는 맨 아래 줄 왼쪽 칸)에 원형 그대로 찍는다(위층). objectId = list_tileset_objects 의 id(또는 정확한 이름). "
    + "막힌 밑칸이 옥상·외벽·물 위면 거부한다. "
    + "repeat {x,y} 는 이어 찍을 수 있는 물체(차선·횡단보도·벤치·울타리)만 — 그 축으로 물체 크기만큼 붙여 반복한다. "
    + "이미 위층 타일이 있는 칸은 overwrite:true 가 없으면 거부한다. 문(door)은 외벽 맨 아래 줄에, 창·간판(wallmount)은 외벽·옥상 안에만(밖에 걸치면 거부) 찍는다. "
    + "횡단보도는 차도 칸에만, 차선 화살표는 우측통행 차로에만(반대 차로면 거부). "
    + "결과에 막힌 칸(blockedCells)과 문 칸(doorCells, 이동 이벤트 자리)을 돌려준다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      objectId: { type: "string", description: "물체 id(예: \"street_lamp_left\") 또는 정확한 이름" },
      at: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], description: "물체 왼쪽 위 칸. at 대신 base 를 줘도 된다" },
      base: {
        type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"],
        description: "물체가 땅에 닿는 맨 아래 줄의 왼쪽 칸. 키 큰 물체(가로등 1×3 등)는 이쪽이 쉽다 — at = (base.x, base.y - 높이 + 1)",
      },
      repeat: {
        type: "object",
        properties: { x: { type: "integer", minimum: 1 }, y: { type: "integer", minimum: 1 } },
        description: "선택. 이어 찍기 횟수(기본 1). 예: 횡단보도 5칸 세로 = {y:5}",
      },
      overwrite: { type: "boolean", description: "이미 위층 타일이 있는 칸을 덮어쓸지(기본 false)" },
      leftHandTraffic: { type: "boolean", description: "차선 화살표를 왼쪽 통행으로 그릴 때만 true(기본 우측통행 검사)" },
    },
    required: ["mapId", "objectId"],
  },
  invalidArgsExample: { mapId: "city", objectId: "street_lamp_left", base: { x: 4, y: 11 } },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    const kit = findObject(tileset, String(args.objectId ?? ""));
    const base = args.base as { x?: unknown; y?: unknown } | undefined;
    const at = base !== undefined && args.at === undefined
      ? { x: base.x, y: Number.isInteger(base.y) ? (base.y as number) - kit.height + 1 : base.y }
      : args.at as { x?: unknown; y?: unknown } | undefined;
    if (!at || !Number.isInteger(at.x) || !Number.isInteger(at.y)) {
      throw new ToolError("at(왼쪽 위 칸) 또는 base(맨 아래 줄 왼쪽 칸) 중 하나를 {x, y} 정수 좌표로 주세요.", { code: "invalid-args", mapId: map.id });
    }
    const repeat = (args.repeat ?? {}) as { x?: unknown; y?: unknown };
    const repeatX = positiveInt(repeat.x, "repeat.x", 1);
    const repeatY = positiveInt(repeat.y, "repeat.y", 1);
    const axes = growth(kit);
    if ((repeatX > 1 && !axes.x) || (repeatY > 1 && !axes.y)) {
      throw new ToolError(`${kit.id}(${kit.name}) 은 ${repeatX > 1 && !axes.x ? "가로" : "세로"}로 이어 찍는 물체가 아닙니다 — 여러 개가 필요하면 좌표를 바꿔 따로 찍으세요.`, { code: "not-repeatable", mapId: map.id });
    }
    const ox = at.x as number;
    const oy = at.y as number;
    const width = kit.width * repeatX;
    const height = kit.height * repeatY;
    if (ox < 0 || oy < 0 || ox + width > map.width || oy + height > map.height) {
      throw new ToolError(
        `${kit.id} ${width}×${height} 이 맵(${map.width}×${map.height})을 벗어납니다 — at (${ox},${oy}).`,
        { code: "out-of-bounds", mapId: map.id, x: ox, y: oy },
      );
    }
    const writes: { index: number; x: number; y: number; layer: "lowerTiles" | "upperTiles"; tile: number }[] = [];
    for (let ry = 0; ry < repeatY; ry += 1) for (let rx = 0; rx < repeatX; rx += 1) {
      kit.rows.forEach((row, dy) => {
        for (let dx = 0; dx < kit.width; dx += 1) {
          const x = ox + rx * kit.width + dx;
          const y = oy + ry * kit.height + dy;
          const index = y * map.width + x;
          const upper = row.upperTiles?.[dx] ?? -1;
          const lower = row.tiles[dx] ?? -1;
          if (upper >= 0) writes.push({ index, x, y, layer: "upperTiles", tile: upper });
          if (lower >= 0) writes.push({ index, x, y, layer: "lowerTiles", tile: lower });
        }
      });
    }
    // 문은 차양 그늘(차양 아래 줄) 위에 찍어도 된다 — 차양 바로 밑이 가게 문 자리다.
    const kind = objectKind(kit);
    const yieldsToDoor = kind === "door"
      ? new Set(packObjects(tileset).filter((other) => objectKind(other) === "overhead").flatMap((other) => other.rows.flatMap((row) => row.upperTiles ?? [])))
      : new Set<number>();
    if (args.overwrite !== true) {
      const clash = writes.find((w) => w.layer === "upperTiles" && map.upperTiles[w.index]! >= 0 && map.upperTiles[w.index] !== w.tile
        && !yieldsToDoor.has(map.upperTiles[w.index]!));
      if (clash) {
        throw new ToolError(
          `(${clash.x},${clash.y}) 위층에 이미 타일 ${map.upperTiles[clash.index]} 이 있습니다 — 다른 자리를 고르거나 overwrite:true.`,
          { code: "occupied-cell", mapId: map.id, x: clash.x, y: clash.y },
        );
      }
    }
    // 땅에 서는 물체의 막힌 칸이 옥상·외벽·물 위면 거부한다 — 좌표를 「서 있는 칸」으로 착각한 흔한 실수다
    // (2026-09-24 헤드리스 실측: 보도 가로등 at 을 밑칸으로 줘서 건물 옥상 위에 세웠다).
    if (kind === "prop" || kind === "tall") {
      const tileset = draft.tilesets[map.tilesetId];
      const bad = writes.find((w) => w.layer === "upperTiles" && tileset?.passability[w.tile] && !Object.values(tileset.passability[w.tile]!).some(Boolean)
        && (wallUnder(draft, map, w.x, w.y) || !isPassable(draft, map, w.x, w.y)));
      if (bad) {
        throw new ToolError(
          `${kit.id} 의 밑칸 (${bad.x},${bad.y}) 이 옥상·외벽·물·다른 물체 위입니다 — 보도·잔디 같은 걷는 바닥에 밑이 오게 하세요. `
          + `at 은 물체의 왼쪽 위 칸이다(높이 ${kit.height}). 밑칸 기준으로 주려면 base:{x,y}.`,
          { code: "object-on-blocked", mapId: map.id, x: bad.x, y: bad.y },
        );
      }
      // 차도 한가운데 표지판·가로등은 길을 막는다(2026-09-24 헤드리스 실측). 교통 콘만 차도에 선다.
      const onRoad = !kit.ai?.tags?.includes("on-road") && writes.find((w) => w.layer === "upperTiles"
        && tileset?.passability[w.tile] && !Object.values(tileset.passability[w.tile]!).some(Boolean) && roadUnder(draft, map, w.x, w.y));
      if (onRoad) {
        throw new ToolError(
          `${kit.id} 의 밑칸 (${onRoad.x},${onRoad.y}) 이 차도 위입니다 — 가로등·표지판·신호등은 차도 옆 보도에 세운다(교통 콘만 차도 위).`,
          { code: "object-on-road", mapId: map.id, x: onRoad.x, y: onRoad.y },
        );
      }
    }
    // 경고로는 모델이 고치지 않았다(2026-09-25 재시험: 화살표 역주행·보도 위 횡단보도·외벽 밖 창을 경고만 받고 그대로 뒀다) — 거부한다.
    if (kit.id.startsWith("crosswalk_")) {
      const off = writes.find((w) => w.layer === "upperTiles" && !roadUnder(draft, map, w.x, w.y));
      if (off) {
        throw new ToolError(
          `횡단보도 칸 (${off.x},${off.y}) 이 차도 밖입니다 — 횡단보도는 차도 폭 전체에만 찍는다(보도·광장 위에 걸치지 않게). 차도 줄을 확인하고 repeat 를 차도 폭에 맞추세요.`,
          { code: "crosswalk-off-road", mapId: map.id, x: off.x, y: off.y },
        );
      }
    }
    if (kit.id.startsWith("crosswalk_")) {
      // 교차로에 「횡단보도 테두리 차도」 재료를 깔면 둘레에 줄이 이미 그려진다 — 물체를 붙여 찍으면 두 겹 줄무늬가 된다(2026-09-25 재시험).
      const painted = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
        const tile = map.lowerTiles[y * map.width + x] ?? -1;
        return tile >= 0 && (tileset?.tileMeta?.[tile]?.label ?? "").includes("횡단보도");
      };
      const near = writes.find((w) => w.layer === "upperTiles"
        && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => painted(w.x + dx!, w.y + dy!)));
      if (near) {
        throw new ToolError(
          `(${near.x},${near.y}) 옆이 이미 횡단보도가 그려진 차도 재료입니다 — 교차로 「횡단보도 테두리 차도」 둘레에는 횡단보도 물체를 더 찍지 않는다(줄무늬가 두 겹이 된다).`,
          { code: "crosswalk-doubled", mapId: map.id, x: near.x, y: near.y },
        );
      }
    }
    if (kind === "wallmount") {
      const off = writes.find((w) => w.layer === "upperTiles" && !wallUnder(draft, map, w.x, w.y));
      if (off) {
        throw new ToolError(
          `${kit.id} 의 (${off.x},${off.y}) 칸이 외벽·옥상 밖입니다 — 창·간판·옥상 물체는 외벽·옥상 사각형 안에 다 들어가게 찍는다(${kit.width}×${kit.height}).`,
          { code: "wallmount-off-wall", mapId: map.id, x: off.x, y: off.y },
        );
      }
    }
    const wrongLane = args.leftHandTraffic === true ? null : arrowLaneWarning(tileset, map, kit.id, ox, oy);
    if (wrongLane) throw new ToolError(`${wrongLane} (왼쪽 통행 도시로 일부러 그리는 거면 leftHandTraffic:true)`, { code: "arrow-wrong-lane", mapId: map.id, x: ox, y: oy });
    // 문·창·간판·차양은 그림에 투명한 틈이 있다 — 창 난 벽돌 벽 위에 찍으면 밑 창이 비쳐 두 겹으로 보인다
    // (2026-09-25 헤드리스 실측: 문 위로 창 윗단, 차양 그늘 속 창). 찍는 칸의 벽을 창 없는 짝으로 바꾼다.
    const plainWalls = tileset?.mvPack?.plainWalls;
    let plainSwapped = 0;
    if (plainWalls && (kind === "door" || kind === "wallmount" || kind === "overhead")) {
      for (const w of writes) {
        if (w.layer !== "upperTiles") continue;
        const plain = plainWalls[String(map.lowerTiles[w.index])];
        if (plain !== undefined) { map.lowerTiles[w.index] = plain; plainSwapped += 1; }
      }
    }
    for (const w of writes) map[w.layer][w.index] = w.tile;
    const cells = [...new Map(writes.map((w) => [w.index, w])).values()];
    const blockedCells = cells.filter((c) => !isPassable(draft, map, c.x, c.y)).map((c) => ({ x: c.x, y: c.y }));
    const doorCells = kind === "door" ? cells.filter((c) => c.y === oy + height - 1).map((c) => ({ x: c.x, y: c.y })) : [];
    const warnings: string[] = [];
    if (kind === "door" && doorCells.some((c) => !wallUnder(draft, map, c.x, c.y))) {
      warnings.push("문 아래층이 외벽이 아닙니다 — 문은 외벽 맨 아래 줄에 찍는다.");
    }
    if (kind === "decal" && cells.some((c) => wallUnder(draft, map, c.x, c.y))) {
      warnings.push("바닥 표시가 외벽·옥상 위에 찍혔습니다.");
    }
    const laneWarning = centerLineWarning(draft, map, kit.id, ox, oy);
    if (laneWarning) warnings.push(laneWarning);
    return {
      summary: `${map.name}에 ${kit.name}(${kit.id}) ${repeatX * repeatY > 1 ? `${repeatX}×${repeatY}번 ` : ""}찍음 — (${ox},${oy}) ${width}×${height}${blockedCells.length ? `, 막힌 칸 ${blockedCells.length}` : ""}${plainSwapped ? `, 밑 벽 ${plainSwapped}칸을 창 없는 벽으로` : ""}`,
      ...(warnings.length ? { warnings } : {}),
      data: { objectId: kit.id, footprint: { x: ox, y: oy, w: width, h: height }, blockedCells, ...(doorCells.length ? { doorCells } : {}) },
    };
  },
};

export const TILESET_OBJECT_TOOLS: readonly ToolDefinition[] = [listTilesetObjects, stampTilesetObject];
