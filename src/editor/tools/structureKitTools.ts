// editor/tools/structureKitTools.ts
// 유저 붓질에서 학습·등록된 구조 킷(tileset.structureKits)의 하네스 접점.
//  - list_structure_kits (read)  — 킷의 존재·정확한 타일 행을 기계가 읽는다.
//  - stamp_structure_kit (write) — **AI 시공 금지**(2026-08-31). 사람 팔레트 스탬프 전용.
//    호출되면 맵을 건드리지 않고 거절한다. 집=author_house, 벽=build_wall, 지형=fill_region.

import { builtinHouseStructureKitsFor } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import {
  structureKitGrowthAxes,
  structureKitLayerHome,
  structureKitRepeatable,
  structureKitSize,
  structureKitUnitCells,
} from "@/editor/harnessSuggestion/structureKitModel";
import { describePlacementSurface, evaluatePlacementConditions, mapSurfaceProbe } from "@/project/placementSurface";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import type {
  GameMap,
  Project,
  StructureKitAiMeta,
  StructureKitCellHint,
  StructureKitDef,
  StructureKitPart,
  TilesetDef,
} from "@/project/types";
import { TILE } from "@/project/defaults";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { COORD_SCHEMA } from "./schemaShapes";

type Point = { readonly x: number; readonly y: number };

/** 타일셋의 사용 가능한 킷 전체 — 내장 파라메트릭 집 킷 + 등록 킷. */
function availableKits(tileset: TilesetDef | undefined): StructureKitDef[] {
  if (!tileset) return [];
  return [...builtinHouseStructureKitsFor(tileset), ...(tileset.structureKits ?? [])];
}

const listStructureKits: ToolDefinition = {
  name: "list_structure_kits",
  description:
    "사람이 팔레트에 등록한 구조 킷 목록(읽기 전용). mapId를 주면 그 맵 타일셋의 킷만. "
    + "이 킷은 사람 팔레트 스탬프 전용이다 — 타일 시공에 stamp_structure_kit를 쓰지 말 것. "
    + "집=author_house, 마을=author_village, 벽=build_wall, 지형=fill_region, 소품=place_props. "
    + "rows/parts/placementText/growth/cellHints는 사람이 등록한 내용의 조회 표면일 뿐이다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "선택. 지정 시 이 맵의 타일셋 킷만" },
    },
  },
  run(project, args): ToolExecResult {
    const entries: {
      kitId: string;
      name: string;
      tilesetId: string;
      kind: StructureKitDef["kind"];
      width: number;
      height: number;
      learnedFrom: string;
      /** 사람이 가르친 어휘 메타 — AI 가 "언제 쓸지"를 판단하는 유일한 근거. */
      ai?: StructureKitAiMeta;
      /** 가로로 이어 찍어도 되는지. false 면 repeat 인자가 무시된다. */
      repeatable: boolean;
      /**
       * 어느 축으로 무한히 이어 붙여도 되는지. repeatable 은 x 하나만 말할 수 있어서
       * 「세로로만 쌓는 벽」을 표현하지 못했다 — stamp_structure_kit 의 repeat/repeatY 가 이 값을 본다.
       */
      growth: { x: boolean; y: boolean };
      /** 홈 레이어(사람이 선언했으면 그 값, 아니면 행렬에서 유도). */
      layerHome: "lower" | "upper" | "perCell";
      /** 칸별 힌트 — 「이 칸은 세로로 증분 가능」처럼 사람이 칸 하나에 적은 것. */
      cellHints?: StructureKitCellHint[];
      /**
       * 배치 조건을 사람 말로 — ai.placement 원본만 주면 zone/facing 코드를 모델이 다시
       * 해석해야 한다. 거부 문장과 같은 어휘를 쓰게 해 "왜 막혔는지"가 한 어휘로 이어진다.
       */
      placementText?: string[];
      parts?: StructureKitPart[];
      rows?: { tiles: number[]; upperTiles?: number[] }[];
      house?: { houseKitId: string; wings: { x: number; y: number; w: number; h: number }[] };
    }[] = [];
    for (const tileset of tilesetsInScope(project, args.mapId)) {
      for (const kit of availableKits(tileset)) {
        const size = structureKitSize(kit);
        entries.push({
          kitId: kit.id,
          name: kit.name ?? "패턴 스탬프",
          tilesetId: tileset.id,
          kind: kit.kind,
          width: size.width,
          height: size.height,
          learnedFrom: kit.learnedFrom,
          repeatable: structureKitRepeatable(kit),
          growth: structureKitGrowthAxes(kit),
          layerHome: structureKitLayerHome(kit),
          ...(kit.kind === "section" && kit.cellHints && kit.cellHints.length > 0
            ? { cellHints: kit.cellHints.map((hint) => ({ ...hint })) }
            : {}),
          ...(kit.ai ? { ai: { ...kit.ai, ...(kit.ai.tags ? { tags: [...kit.ai.tags] } : {}) } } : {}),
          ...(kit.ai?.placement && kit.ai.placement.length > 0
            ? {
                placementText: kit.ai.placement.map(
                  (condition) => `${condition.strength === "hard" ? "필수" : "권장"} — ${describePlacementSurface(condition)}`
                ),
              }
            : {}),
          ...(kit.parts && kit.parts.length > 0 ? { parts: kit.parts.map((part) => ({ ...part })) } : {}),
          ...(kit.kind === "section"
            ? {
                rows: kit.rows.map((row) => ({
                  tiles: [...row.tiles],
                  ...(row.upperTiles ? { upperTiles: [...row.upperTiles] } : {}),
                })),
              }
            : {
                house: { houseKitId: kit.houseKitId, wings: kit.wings.map((wing) => ({ ...wing })) },
              }),
        });
      }
    }
    return {
      summary:
        entries.length === 0
          ? "등록된 구조 킷이 없습니다. 유저가 맵에 패턴을 반복해 찍고 제안 카드에서 [등록]하면 생깁니다."
          : `구조 킷 ${entries.length}개: ${entries.map((entry) => `${entry.name}(${entry.kitId}, ${entry.width}x${entry.height}, ${entry.repeatable ? "반복" : "한 채 완결"})`).join(", ")}`,
      data: { kits: entries },
    };
  },
};

/** AI 가 stamp_structure_kit 을 부르면 돌려주는 거절 문장. 테스트·프롬프트가 같은 문구를 본다. */
export const STAMP_STRUCTURE_KIT_BLOCKED =
  "구조물 스탬프(stamp_structure_kit)는 사람 팔레트 전용입니다. 타일 시공에 쓰지 마세요. "
  + "집=author_house, 마을=author_village, 벽=build_wall, 지형=fill_region, 소품=place_props.";

const stampStructureKit: ToolDefinition = {
  name: "stamp_structure_kit",
  description:
    "AI 시공 금지. 구조물 스탬프는 사람 팔레트 전용이다. "
    + "집=author_house, 마을=author_village, 벽=build_wall, 지형=fill_region, 소품=place_props.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kitId: { type: "string", description: "쓰지 말 것 — 이 도구는 거부된다" },
      kitName: { type: "string" },
      origin: { ...COORD_SCHEMA, description: "{x,y}" },
      repeat: { type: "integer" },
      repeatY: { type: "integer" },
    },
    required: ["mapId", "origin"],
  },
  invalidArgsExample: { mapId: "map_blank_start", kitId: "kit_...", origin: { x: 3, y: 4 } },
  run(_draft, _args): ToolExecResult {
    throw new ToolError(STAMP_STRUCTURE_KIT_BLOCKED, { code: "stamp-blocked" });
  },
};

/** 사람 팔레트·계약 테스트용 시공 엔진. AI 툴 run() 은 이 함수를 부르지 않는다. */
export function applyStampStructureKit(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    const kit = resolveKit(tileset, args);
    const origin = originArg(args);
    // 증분 축이 시공 반복을 지배한다. 집 킷·우물처럼 한 채로 완결인 것은 두 축 모두 1회다.
    // 사람이 적지 않은 축으로는 절대 늘리지 않는다 — 조용히 3채가 생기는 쪽이 1채보다 나쁘다.
    const axes = structureKitGrowthAxes(kit);
    const requestedX = repeatArg(args, "repeat", 3);
    const requestedY = repeatArg(args, "repeatY", 1);
    const repeat = axes.x ? requestedX : 1;
    const repeatY = axes.y ? requestedY : 1;
    // 조인 사실은 결과 문장에 남긴다. 말없이 조이면 모델은 세로로 쌓았다고 믿고 다음 층을 그 위에 얹는다.
    const clampNotes = [
      axes.x || requestedX === 1 ? "" : `가로 ${requestedX}회 요청 → 1회(가로 증분 불가)`,
      axes.y || requestedY === 1 ? "" : `세로 ${requestedY}회 요청 → 1회(세로 증분 불가)`,
    ].filter(Boolean);
    const size = structureKitSize(kit);
    const totalWidth = size.width * repeat;
    const totalHeight = size.height * repeatY;
    if (
      origin.x < 0 || origin.y < 0
      || origin.x + totalWidth > map.width
      || origin.y + totalHeight > map.height
    ) {
      throw new ToolError(
        `킷 '${kit.name ?? kit.id}'(${size.width}x${size.height})×가로${repeat}·세로${repeatY}회가 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y },
      );
    }

    /** 반복 격자의 단위 사각 목록. 배치 조건 검사와 실제 시공이 **같은 목록**을 봐야 한다. */
    const unitRects: { x: number; y: number; w: number; h: number }[] = [];
    for (let row = 0; row < repeatY; row += 1) {
      for (let column = 0; column < repeat; column += 1) {
        unitRects.push({
          x: origin.x + column * size.width,
          y: origin.y + row * size.height,
          w: size.width,
          h: size.height,
        });
      }
    }
    // 배치 조건(kit.ai.placement) 검사 — **한 칸도 쓰기 전에** 전 반복을 먼저 본다.
    // 중간에 던지면 앞의 반복은 이미 찍혀 있어 드래프트가 반쯤 시공된 상태로 남는다.
    // 조건이 없는 킷(대부분)은 아래 루프가 그냥 돌지 않는다.
    const surfaceWarnings: string[] = [];
    if ((kit.ai?.placement ?? []).length > 0) {
      const probe = mapSurfaceProbe(draft, map);
      for (const rect of unitRects) {
        const verdict = evaluatePlacementConditions({ conditions: kit.ai?.placement, probe, rect });
        if (verdict.blocked.length > 0) {
          throw new ToolError(
            `킷 '${kit.name ?? kit.id}'의 배치 조건에 맞지 않는 자리입니다 — (${rect.x},${rect.y}): `
            + verdict.blocked.map((failure) => failure.text).join(" / ")
            + " · 조건은 데이터베이스 → 구조물 → [편집] → AI 메타 탭의 «배치 조건»에서 고칩니다.",
            { code: "placement-condition", mapId: map.id, x: rect.x, y: rect.y },
          );
        }
        for (const warning of verdict.warnings) surfaceWarnings.push(`(${rect.x},${rect.y}) ${warning.text}`);
      }
    }

    // 반복마다 배치를 따로 기록한다 — 하나로 뭉치면 "가운데 집만 지워줘"가 불가능해진다.
    // before 는 시공 전에 뜨고, afterHash 는 시공 직후 드래프트 맵을 되읽어 계산한다(킷 정의 아님).
    let painted = 0;
    const placementIds: string[] = [];
    for (const rect of unitRects) {
      const before = captureStructureTiles(map, rect);
      painted += stampKitCells(map, kit, { x: rect.x, y: rect.y }, 1);
      placementIds.push(appendStructurePlacement(map, { kitId: kit.id, rect, before }).id);
    }
    const parts = absoluteKitParts(kit, origin);
    return {
      summary: `${map.name}에 구조 킷 '${kit.name ?? kit.id}' 시공 — (${origin.x},${origin.y})부터 ${size.width}x${size.height} ${kit.kind === "house" ? "집 킷" : "단면"} ×가로${repeat}·세로${repeatY}회, ${painted}칸`
        + (clampNotes.length > 0 ? ` · 증분 축 제한: ${clampNotes.join(", ")}` : "")
        + (surfaceWarnings.length > 0 ? ` · 배치 조건 권장 위반: ${surfaceWarnings.join(", ")}` : ""),
      data: {
        kitId: kit.id,
        origin,
        repeat,
        repeatY,
        growth: axes,
        ...(clampNotes.length > 0 ? { repeatClamped: clampNotes } : {}),
        height: totalHeight,
        width: totalWidth,
        painted,
        placementIds,
        ...(parts.length > 0 ? { parts } : {}),
      },
    };
}

/** 부위 상대좌표 → 시공 절대좌표. 타일과 달리 부위는 한 킷 당 한 번만 — origin에 고정된 힌트다.
 * 입구의 워프 칸은 y + h - 1 행(규약) — 이 툴은 이벤트를 만들지 않고 좌표만 돌려준다. */
function absoluteKitParts(
  kit: StructureKitDef,
  origin: Point,
): (Omit<StructureKitPart, "dx" | "dy"> & { x: number; y: number })[] {
  return (kit.parts ?? []).map((part) => ({
    id: part.id,
    kind: part.kind,
    x: origin.x + part.dx,
    y: origin.y + part.dy,
    w: part.w,
    h: part.h,
    ...(part.note === undefined ? {} : { note: part.note }),
  }));
}

/** 팔레트 스탬프(applyPaletteStamp)와 동일 규약: 비어 있지 않은 칸만 쓴다(고른 그대로, 성형 없음).
 * 셀 목록은 구조 킷 모델이 전개(section=행렬, house=정본 houseKit 시공). */
function stampKitCells(map: GameMap, kit: StructureKitDef, origin: Point, repeat: number): number {
  const cells = structureKitUnitCells(kit);
  const size = structureKitSize(kit);
  let painted = 0;
  for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
    for (const cell of cells) {
      const x = origin.x + repeatIndex * size.width + cell.dx;
      const y = origin.y + cell.dy;
      const index = y * map.width + x;
      if (cell.layer === "lower") map.lowerTiles[index] = cell.tile;
      else map.upperTiles[index] = cell.tile;
      painted += 1;
    }
  }
  return painted;
}

function tilesetsInScope(project: Project, mapId: unknown): readonly TilesetDef[] {
  if (typeof mapId === "string" && mapId.length > 0) {
    const map = project.maps[mapId];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    const tileset = project.tilesets[map.tilesetId];
    return tileset ? [tileset] : [];
  }
  return Object.values(project.tilesets);
}

function resolveKit(tileset: TilesetDef | undefined, args: Record<string, unknown>): StructureKitDef {
  const kits = availableKits(tileset);
  if (kits.length === 0) {
    throw new ToolError(
      "이 맵의 타일셋에 등록된 구조 킷이 없습니다. list_structure_kits로 확인하세요.",
      { code: "kit-not-found" },
    );
  }
  const kitId = typeof args.kitId === "string" ? args.kitId.trim() : "";
  if (kitId) {
    const byId = kits.find((kit) => kit.id === kitId);
    if (!byId) {
      throw new ToolError(
        `구조 킷을 찾을 수 없습니다: ${kitId}. 보유: ${kits.map((kit) => kit.id).join(", ")}`,
        { code: "kit-not-found" },
      );
    }
    return byId;
  }
  const kitName = typeof args.kitName === "string" ? args.kitName.trim().toLowerCase() : "";
  if (kitName) {
    const byName = kits.find((kit) => (kit.name ?? "").toLowerCase().includes(kitName));
    if (!byName) {
      throw new ToolError(
        `이름이 '${args.kitName as string}'인 구조 킷이 없습니다. 보유: ${kits.map((kit) => `${kit.name ?? "?"}(${kit.id})`).join(", ")}`,
        { code: "kit-not-found" },
      );
    }
    return byName;
  }
  if (kits.length === 1) return kits[0]!;
  throw new ToolError(
    `킷이 ${kits.length}개라 kitId 또는 kitName이 필요합니다: ${kits.map((kit) => `${kit.name ?? "?"}(${kit.id})`).join(", ")}`,
    { code: "invalid-args" },
  );
}

function originArg(args: Record<string, unknown>): Point {
  const origin = args.origin as Point | undefined;
  if (!origin || !Number.isInteger(origin.x) || !Number.isInteger(origin.y)) {
    throw new ToolError("origin은 {x,y} 정수 좌표여야 합니다.", { code: "invalid-args" });
  }
  return origin;
}

function repeatArg(args: Record<string, unknown>, key: "repeat" | "repeatY", fallback: number): number {
  const raw = args[key];
  if (raw === undefined) return fallback;
  const repeat = raw as number;
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 50) {
    throw new ToolError(`${key}는 1~50 정수여야 합니다: ${String(raw)}`, { code: "invalid-args" });
  }
  return repeat;
}

const registerStructureKitTool: ToolDefinition = {
  name: "register_structure_kit",
  description: "구조 킷 등록: 맵 영역의 하위/상위 타일을 타일셋 structureKits에 학습 스탬프로 저장한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kitId: { type: "string" },
      name: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      width: { type: "integer" },
      height: { type: "integer" },
    },
    required: ["mapId", "kitId", "x", "y", "width", "height"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const kitId = typeof args.kitId === "string" ? args.kitId.trim() : "";
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : kitId;
    const x = args.x as number;
    const y = args.y as number;
    const width = args.width as number;
    const height = args.height as number;
    if (!kitId) throw new ToolError("kitId가 필요합니다.", { code: "invalid-args" });
    if (![x, y, width, height].every((value) => Number.isInteger(value)) || width < 1 || height < 1) {
      throw new ToolError("영역은 양의 정수여야 합니다.", { code: "invalid-args", mapId: map.id });
    }
    if (x < 0 || y < 0 || x + width > map.width || y + height > map.height) {
      throw new ToolError("영역이 맵 밖입니다.", { code: "out-of-bounds", mapId: map.id });
    }
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`타일셋 없음: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
    const rows = Array.from({ length: height }, (_, row) => {
      const tiles: number[] = [];
      const upperTiles: number[] = [];
      for (let col = 0; col < width; col += 1) {
        const index = (y + row) * map.width + (x + col);
        tiles.push(map.lowerTiles[index] ?? TILE.EMPTY);
        upperTiles.push(map.upperTiles[index] ?? TILE.EMPTY);
      }
      return { tiles, upperTiles };
    });
    const kit: StructureKitDef = {
      id: kitId,
      name,
      kind: "section",
      width,
      height,
      learnedFrom: "user-paint",
      rows,
    };
    const existing = tileset.structureKits ?? [];
    tileset.structureKits = [...existing.filter((entry) => entry.id !== kitId), kit];
    return { summary: `구조 킷 ${name} 등록`, data: { kitId, tilesetId: tileset.id, width, height } };
  },
};

export const STRUCTURE_KIT_TOOLS: readonly ToolDefinition[] = [listStructureKits, stampStructureKit, registerStructureKitTool];
