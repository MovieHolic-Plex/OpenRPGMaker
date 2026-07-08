// editor/tools/houseKitTools.ts
// 하네싱 집 키트를 에이전트 채팅에 노출하는 AI 툴.
// 타일 선택은 전부 결정론 스크립트(houseKit)가 하고, LLM은 평면(날개 사각형)·키트만 설계한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png

import { HOUSE_KITS, stampFootprintHouseKit, type FootprintWing, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import type { Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;

const EXAMPLE = {
  mapId: "map_1",
  kitId: "blue-stone",
  wings: [
    { x: 4, y: 3, w: 12, h: 7 },
    { x: 11, y: 3, w: 5, h: 11 },
  ],
};

export const HOUSE_KIT_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_house_kit",
    description:
      "하네싱 집 키트로 집을 짓는다(권장 정공법). 건물 = 날개 사각형(wings)들의 합집합 — " +
      "직사각·ㄱ/ㄴ/ㄷ/ㅁ/O자 등 임의 평면 가능. 벽 3행(상·중·하 나인슬라이스)과 지붕 3단, " +
      "상위 레이어 마감(대각/용마루/트림)은 스크립트가 자동으로 정확히 깐다 — 타일 ID를 직접 고르지 말 것. " +
      "키트: blue-stone(파랑 지붕+석벽) | bright-plaster(밝은 오렌지 지붕+흰 회벽). " +
      "이 두 키트에 없는 재질(통나무·초가 등)을 요청받으면 지어내지 말고 '아직 학습되지 않은 재질'이라고 답할 것. " +
      "제약: 날개 폭 ≥3, 각 열 구간 높이 ≥5(벽3+지붕2). 문은 남쪽 외벽 중앙에 자동 배치된다. " +
      "창문은 기본 활성으로 각 벽 중단 행에 1칸 인셋 후 spacing+1 간격으로 상위 레이어에 배치하며 문 열±1은 비운다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id" },
        kitId: { type: "string", enum: Object.keys(HOUSE_KITS), description: "재질 키트" },
        wings: {
          type: "array",
          description: "건물 질량을 이루는 날개 사각형 목록(타일 좌표, 벽+지붕 포함 전체 외곽)",
          items: {
            type: "object",
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
              w: { type: "integer", description: "폭(≥3)" },
              h: { type: "integer", description: "높이(≥5 권장 — 벽3+지붕2)" },
            },
            required: ["x", "y", "w", "h"],
          },
        },
        door: { type: "boolean", description: "남쪽 외벽 중앙에 문 자동 배치(기본 true)" },
        windows: {
          type: ["boolean", "object"],
          description: "창문 자동 배치(기본 true). false면 끄고, {spacing}이면 창문 사이 벽 칸 수를 지정(기본 2)",
          properties: { spacing: { type: "integer", description: "창문 사이 벽 칸 수(기본 2)" } },
        },
      },
      required: ["mapId", "kitId", "wings"],
    },
    invalidArgsExample: EXAMPLE,
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      const mapId = args.mapId as string;
      const map = draft.maps[mapId];
      if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "missing-map", mapId });
      const kitId = args.kitId as HouseKitId;
      if (!HOUSE_KITS[kitId]) {
        throw new ToolError(
          `알 수 없는 키트: ${String(args.kitId)} — 사용 가능: ${Object.keys(HOUSE_KITS).join(", ")}`,
          { code: "unknown-kit", mapId }
        );
      }
      const wings = coerceWings(args.wings);
      const windows = coerceWindows(args.windows);
      const result = stampFootprintHouseKit(map, { kitId, wings, windows });
      if (!result.ok) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId });
      let doorNote = "문 없음";
      if (args.door !== false && result.doorAt) {
        const { x, y } = result.doorAt;
        map.lowerTiles[(y - 1) * map.width + x] = DOOR_TOP_TILE;
        map.lowerTiles[y * map.width + x] = DOOR_BOTTOM_TILE;
        doorNote = `문 (${x},${y})`;
      }
      const kit = HOUSE_KITS[kitId];
      const windowNote = windows === false ? "창문 없음" : "창문 자동";
      return {
        summary: `${map.name}에 '${kit.name}' 집 시공 — 날개 ${wings.length}개, ${doorNote}, ${windowNote}. 하네싱 규칙 적용 완료.`,
        data: { doorAt: result.doorAt ?? null, kitId, wings },
      };
    },
  },
];

function coerceWings(value: unknown): FootprintWing[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolError(`wings는 1개 이상의 사각형 배열이어야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    const wing = entry as Record<string, unknown>;
    for (const field of ["x", "y", "w", "h"] as const) {
      if (typeof wing[field] !== "number" || !Number.isInteger(wing[field])) {
        throw new ToolError(`wings[${index}].${field}는 정수여야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
      }
    }
    return { x: wing.x as number, y: wing.y as number, w: wing.w as number, h: wing.h as number };
  });
}

function coerceWindows(value: unknown): HouseKitWindowsOption | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return false;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("windows는 boolean 또는 {spacing} 객체여야 합니다.", { code: "invalid-args" });
  }
  const spacing = (value as Record<string, unknown>).spacing;
  if (spacing === undefined) return {};
  if (typeof spacing !== "number" || !Number.isInteger(spacing) || spacing < 0) {
    throw new ToolError("windows.spacing은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return { spacing };
}
