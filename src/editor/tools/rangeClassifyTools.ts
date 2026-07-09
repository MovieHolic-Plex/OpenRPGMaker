import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PatternKind = PatternGrammar["kind"];
type PatternPart = PatternGrammar["parts"][number];
type PatternPartRole = PatternPart["role"];

type RangeRect = {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
};

type SuggestGroupFromRangeData = {
  readonly rect: RangeRect;
  readonly suggestion: {
    readonly name: string;
    readonly parts: readonly PatternPart[];
    readonly patternGrammar: PatternGrammar;
    readonly role: TileGroupRole;
  };
  readonly tileIds: readonly number[];
  readonly tilesetId: string;
};

const TILE_GROUP_ROLES = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"] as const satisfies readonly TileGroupRole[];
const NINE_SLICE_ROLES = ["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"] as const satisfies readonly PatternPartRole[];
const ROLE_LABELS = {
  building: "건물",
  castle: "성",
  fence: "울타리",
  prop: "소품",
  roof: "지붕",
  terrain: "지형",
  wall: "벽",
  water: "물",
} as const satisfies Record<TileGroupRole, string>;
const KIND_LABELS = {
  animated_terrain: "애니메이션",
  autotile_3x3: "3x3 자동타일",
  event_required_object: "이벤트 필요 오브젝트",
  horizontal_expandable: "가로 확장",
  nine_slice_expandable: "9분할 확장",
  overlay_detail: "장식 오버레이",
  single: "단일",
  source_rect: "원본 영역",
  vertical_expandable: "세로 확장",
} as const satisfies Record<PatternKind, string>;

const suggestGroupFromRange: ToolDefinition = {
  name: "suggest_group_from_range",
  description:
    "시트 좌표 rect 또는 tileIds 범위를 읽어 새 타일 그룹의 kind/role/name/parts 초안을 휴리스틱으로 제안한다. 확정 전 render_group_sample로 미리보기를 보여줘라.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "대상 타일셋 id" },
      rect: { type: "object", additionalProperties: true, description: "시트 타일 좌표 {x,y,w,h}" },
      tileIds: { type: "array", items: { type: "integer" }, description: "직접 지정한 타일 id 목록" },
    },
    required: ["tilesetId"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project.tilesets, args.tilesetId);
    const explicitTileIds = tileIdsValue(tileset, args.tileIds);
    const rect = rectValue(args.rect, tileset) ?? rectFromTileIds(tileset, explicitTileIds);
    const tileIds = explicitTileIds ?? tileIdsFromRect(tileset, rect);
    if (tileIds.length === 0) throw new ToolError("선택 범위에 유효한 타일이 없습니다.", { code: "empty-range" });

    const kind = inferPatternKind(rect, tileIds);
    const role = inferRole(tileset, tileIds, kind);
    const parts = partsFor(kind, tileIds);
    const patternGrammar = patternGrammarFor(kind, parts);
    const data: SuggestGroupFromRangeData = {
      rect,
      suggestion: {
        name: `${ROLE_LABELS[role]} ${KIND_LABELS[kind]} 후보`,
        parts,
        patternGrammar,
        role,
      },
      tileIds,
      tilesetId: tileset.id,
    };
    return {
      data,
      summary: `${tileIds.length}개 타일 범위에서 ${ROLE_LABELS[role]} / ${KIND_LABELS[kind]} 초안을 제안했습니다.`,
    };
  },
};

export const RANGE_CLASSIFY_TOOLS: readonly ToolDefinition[] = [suggestGroupFromRange];

function requireTileset(tilesets: Record<string, TilesetDef>, idValue: unknown): TilesetDef {
  const id = typeof idValue === "string" && idValue.length > 0 ? idValue : DEFAULT_TILESET_ID;
  const tileset = tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function rectValue(value: unknown, tileset: TilesetDef): RangeRect | null {
  if (value === undefined || value === null) return null;
  const record = recordValue(value);
  if (!record) throw new ToolError("rect 형식이 올바르지 않습니다.", { code: "invalid-args" });
  const rect = { h: intField(record, "h"), w: intField(record, "w"), x: intField(record, "x"), y: intField(record, "y") };
  if (rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0) {
    throw new ToolError("rect는 0 이상의 x/y와 1 이상의 w/h가 필요합니다.", { code: "invalid-args" });
  }
  if (rect.x >= tileset.tilesPerRow || rect.x + rect.w > tileset.tilesPerRow || rect.y >= Math.ceil(tileset.count / tileset.tilesPerRow)) {
    throw new ToolError("rect가 시트 범위를 벗어났습니다.", { code: "range-out-of-bounds" });
  }
  return rect;
}

function rectFromTileIds(tileset: TilesetDef, tileIds: readonly number[] | null): RangeRect {
  if (!tileIds || tileIds.length === 0) throw new ToolError("rect 또는 tileIds가 필요합니다.", { code: "invalid-args" });
  const xs = tileIds.map((tileId) => tileId % tileset.tilesPerRow);
  const ys = tileIds.map((tileId) => Math.floor(tileId / tileset.tilesPerRow));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { h: Math.max(...ys) - y + 1, w: Math.max(...xs) - x + 1, x, y };
}

function tileIdsValue(tileset: TilesetDef, value: unknown): readonly number[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new ToolError("tileIds는 배열이어야 합니다.", { code: "invalid-args" });
  return [...new Set(value.map((tileId) => requireTileId(tileset, tileId)))];
}

function requireTileId(tileset: TilesetDef, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= tileset.count) {
    throw new ToolError(`타일 인덱스 범위 밖: ${String(value)} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return value;
}

function intField(record: Record<string, unknown>, key: keyof RangeRect): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`rect.${key}는 정수여야 합니다.`, { code: "invalid-args" });
  return value;
}

function tileIdsFromRect(tileset: TilesetDef, rect: RangeRect): readonly number[] {
  const tileIds: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const tileId = y * tileset.tilesPerRow + x;
      if (tileId < tileset.count) tileIds.push(tileId);
    }
  }
  return tileIds;
}

function inferPatternKind(rect: RangeRect, tileIds: readonly number[]): PatternKind {
  if (tileIds.length === 1 || (rect.w === 1 && rect.h === 1)) return "single";
  if (rect.w === 3 && rect.h === 3 && tileIds.length === 9) return "autotile_3x3";
  if (rect.w === 1 && rect.h >= 2) return "vertical_expandable";
  if (rect.h === 1 && rect.w >= 2) return "horizontal_expandable";
  return "source_rect";
}

function inferRole(tileset: TilesetDef, tileIds: readonly number[], kind: PatternKind): TileGroupRole {
  for (const tileId of tileIds) {
    const role = roleValue(tileset.tileMeta?.[tileId]?.role) ?? tileset.tileGroups?.find((group) => group.tileIds.includes(tileId))?.role;
    if (role) return role;
  }
  const text = tileIds.map((tileId) => `${tileset.tileMeta?.[tileId]?.label ?? ""} ${tileset.tileMeta?.[tileId]?.description ?? ""}`).join(" ").toLowerCase();
  if (/water|물|강|호수|바다/u.test(text)) return "water";
  if (/wall|벽|담/u.test(text)) return "wall";
  if (/roof|지붕/u.test(text)) return "roof";
  if (/fence|울타리/u.test(text)) return "fence";
  if (/prop|object|소품|장식|나무|표지판/u.test(text)) return "prop";
  if (tileIds.filter((tileId) => tileset.priority[tileId] === "upper").length > tileIds.length / 2) return "prop";
  if (kind === "vertical_expandable" && tileIds.some((tileId) => isSolid(tileset, tileId))) return "wall";
  return "terrain";
}

function roleValue(value: string | undefined): TileGroupRole | null {
  return TILE_GROUP_ROLES.find((role) => role === value) ?? null;
}

function partsFor(kind: PatternKind, tileIds: readonly number[]): readonly PatternPart[] {
  switch (kind) {
    case "autotile_3x3":
    case "nine_slice_expandable":
      return NINE_SLICE_ROLES.map((role, index) => part(role, [tileIds[index] ?? tileIds[0] ?? 0]));
    case "vertical_expandable":
      return [part("top", [tileIds[0] ?? 0]), part("bottom", [tileIds[1] ?? tileIds[0] ?? 0])];
    case "horizontal_expandable": {
      const body = tileIds.slice(1, -1);
      return [part("leftCap", [tileIds[0] ?? 0]), part("repeatBody", body.length > 0 ? body : [tileIds[0] ?? 0]), part("rightCap", [tileIds.at(-1) ?? tileIds[0] ?? 0])];
    }
    case "animated_terrain":
    case "event_required_object":
    case "overlay_detail":
    case "single":
    case "source_rect":
      return [part("center", tileIds)];
    default:
      return assertNever(kind);
  }
}

function part(role: PatternPartRole, tileIds: readonly number[]): PatternPart {
  return { role, tileIds: [...tileIds] };
}

function patternGrammarFor(kind: PatternKind, parts: readonly PatternPart[]): PatternGrammar {
  const axis = axisFor(kind);
  return {
    ...(axis ? { axis } : {}),
    kind,
    ...(kind === "vertical_expandable" ? { minHeight: 2, minWidth: 1 } : {}),
    ...(kind === "horizontal_expandable" ? { minHeight: 1, minWidth: 2 } : {}),
    ...(kind === "autotile_3x3" || kind === "nine_slice_expandable" ? { minHeight: 3, minWidth: 3 } : {}),
    parts: parts.map((entry) => ({ role: entry.role, tileIds: [...entry.tileIds] })),
    preserveCaps: kind !== "single",
    repeat: repeatFor(kind),
  };
}

function axisFor(kind: PatternKind): PatternGrammar["axis"] | null {
  if (kind === "autotile_3x3" || kind === "nine_slice_expandable") return "both";
  if (kind === "horizontal_expandable") return "horizontal";
  if (kind === "vertical_expandable") return "vertical";
  return null;
}

function repeatFor(kind: PatternKind): PatternGrammar["repeat"] {
  if (kind === "horizontal_expandable" || kind === "vertical_expandable") return "body";
  if (kind === "nine_slice_expandable") return "center";
  return "source_order";
}

function isSolid(tileset: TilesetDef, tileId: number): boolean {
  const pass = tileset.passability[tileId];
  return Boolean(pass && !pass.up && !pass.down && !pass.left && !pass.right);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function assertNever(value: never): never {
  throw new ToolError(`처리하지 못한 패턴입니다: ${String(value)}`, { code: "invalid-pattern" });
}
