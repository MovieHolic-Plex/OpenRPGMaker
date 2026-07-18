// editor/tools/houseKitTools.ts
// 집 키트를 에이전트 채팅에 노출하는 AI 툴.
// 타일 선택은 전부 결정론 스크립트(houseKit)가 하고, LLM은 평면(날개 사각형)·키트만 설계한다.
// 정본 명세: docs/knowledge/images/2026-07-08-house-harness-design.png

import type { FootprintWing, HouseKitWindowsOption } from "@/editor/houseKit";
import type { Project } from "@/project/types";
import {
  buildHouseKit,
  isPublicHouseKitId,
  PUBLIC_HOUSE_KIT_IDS,
  type BuildHouseKitInput,
} from "./houseKitDomain";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

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
      "집 키트로 집을 짓는다(권장 정공법). 건물 = 날개 사각형(wings)들의 합집합 — " +
      "직사각·ㄱ/ㄴ/ㄷ/ㅁ/O자 등 임의 평면 가능. 벽 3행(상·중·하 나인슬라이스)과 지붕 3단, " +
      "상위 레이어 마감(대각/용마루/트림)은 스크립트가 자동으로 정확히 깐다 — 타일 ID를 직접 고르지 말 것. " +
      "키트: blue-stone|bright-plaster|amber-wood|slate-wood|timber-hall|aframe-stone. " +
      "목록에 없는 재질(초가 등)을 요청받으면 지어내지 말고 '아직 학습되지 않은 재질'이라고 답할 것. " +
      "제약: 날개 폭 ≥3, 각 열 구간 높이 ≥5(벽3+지붕2). 문은 남쪽 외벽 중앙에 자동 배치된다. " +
      "창문은 기본 활성으로 각 벽 중단 행에 1칸 인셋 후 spacing+1 간격으로 상위 레이어에 배치하며 문 열±1은 비운다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id" },
        kitId: { type: "string", enum: PUBLIC_HOUSE_KIT_IDS, description: "재질 키트" },
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
        doorEvent: { type: "boolean", description: "Object1 문 이벤트와 열림 모션 생성(기본 true, interior:false면 비활성)" },
        interior: { type: "boolean", description: "집 내부 맵 자동 생성(기본 true). false면 내부/문 이벤트 없이 외장만 만든다." },
        ownerName: { type: "string", description: "내부 맵 이름에 쓸 집주인 이름(기본: 대상 맵 이름)" },
        windows: {
          type: "object",
          description: "창문 자동 배치 옵션(기본: 켜짐). {enabled:false}로 끄고, {spacing:N}으로 창문 사이 벽 칸 수 지정(기본 2). boolean 도 하위 호환으로 수용.",
          properties: {
            enabled: { type: "boolean", description: "창문 배치 여부(기본 true)" },
            spacing: { type: "integer", description: "창문 사이 벽 칸 수(기본 2)" },
          },
        },
      },
      required: ["mapId", "kitId", "wings"],
    },
    invalidArgsExample: EXAMPLE,
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      return buildHouseKit(draft, parseBuildHouseKitInput(args));
    },
  },
];

function parseBuildHouseKitInput(args: Record<string, unknown>): BuildHouseKitInput {
  if (typeof args.mapId !== "string" || args.mapId.length === 0) {
    throw new ToolError("mapId는 비어 있지 않은 문자열이어야 합니다.", { code: "invalid-args" });
  }
  const mapId = args.mapId;
  if (!isPublicHouseKitId(args.kitId)) {
    throw new ToolError(`kitId는 ${PUBLIC_HOUSE_KIT_IDS.join("|")} 중 하나여야 합니다.`, { code: "invalid-args", mapId });
  }
  const windows = coerceWindows(args.windows);
  return {
    mapId,
    kitId: args.kitId,
    wings: coerceWings(args.wings),
    door: args.door !== false,
    doorEvent: args.doorEvent !== false,
    interior: args.interior !== false,
    ...(typeof args.ownerName === "string" ? { ownerName: args.ownerName } : {}),
    ...(windows === undefined ? {} : { windows }),
  };
}

function coerceWings(value: unknown): readonly FootprintWing[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolError(`wings는 1개 이상의 사각형 배열이어야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new ToolError(`wings[${index}]는 객체여야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
    }
    return {
      x: requireInteger(entry.x, `wings[${index}].x`),
      y: requireInteger(entry.y, `wings[${index}].y`),
      w: requireInteger(entry.w, `wings[${index}].w`),
      h: requireInteger(entry.h, `wings[${index}].h`),
    };
  });
}

function coerceWindows(value: unknown): HouseKitWindowsOption | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return false;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("windows는 boolean 또는 {enabled?, spacing?} 객체여야 합니다.", { code: "invalid-args" });
  }
  if (!isRecord(value)) {
    throw new ToolError("windows는 boolean 또는 {enabled?, spacing?} 객체여야 합니다.", { code: "invalid-args" });
  }
  if (value.enabled === false) return false;
  const spacing = value.spacing;
  if (spacing === undefined) return {};
  if (typeof spacing !== "number" || !Number.isInteger(spacing) || spacing < 0) {
    throw new ToolError("windows.spacing은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return { spacing };
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw new ToolError(`${field}는 정수여야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
