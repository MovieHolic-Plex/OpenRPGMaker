// editor/tools/structureKitTools.ts
// 유저 붓질에서 학습·등록된 구조 킷(tileset.structureKits)의 하네스 접점.
// 보이지 않는 하네스 v2 §③ "등록된 킷은 즉시 build_*·팔레트 스탬프에서 사용 가능"의 봇 쪽 절반:
//  - list_structure_kits (read)  — 킷의 존재·정확한 타일 행을 기계가 읽는다.
//  - stamp_structure_kit (write) — 타일 선택은 전부 킷 데이터가 담당, LLM은 위치·반복 횟수만 넘긴다
//    (castleKit/houseKit과 같은 결정론 시공 규약 — LLM이 타일 id를 고르는 경로를 만들지 않는다).

import { builtinHouseStructureKitsFor } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import {
  structureKitRepeatable,
  structureKitSize,
  structureKitUnitCells,
} from "@/editor/harnessSuggestion/structureKitModel";
import { evaluatePlacementConditions, mapSurfaceProbe } from "@/project/placementSurface";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import type {
  GameMap,
  Project,
  StructureKitAiMeta,
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
    "사용자가 붓질로 가르쳐 등록한 구조 킷(내 스탬프) 목록. mapId를 주면 그 맵 타일셋의 킷만. "
    + "각 킷의 rows는 하위/상위 레이어 타일 id 행렬(기계 표면) — 시공은 stamp_structure_kit로. "
    + "parts는 입구·간판·자리 등 부위의 상대좌표(dx,dy) — 절대좌표는 stamp_structure_kit이 돌려준다.",
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
          ...(kit.ai ? { ai: { ...kit.ai, ...(kit.ai.tags ? { tags: [...kit.ai.tags] } : {}) } } : {}),
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

const stampStructureKit: ToolDefinition = {
  name: "stamp_structure_kit",
  description:
    "등록된 구조 킷(내 스탬프)을 맵에 시공한다. 단위 단면(width×height)을 origin 좌상단부터 가로로 repeat회 이어 찍는다. "
    + "타일 선택은 킷 데이터가 전담 — 개별 타일 id를 넘기지 말 것. 킷 목록·크기는 list_structure_kits로 먼저 확인. "
    + "부위가 있는 킷은 parts를 절대좌표(x,y)로 돌려주며 이벤트는 생성하지 않는다 — 워프는 그 좌표로 따로 만든다. "
    + "반복 1회마다 배치 기록(map.structurePlacements)이 하나씩 남아 나중에 그 한 채만 다시 찍거나 지울 수 있다(placementIds).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kitId: { type: "string", description: "list_structure_kits의 kitId. 생략 시 kitName으로 조회" },
      kitName: { type: "string", description: "킷 이름(부분 일치). kitId가 있으면 무시" },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단(단면 첫 열의 첫 행)" },
      repeat: { type: "integer", description: "가로 반복 횟수(기본 3, 1~50)" },
    },
    required: ["mapId", "origin"],
  },
  invalidArgsExample: { mapId: "map_blank_start", kitId: "kit_...", origin: { x: 3, y: 4 }, repeat: 6 },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    const kit = resolveKit(tileset, args);
    const origin = originArg(args);
    // 집 킷은 한 채가 완결 단위 — repeat를 무시하고 1회 시공.
    const repeat = structureKitRepeatable(kit) ? repeatArg(args) : 1;
    const size = structureKitSize(kit);
    const totalWidth = size.width * repeat;
    if (
      origin.x < 0 || origin.y < 0
      || origin.x + totalWidth > map.width
      || origin.y + size.height > map.height
    ) {
      throw new ToolError(
        `킷 '${kit.name ?? kit.id}'(${size.width}x${size.height})×${repeat}회가 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y },
      );
    }
    // 배치 조건(kit.ai.placement) 검사 — **한 칸도 쓰기 전에** 전 반복을 먼저 본다.
    // 중간에 던지면 앞의 반복은 이미 찍혀 있어 드래프트가 반쯤 시공된 상태로 남는다.
    // 조건이 없는 킷(대부분)은 아래 루프가 그냥 돌지 않는다.
    const surfaceWarnings: string[] = [];
    if ((kit.ai?.placement ?? []).length > 0) {
      const probe = mapSurfaceProbe(draft, map);
      for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
        const rect = {
          x: origin.x + repeatIndex * size.width,
          y: origin.y,
          w: size.width,
          h: size.height,
        };
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
    for (let repeatIndex = 0; repeatIndex < repeat; repeatIndex += 1) {
      const unitOrigin = { x: origin.x + repeatIndex * size.width, y: origin.y };
      const rect = { x: unitOrigin.x, y: unitOrigin.y, w: size.width, h: size.height };
      const before = captureStructureTiles(map, rect);
      painted += stampKitCells(map, kit, unitOrigin, 1);
      placementIds.push(appendStructurePlacement(map, { kitId: kit.id, rect, before }).id);
    }
    const parts = absoluteKitParts(kit, origin);
    return {
      summary: `${map.name}에 구조 킷 '${kit.name ?? kit.id}' 시공 — (${origin.x},${origin.y})부터 ${size.width}x${size.height} ${kit.kind === "house" ? "집 킷" : "단면"} ×${repeat}회, ${painted}칸`
        + (surfaceWarnings.length > 0 ? ` · 배치 조건 권장 위반: ${surfaceWarnings.join(", ")}` : ""),
      data: {
        kitId: kit.id,
        origin,
        repeat,
        height: size.height,
        width: totalWidth,
        painted,
        placementIds,
        ...(parts.length > 0 ? { parts } : {}),
      },
    };
  },
};

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

function repeatArg(args: Record<string, unknown>): number {
  if (args.repeat === undefined) return 3;
  const repeat = args.repeat as number;
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 50) {
    throw new ToolError(`repeat는 1~50 정수여야 합니다: ${String(args.repeat)}`, { code: "invalid-args" });
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
