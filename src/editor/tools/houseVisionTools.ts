// editor/tools/houseVisionTools.ts
// look_at_houses — 깔아 놓은 집을 "눈으로" 보는 비전 툴.
//
// show_map_region 은 타일만 보여 준다. 모델이 "이 집들이 서로 다른가"를 판단하려면
// 모양·킷·지붕색을 세어 줘야 한다(2026-08-31: author_house 가 같은 사각형만 깔던 결함).
// 이 툴은 ① 픽셀 이미지(assistantSession VISION_TOOLS → toolImageRenderer)와
// ② 모양/킷 집계 리포트를 한 번에 준다. 집을 깐 뒤 반드시 이걸로 확인하게 프롬프트가 요구한다.

import type { GameMap } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import {
  detectHouses,
  houseVarietyReport,
  houseVarietySummary,
  shapeLabel,
  type DetectedHouse,
  type HouseRect,
} from "./houseVariety";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

/** 이미지 한 변 상한 — show_map_region 과 같은 규약(토큰·base64 폭주 방지). */
const LOOK_AT_MAX_SPAN = 24;

const lookAtHouses: ToolDefinition = {
  name: "look_at_houses",
  description:
    "맵에 실제로 서 있는 집을 타일에서 되읽어 이미지로 보여주고, 모양(templateId)·킷·지붕색 분포를 집계한다. "
    + "집을 깐 직후 반드시 호출해 같은 모양이 반복됐는지 눈으로 확인하라 — verdict 가 monotonous/mixed 면 "
    + "advice 의 안 쓴 templateId 를 골라 다시 깔아라. 영역(x,y,w,h)을 생략하면 맵 전체를 센다.",
  mode: "read",
  domains: ["tile", "map"],
  invalidArgsExample: { mapId: "map_1" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer", description: "선택. 셀 영역 좌상단 열" },
      y: { type: "integer", description: "선택. 셀 영역 좌상단 행" },
      w: { type: "integer", description: "선택. 영역 폭" },
      h: { type: "integer", description: "선택. 영역 높이" },
    },
    required: ["mapId"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, stringArg(args, "mapId"));
    const bounds = optionalBounds(args);
    const houses = detectHouses(map, bounds);
    const report = houseVarietyReport(houses);
    const view = viewportFor(map, houses, bounds);
    const grid = tileGrid(map, view);
    const warnings = report.verdict === "diverse" ? [] : [`${houseVarietySummary(report)} — ${report.advice.join(" ")}`];
    return {
      summary: `${map.name} 집 관찰: ${houseVarietySummary(report)}`,
      ...(warnings.length === 0 ? {} : { warnings }),
      data: {
        mapId: map.id,
        bounds: bounds ?? { x: 0, y: 0, w: map.width, h: map.height },
        houses: houses.map(describeHouse),
        variety: report,
        // 비전 렌더러(toolImageRenderer)용 타일 그리드 — compactToolDataForModel 이 배열은 떼고
        // variety/houses 만 모델에 남긴다(이미지는 별도 user 메시지로 주입).
        x: view.x,
        y: view.y,
        w: view.w,
        h: view.h,
        lower: grid.lower,
        upper: grid.upper,
      },
    };
  },
};

export const HOUSE_VISION_TOOLS: readonly ToolDefinition[] = [lookAtHouses];

function describeHouse(house: DetectedHouse): Record<string, unknown> {
  return {
    index: house.index,
    shape: shapeLabel(house),
    templateId: house.templateId,
    kitId: house.kitId,
    roofColor: house.roofColor,
    bbox: house.bbox,
    doorAt: house.doorAt,
    chimney: house.chimney,
    roofDeck: house.roofDeck,
    // 벽 밴드 행 수 — 낮은벽 2, 1층 3, 2층 5, 3층 7. "층수를 흔들었는지"를 눈으로 세는 축.
    wallRows: house.wallRows,
  };
}

/** 집이 다 들어오도록 시야를 잡되 한 변 상한을 넘기면 집 중심으로 자른다. */
function viewportFor(map: GameMap, houses: readonly DetectedHouse[], bounds: HouseRect | undefined): HouseRect {
  const base = bounds ?? housesEnvelope(houses) ?? { x: 0, y: 0, w: map.width, h: map.height };
  const w = Math.min(LOOK_AT_MAX_SPAN, Math.max(1, Math.min(map.width, base.w)));
  const h = Math.min(LOOK_AT_MAX_SPAN, Math.max(1, Math.min(map.height, base.h)));
  const cx = base.x + Math.floor(base.w / 2);
  const cy = base.y + Math.floor(base.h / 2);
  return {
    x: Math.max(0, Math.min(map.width - w, cx - Math.floor(w / 2))),
    y: Math.max(0, Math.min(map.height - h, cy - Math.floor(h / 2))),
    w,
    h,
  };
}

function housesEnvelope(houses: readonly DetectedHouse[]): HouseRect | undefined {
  if (houses.length === 0) return undefined;
  const minX = Math.min(...houses.map((house) => house.bbox.x));
  const minY = Math.min(...houses.map((house) => house.bbox.y));
  const maxX = Math.max(...houses.map((house) => house.bbox.x + house.bbox.w));
  const maxY = Math.max(...houses.map((house) => house.bbox.y + house.bbox.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function tileGrid(map: GameMap, view: HouseRect): { readonly lower: number[][]; readonly upper: number[][] } {
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let row = 0; row < view.h; row += 1) {
    const lowerRow: number[] = [];
    const upperRow: number[] = [];
    for (let column = 0; column < view.w; column += 1) {
      const index = (view.y + row) * map.width + view.x + column;
      lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
      upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
    }
    lower.push(lowerRow);
    upper.push(upperRow);
  }
  return { lower, upper };
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) throw new ToolError(`${key}가 비어 있습니다.`, { code: "invalid-args" });
  return value;
}

function optionalBounds(args: Record<string, unknown>): HouseRect | undefined {
  const keys = ["x", "y", "w", "h"] as const;
  const given = keys.filter((key) => args[key] !== undefined);
  if (given.length === 0) return undefined;
  if (given.length !== keys.length) {
    throw new ToolError("영역을 지정하려면 x·y·w·h 를 모두 주세요(생략하면 맵 전체).", { code: "invalid-args" });
  }
  const values = keys.map((key) => {
    const value = args[key];
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
    }
    return value;
  });
  return { x: values[0] as number, y: values[1] as number, w: values[2] as number, h: values[3] as number };
}
