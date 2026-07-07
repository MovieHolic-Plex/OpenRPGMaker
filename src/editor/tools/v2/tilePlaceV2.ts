// editor/tools/v2/tilePlaceV2.ts
// 타일 배치 v2 — paint/road/scatter/structure 4개로 v1 배치 툴 9개를 대체한다.
// 엔진은 v1 run()을 그대로 호출하고, 이 계층은 완전한 스키마·별칭 수용·자가수정용 오류만 담당한다.

import type { Project } from "@/project/types";
import { MAP_TOOLS } from "../mapTools";
import { PLACEMENT_TOOLS } from "../placementTools";
import { TERRAIN_TEMPLATE_TOOLS } from "../terrainTemplateTools";
import type { ToolDefinition, ToolExecResult } from "../types";
import {
  byName, coerceEnum, coerceInt, coercePoint, coercePointArray, compactArgs, failWithExample, optionalEnum,
} from "./tileToolsV2Support";

const v1PaintTiles = byName(MAP_TOOLS, "paint_tiles");
const v1ClearRegion = byName(MAP_TOOLS, "clear_region");
const v1PaintRoad = byName(MAP_TOOLS, "paint_road");
const v1BuildHouse = byName(MAP_TOOLS, "build_house");
const v1StampStructure = byName(MAP_TOOLS, "stamp_structure");
const v1StampTemplateHouse = byName(MAP_TOOLS, "stamp_template_house");
const v1Scatter = byName(PLACEMENT_TOOLS, "scatter_object");
const v1StampTerrainTemplate = byName(TERRAIN_TEMPLATE_TOOLS, "stamp_terrain_template");

const PAINT_EXAMPLE = { mapId: "map_1", mode: "rect", tile: 360, from: { x: 2, y: 3 }, to: { x: 6, y: 5 } };
const ERASE_EXAMPLE = { mapId: "map_1", action: "erase", mode: "rect", from: { x: 2, y: 3 }, to: { x: 6, y: 5 } };
const ROAD_EXAMPLE = { mapId: "map_1", points: [{ x: 0, y: 10 }, { x: 14, y: 12 }, { x: 28, y: 6 }], style: "dirt", naturalness: 0.5 };
const SCATTER_EXAMPLE = { mapId: "map_1", area: { x: 2, y: 2, w: 20, h: 14 }, count: 10, groupId: "conifer_tree", naturalness: 0.6 };
const STRUCTURE_EXAMPLE = { mapId: "map_1", kind: "house", origin: { x: 8, y: 6 }, width: 6, height: 7, material: "wood" };

const tilePaint: ToolDefinition = {
  name: "tile_paint",
  description:
    "타일을 칠하거나 지운다(v2). action=paint(기본)는 tile 필수, action=erase는 tile 불필요. mode: rect(from/to)/line(from/to)/fill(from, lower 전용)/cells(cells 배열). 클러스터 hard 규칙 동반 배치와 통행성 경고는 자동.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      action: { type: "string", enum: ["paint", "erase"], description: "기본 paint" },
      layer: { type: "string", enum: ["lower", "upper"], description: "생략 시 lower(전용 칩은 자동 라우팅)" },
      mode: { type: "string", enum: ["rect", "line", "fill", "cells"] },
      tile: { type: "integer", description: "paint일 때 필수. 타일 인덱스 — 모르면 tile_query로 먼저 조회" },
      from: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      to: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      cells: { type: "array", items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] } },
    },
    required: ["mapId", "mode"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const action = optionalEnum(args.action, ["paint", "erase"] as const, "action", ERASE_EXAMPLE) ?? "paint";
    const mode = coerceEnum(args.mode, ["rect", "line", "fill", "cells"] as const, "mode", PAINT_EXAMPLE);
    if (typeof args.mapId !== "string" || args.mapId.length === 0) failWithExample("mapId(문자열)가 필요합니다", PAINT_EXAMPLE);

    if (action === "erase" && mode === "rect") {
      // 사각형 지우기는 v1 clear_region이 상위 레이어 정리까지 처리한다.
      const from = coercePoint(args.from, "from", ERASE_EXAMPLE);
      const to = coercePoint(args.to, "to", ERASE_EXAMPLE);
      return v1ClearRegion.run(draft, compactArgs({
        mapId: args.mapId,
        x: Math.min(from.x, to.x), y: Math.min(from.y, to.y),
        w: Math.abs(to.x - from.x) + 1, h: Math.abs(to.y - from.y) + 1,
        layer: args.layer,
      }));
    }

    const tile = action === "erase" ? -1 : (args.tile === undefined
      ? failWithExample("action=paint에는 tile(타일 인덱스)이 필요합니다. 모르면 tile_query로 먼저 조회하세요", PAINT_EXAMPLE)
      : coerceInt(args.tile, "tile", PAINT_EXAMPLE));
    if (mode === "rect" || mode === "line") {
      coercePoint(args.from, "from", PAINT_EXAMPLE);
      coercePoint(args.to, "to", PAINT_EXAMPLE);
    } else if (mode === "fill") {
      coercePoint(args.from, "from", PAINT_EXAMPLE);
    } else {
      coercePointArray(args.cells, "cells", { ...PAINT_EXAMPLE, mode: "cells", cells: [{ x: 2, y: 3 }, { x: 3, y: 3 }] });
    }
    return v1PaintTiles.run(draft, compactArgs({
      mapId: args.mapId, layer: args.layer ?? "lower", mode, tile,
      from: args.from, to: args.to, cells: args.cells,
    }));
  },
};

const tileRoad: ToolDefinition = {
  name: "tile_road",
  description:
    "길을 깐다(v2). points 폴리라인(2개 이상)을 잇고 오토타일 셰이핑까지 자동. naturalness 0~1(기본 0.5): 0=반듯한 직선, 0.8+=야생 구불길. 프리셋이 있으면 presetId+paletteRole(path)로 타일을 고른다.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      points: {
        type: "array", description: "경유점 [{x,y},...] 2개 이상 — 서→동, 광장 경유처럼 순서대로",
        items: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      },
      style: { type: "string", enum: ["dirt", "sand"], description: "presetId 없을 때의 길 재질(기본 dirt)" },
      presetId: { type: "string", description: "팔레트 프리셋 id(tile_query ask=palette로 조회)" },
      paletteRole: { type: "string", enum: ["ground", "path", "wall", "water", "decor", "boundary", "roof", "furniture"] },
      naturalness: { type: "number", description: "0~1. 0=직선, 0.5=기본, 0.8+=구불구불" },
      seed: { type: "integer", description: "결정론 시드(생략 가능)" },
    },
    required: ["mapId", "points"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    if (typeof args.mapId !== "string" || args.mapId.length === 0) failWithExample("mapId(문자열)가 필요합니다", ROAD_EXAMPLE);
    const points = coercePointArray(args.points, "points", ROAD_EXAMPLE);
    if (points.length < 2) failWithExample("points는 경유점 2개 이상이어야 합니다", ROAD_EXAMPLE);
    if ((args.presetId === undefined) !== (args.paletteRole === undefined)) {
      failWithExample("presetId와 paletteRole은 함께 지정해야 합니다", { ...ROAD_EXAMPLE, presetId: "pp_forest", paletteRole: "path" });
    }
    return v1PaintRoad.run(draft, compactArgs({
      mapId: args.mapId, points, style: args.style ?? (args.presetId ? undefined : "dirt"),
      presetId: args.presetId, paletteRole: args.paletteRole, naturalness: args.naturalness, seed: args.seed,
    }));
  },
};

const tileScatter: ToolDefinition = {
  name: "tile_scatter",
  description:
    "타일 그룹/프리셋 오브젝트를 area 안에 자연 산포한다(v2). groupId 또는 presetId+paletteRole 중 하나 필수. 풋프린트 원자 배치·보호셀 회피·클러스터 hard 규칙 자동. naturalness: <0.3 균일, 0.3~0.7 포아송, >0.7 군락.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: {
        type: "object", description: "산포 영역(맵 좌표)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
        required: ["x", "y", "w", "h"],
      },
      count: { type: "integer", description: "배치 개수(풋프린트 인스턴스 기준)" },
      groupId: { type: "string", description: "타일 그룹 id(예: conifer_tree). tile_query ask=usage/tile_info로 조회 가능" },
      presetId: { type: "string" },
      paletteRole: { type: "string", enum: ["ground", "path", "wall", "water", "decor", "boundary", "roof", "furniture"] },
      minGap: { type: "integer", description: "오브젝트 간 최소 간격(기본 1)" },
      naturalness: { type: "number", description: "0~1(기본 0.5)" },
      seed: { type: "integer" },
    },
    required: ["mapId", "area", "count"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    if (typeof args.mapId !== "string" || args.mapId.length === 0) failWithExample("mapId(문자열)가 필요합니다", SCATTER_EXAMPLE);
    if (typeof args.area !== "object" || args.area === null) failWithExample("area({x,y,w,h})가 필요합니다", SCATTER_EXAMPLE);
    const area = args.area as Record<string, unknown>;
    for (const key of ["x", "y", "w", "h"]) coerceInt(area[key], `area.${key}`, SCATTER_EXAMPLE);
    coerceInt(args.count, "count", SCATTER_EXAMPLE);
    const hasGroup = typeof args.groupId === "string" && args.groupId.length > 0;
    const hasPreset = args.presetId !== undefined || args.paletteRole !== undefined;
    if (!hasGroup && !hasPreset) {
      failWithExample("groupId 또는 presetId+paletteRole 중 하나가 필요합니다", SCATTER_EXAMPLE);
    }
    if (hasPreset && (args.presetId === undefined || args.paletteRole === undefined)) {
      failWithExample("presetId와 paletteRole은 함께 지정해야 합니다", { ...SCATTER_EXAMPLE, groupId: undefined, presetId: "pp_forest", paletteRole: "decor" });
    }
    return v1Scatter.run(draft, compactArgs({
      mapId: args.mapId, area: args.area, count: args.count, groupId: args.groupId,
      presetId: args.presetId, paletteRole: args.paletteRole, minGap: args.minGap,
      naturalness: args.naturalness, seed: args.seed,
    }));
  },
};

const STRUCTURE_KINDS = ["house", "template_house", "structure", "terrain_template"] as const;

const tileStructure: ToolDefinition = {
  name: "tile_structure",
  description:
    "구조물을 짓는다(v2). kind=house(맞춤 집: width/height/material), template_house(기성 집: variant/material), structure(내장 구조물: template 이름), terrain_template(지형 템플릿: templateId). 벽 타일을 직접 칠하지 말고 항상 이 툴을 쓰라.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kind: { type: "string", enum: [...STRUCTURE_KINDS] },
      origin: { type: "object", description: "좌상단 기준점", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] },
      width: { type: "integer", description: "kind=house 필수. 5~30" },
      height: { type: "integer", description: "kind=house 필수. 6~24(지붕 4행 포함)" },
      material: { type: "string", enum: ["plaster", "wood", "stone"], description: "kind=house/template_house: 벽 재질" },
      variant: { type: "string", description: "kind=template_house: 기성 변형 이름" },
      template: { type: "string", description: "kind=structure: 내장 구조물 이름" },
      templateId: { type: "string", description: "kind=terrain_template: 템플릿 id(tile_query ask=terrain_templates로 조회)" },
      includeFence: { type: "boolean" },
      naturalness: { type: "number", description: "0~1 위치 지터(기본 0.5)" },
      seed: { type: "integer" },
      presetId: { type: "string" },
      paletteRole: { type: "string", enum: ["ground", "path", "wall", "water", "decor", "boundary", "roof", "furniture"] },
    },
    required: ["mapId", "kind", "origin"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    if (typeof args.mapId !== "string" || args.mapId.length === 0) failWithExample("mapId(문자열)가 필요합니다", STRUCTURE_EXAMPLE);
    const kind = coerceEnum(args.kind, STRUCTURE_KINDS, "kind", STRUCTURE_EXAMPLE);
    coercePoint(args.origin, "origin", STRUCTURE_EXAMPLE);
    const base = { mapId: args.mapId, origin: args.origin, naturalness: args.naturalness, seed: args.seed, presetId: args.presetId, paletteRole: args.paletteRole };
    if (kind === "house") {
      if (args.width === undefined || args.height === undefined || typeof args.material !== "string") {
        failWithExample("kind=house는 width/height/material이 필요합니다", STRUCTURE_EXAMPLE);
      }
      return v1BuildHouse.run(draft, compactArgs({ ...base, width: args.width, height: args.height, material: args.material }));
    }
    if (kind === "template_house") {
      if (typeof args.variant !== "string" || typeof args.material !== "string") {
        failWithExample("kind=template_house는 variant/material이 필요합니다", { mapId: "map_1", kind: "template_house", origin: { x: 8, y: 6 }, variant: "small_a", material: "wood" });
      }
      return v1StampTemplateHouse.run(draft, compactArgs({ mapId: args.mapId, origin: args.origin, variant: args.variant, material: args.material, includeFence: args.includeFence }));
    }
    if (kind === "structure") {
      if (typeof args.template !== "string") {
        failWithExample("kind=structure는 template(구조물 이름)이 필요합니다", { mapId: "map_1", kind: "structure", origin: { x: 10, y: 8 }, template: "well" });
      }
      return v1StampStructure.run(draft, compactArgs({ ...base, template: args.template }));
    }
    if (typeof args.templateId !== "string") {
      failWithExample("kind=terrain_template는 templateId가 필요합니다. tile_query ask=terrain_templates로 목록을 조회하세요", { mapId: "map_1", kind: "terrain_template", origin: { x: 0, y: 0 }, templateId: "tt_village_core" });
    }
    return v1StampTerrainTemplate.run(draft, compactArgs({ mapId: args.mapId, templateId: args.templateId, origin: args.origin, material: args.material, includeFence: args.includeFence }));
  },
};

export const TILE_PLACE_TOOLS_V2: readonly ToolDefinition[] = [tilePaint, tileRoad, tileScatter, tileStructure];
