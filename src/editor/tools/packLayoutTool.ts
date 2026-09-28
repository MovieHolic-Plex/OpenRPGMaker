// 팩 프리셋 맵 한 장을 글자 배열(재료 범례) + 물체 목록으로 한 번에 까는 도구.
//
// 세트 맵을 잘 깐 방법이 이것이었다: 이야기·구역을 정하고 맵 전체를 글자 배열로 그린 뒤 물체를 얹고 검사한다(scripts/content/refmap 맵 기술).
// 조수는 fill_region·stamp_tileset_object 를 100번 넘게 부르며 칸을 조금씩 고쳤고(2026-09-28 헤드리스 시험: 재봉사 집 112~166회),
// 방 모양을 한눈에 보지 못해 ㅁ자 방과 목적 없는 흩뿌림이 나왔다. 참고문서 예시도 같은 글자 배열 형식이다.

import { cropExtraLayers, compactMapLayers } from "@/project/mapLayers";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";
import { isPackPresetTileset, lintPackMap } from "@/project/rpgmakerMv/packMapLint";
import type { AutotileGroup, TilesetDef } from "@/project/types";
import { TILESET_OBJECT_TOOLS } from "./tilesetObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { requireMap } from "./mapHelpers";

type Grid = { rows: string[]; legend: Record<string, string> };
type Material = { kind: "auto"; group: AutotileGroup } | { kind: "flat"; tile: number };

function readGrid(value: unknown, name: string): Grid | undefined {
  if (value === undefined) return undefined;
  const grid = value as { rows?: unknown; legend?: unknown };
  if (!Array.isArray(grid.rows) || !grid.rows.every((row) => typeof row === "string") || typeof grid.legend !== "object" || !grid.legend) {
    throw new ToolError(`${name} 는 {rows: 문자열 배열, legend: {글자: 재료 이름}} 이어야 합니다.`, { code: "invalid-args" });
  }
  return { rows: grid.rows as string[], legend: grid.legend as Record<string, string> };
}

function materialOf(tileset: TilesetDef, name: string): Material {
  const group = tileset.autotileGroups?.find((entry) => entry.name === name);
  if (group) return { kind: "auto", group };
  const flat = tileset.tileGroups?.find((entry) => entry.name === name && entry.tileIds.length === 1);
  if (flat) return { kind: "flat", tile: flat.tileIds[0]! };
  const names = [...(tileset.autotileGroups ?? []).map((g) => g.name), ...(tileset.tileGroups ?? []).filter((g) => g.tileIds.length === 1).map((g) => g.name)];
  const near = names.filter((n) => [...name].some((c) => c.trim() && n.includes(c))).slice(0, 12);
  throw new ToolError(`재료 이름 없음: "${name}" — 참고문서 「재료 목록」의 이름을 그대로 쓴다. 비슷한 이름: ${near.join(", ") || "(없음)"}`, { code: "material-not-found" });
}

/** 글자 배열을 칸 번호로 — 오토타일은 같은 재료 이웃으로 모양을 고른다(맵 밖 = 같은 재료, MV 규칙). */
function shapeGrid(tileset: TilesetDef, grid: Grid, w: number, h: number, full: boolean, name: string): number[] {
  const out = new Array<number>(w * h).fill(-1);
  const keys: (string | null)[] = [];
  const materials = new Map<string, Material>();
  grid.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === "." || c === " ") {
      if (full) throw new ToolError(`${name} (${x},${y}) 가 비었다 — 1층은 모든 칸에 재료가 있어야 한다(방 밖은 천장 재료).`, { code: "invalid-args" });
      keys[y * w + x] = null; return;
    }
    const material = grid.legend[c];
    if (material === undefined) throw new ToolError(`${name} 범례에 없는 글자 「${c}」 (${x},${y})`, { code: "invalid-args" });
    if (!materials.has(material)) materials.set(material, materialOf(tileset, material));
    keys[y * w + x] = material;
  }));
  const same = (x: number, y: number, key: string) => x < 0 || y < 0 || x >= w || y >= h || keys[y * w + x] === key;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const key = keys[y * w + x];
    if (!key) continue;
    const material = materials.get(key)!;
    if (material.kind === "flat") { out[y * w + x] = material.tile; continue; }
    const g = material.group;
    let mask = 0;
    if (same(x, y - 1, key)) mask |= 1; if (same(x + 1, y, key)) mask |= 2; if (same(x, y + 1, key)) mask |= 4; if (same(x - 1, y, key)) mask |= 8;
    if ((g.neighborhood ?? 4) === 8) {
      if (same(x + 1, y - 1, key)) mask |= 16; if (same(x + 1, y + 1, key)) mask |= 32; if (same(x - 1, y + 1, key)) mask |= 64; if (same(x - 1, y - 1, key)) mask |= 128;
    }
    out[y * w + x] = g.variantMap[String(mask)] ?? g.memberTileIds[0]!;
  }
  return out;
}

const stampObject = TILESET_OBJECT_TOOLS.find((tool) => tool.name === "stamp_tileset_object")!;

export const paintPackLayoutTool: ToolDefinition = {
  name: "paint_pack_layout",
  description:
    "팩 프리셋 타일셋(REFMAP 세트 등) 맵 한 장을 글자 배열로 한 번에 깐다 — 참고문서 「예시」 문서와 같은 형식. "
    + "layer1 = {rows:[\"####\",…], legend:{\"#\":\"재료 이름\"}} 모든 칸 필수(방 밖은 천장 재료), layer2 = 탁자·카운터·풀 같은 겹침 재료(`.` = 없음), "
    + "objects = [{id, at:{x,y}}] (at = 물체 왼쪽 위 칸, stamp_tileset_object 와 같은 규칙·순서대로; 한 줄 소품을 탁자·상자 위에 두면 4층에 올라간다). "
    + "배열 크기가 맵 크기와 다르면 맵을 그 크기로 바꾼다(작은 집은 9×9~15×13). 맵의 1~4층을 모두 새로 쓴다(이벤트는 남긴다). "
    + "재료 이름은 「재료 목록」, 물체 id 는 「물체 목록」 그대로. 오토타일 모양은 이웃에 맞춰 자동. "
    + "결과에 check_pack_map 검사(구조·통행·벽걸이·겹침·빈 공간)가 붙는다 — 경고를 보고 배열을 고쳐 다시 부르거나 fill_region·stamp_tileset_object 로 부분 수정한다. "
    + "칠하기 전에 이야기와 구역(용도·기준 물체·동선)을 정하고, 예시를 통째로 베끼지 않는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      layer1: {
        type: "object",
        description: "1층 바닥·천장·벽면 글자 배열",
        properties: { rows: { type: "array", items: { type: "string" } }, legend: { type: "object", additionalProperties: { type: "string" } } },
        required: ["rows", "legend"],
      },
      layer2: {
        type: "object",
        description: "선택. 2층 겹침 재료(탁자·카운터·러그·풀 덤불). `.` = 없음",
        properties: { rows: { type: "array", items: { type: "string" } }, legend: { type: "object", additionalProperties: { type: "string" } } },
        required: ["rows", "legend"],
      },
      objects: {
        type: "array",
        description: "찍을 물체. 순서대로 찍는다(탁자 먼저, 그 위 소품 나중)",
        items: {
          type: "object",
          properties: { id: { type: "string" }, at: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] } },
          required: ["id", "at"],
        },
      },
    },
    required: ["mapId", "layer1"],
  },
  invalidArgsExample: {
    mapId: "hut",
    layer1: { rows: ["#####", "#www#", "#www#", "#fff#", "##f##"], legend: { "#": "그늘 천장", w: "갈색 돌벽돌 벽", f: "흙바닥(평)" } },
    objects: [{ id: "crate", at: { x: 1, y: 3 } }],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isPackPresetTileset(tileset)) {
      throw new ToolError(`${map.name} 의 타일셋(${map.tilesetId})은 재료·물체 이름이 있는 팩 프리셋이 아니다 — paint_pack_layout 은 팩 프리셋 맵에서만 된다.`, { code: "not-pack-map", mapId: map.id });
    }
    const layer1 = readGrid(args.layer1, "layer1")!;
    const layer2 = readGrid(args.layer2, "layer2");
    const h = layer1.rows.length, w = layer1.rows[0]?.length ?? 0;
    if (w < 3 || h < 3 || w > MAX_TOOL_MAP_DIMENSION || h > MAX_TOOL_MAP_DIMENSION) throw new ToolError(`layer1 크기 ${w}×${h} — 3 이상 ${MAX_TOOL_MAP_DIMENSION} 이하`, { code: "invalid-args" });
    for (const [name, grid] of [["layer1", layer1], ["layer2", layer2]] as const) {
      if (!grid) continue;
      if (grid.rows.length !== h) throw new ToolError(`${name} 줄 수 ${grid.rows.length} ≠ ${h}`, { code: "invalid-args" });
      const bad = grid.rows.findIndex((row) => [...row].length !== w);
      if (bad >= 0) throw new ToolError(`${name} ${bad}행 길이 ${[...grid.rows[bad]!].length} ≠ ${w} — 모든 줄의 글자 수가 같아야 한다`, { code: "invalid-args" });
    }
    const lower = shapeGrid(tileset, layer1, w, h, true, "layer1");
    const overlay = layer2 ? shapeGrid(tileset, layer2, w, h, false, "layer2") : undefined;
    const outEvents = map.events.filter((event) => event.x >= w || event.y >= h);
    if (outEvents.length) throw new ToolError(`새 크기 ${w}×${h} 밖 이벤트 ${outEvents.length}개(${outEvents.slice(0, 4).map((e) => `${e.id}(${e.x},${e.y})`).join(", ")}) — 먼저 옮기세요.`, { code: "events-out-of-bounds", mapId: map.id });
    if (draft.startMapId === map.id && (draft.startPos.x >= w || draft.startPos.y >= h)) throw new ToolError(`시작 좌표가 새 크기 밖입니다 — set_start_position 으로 먼저 옮기세요.`, { code: "start-out-of-bounds" });
    const oldW = map.width, oldH = map.height;
    if (oldW !== w || oldH !== h) cropExtraLayers(map, oldW, oldH, 0, 0, w, h);
    map.width = w; map.height = h;
    map.lowerTiles = lower;
    map.upperTiles = new Array<number>(w * h).fill(-1);
    delete map.lowerTileStacks; delete map.upperTileStacks;
    if (overlay) map.lowerOverlayTiles = overlay; else delete map.lowerOverlayTiles;
    delete map.upperOverlayTiles; delete map.shadowBits;
    const failed: string[] = [];
    let placed = 0;
    for (const [n, object] of ((args.objects as { id?: unknown; at?: unknown }[] | undefined) ?? []).entries()) {
      try { stampObject.run(draft, { mapId: map.id, objectId: object.id, at: object.at }); placed += 1; }
      catch (error) { failed.push(`${n + 1}. ${String(object.id)} ${JSON.stringify(object.at)}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    compactMapLayers(map);
    const lint = lintPackMap(draft, map);
    const warnings = [...failed.map((line) => `물체 못 찍음 — ${line}`), ...(lint?.warnings ?? [])];
    return {
      summary: `${map.name} ${w}×${h} 을 글자 배열로 깔고 물체 ${placed}개${failed.length ? `(실패 ${failed.length})` : ""}${lint?.warnings.length ? ` — 검사 경고 ${lint.warnings.length}가지` : " — 검사 통과"}`,
      ...(warnings.length ? { warnings } : {}),
      data: { mapId: map.id, width: w, height: h, placed, failed, check: lint },
    };
  },
};
