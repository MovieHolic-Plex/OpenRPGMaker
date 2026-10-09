// ai/session/buildSpecGate.ts
// 밑그림(build spec) 게이트의 순수 판정.
//
// ── 스펙 게이트(2026-07-05, '모호도' 대체) ────────────────────────
// 자기 신고 수치([모호도 N%]) 대신 코드가 검증하는 밑그림(명세)을 쓴다:
// 공간 쓰기 툴은 set_build_spec으로 제출되어 결정적으로 검증(경계/겹침)된 명세를 기준으로 실행된다.
// 명세 밖 빈 영역은 자동 확장 warning으로 통과하고, 기존 구조물 파괴 위험만 차단한다.
// 사용자가 맵에서 선택한 영역은 암묵적 명세. 검증 3회 실패 시 그 계획은 폐기하고 새 명세로 재계획하게 한다.

import type { ToolResult } from "@/editor/tools";
import type { AffectedRegion, BuildSpec, SpecAsset } from "../buildSpec";
import type { LintIssue } from "@/project/lint/projectLint";
import { isRecord } from "./unknownValue";

/** 게이트 통과 결과 — 실패는 ToolResult 로, 통과는 경고 목록으로 돌아온다. */
export interface SpecGatePass {
  warnings: LintIssue[];
  commitExpansion?: () => void;
}

// 검증기가 재제출 때 채우라고 이름을 부르는 에셋 필드. 여기 있는 이름은 반드시
// SET_BUILD_SPEC_TOOL 의 assets.items.properties 에도 선언돼 있어야 한다 —
// 선언 없는 필드를 요구하면 모델이 낼 방법이 없어 거부 루프가 예산을 태운다.
// 계약은 test/toolSchemaProviderCompat.test.ts 가 지킨다.
export const SPEC_REMEDY_FIELDS = ["overExisting", "confirmDestroy"] as const;

// 키 순서에 흔들리지 않는 명세 지문. JSON.stringify 는 키 삽입 순서를 그대로 따르므로
// 모델이 같은 내용을 순서만 바꿔 보내면 다른 문자열이 된다 — 정렬해서 비교한다.
export function specFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(specFingerprint).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const body = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${specFingerprint(entry)}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * 맵을 키우면 풀리는 거부에 붙이는 한 줄 — 필요한 크기와 순서를 명시한다.
 *
 * 왜 필요한가(2026-09-15 진단): 게이트의 거부 문구가 전부 "영역을 좁히세요" 쪽으로만 안내해서,
 * 맵이 작아서 생긴 실패에서도 모델은 에셋을 안쪽으로 밀거나 줄였다. resize_map 은 내내 열려 있었지만
 * 거부 경로 어느 줄도 그 이름을 부르지 않았다. 숫자는 코드(plannedGrowthForSpec)가 계산해 넘긴다.
 */
export function growthGuidanceLine(mapId: string, growth: { width: number; height: number }): string {
  return `맵 '${mapId}'이 요구 영역보다 작습니다 — 영역을 좁히는 대신 키우는 것도 정답입니다. `
    + `resize_map({mapId:"${mapId}", width:${growth.width}, height:${growth.height}})을 먼저 호출한 뒤, `
    + `같은 크기를 plannedMap:{mapId:"${mapId}", width:${growth.width}, height:${growth.height}} 으로 선언한 set_build_spec 을 제출하세요. `
    + `확장은 좌상단 기준이라 기존 타일·이벤트는 그대로 있고 늘어난 칸만 잔디가 됩니다(비파괴적).`;
}

export function specGateResult(summary: string, guidance: readonly string[]): ToolResult {
  return {
    ok: false,
    summary,
    issues: [{ severity: "error", code: "spec-gate", message: guidance.join(" ") }],
  };
}

export function isSpecGatePass(result: ToolResult | SpecGatePass): result is SpecGatePass {
  return "warnings" in result;
}

export function plannedTargetMismatch(spec: BuildSpec, args: Record<string, unknown>): string | null {
  const expected = spec.plannedMap;
  const target = args.target;
  if (!expected || !isRecord(target) || target.kind !== "new") return null;

  const planned = isRecord(target.plannedMap) ? target.plannedMap : target;
  const actualMapId = typeof planned.mapId === "string"
    ? planned.mapId
    : typeof target.mapId === "string"
      ? target.mapId
      : null;
  const actualWidth = typeof planned.width === "number" ? planned.width : null;
  const actualHeight = typeof planned.height === "number" ? planned.height : null;
  if (
    actualMapId === expected.mapId
    && actualWidth === expected.width
    && actualHeight === expected.height
  ) {
    return null;
  }

  return `확정된 plannedMap은 '${expected.mapId}' ${expected.width}×${expected.height}이지만 요청 대상은 `
    + `'${actualMapId ?? "?"}' ${actualWidth ?? "?"}×${actualHeight ?? "?"}입니다.`;
}

export function regionContains(region: AffectedRegion, x: number, y: number): boolean {
  return x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h;
}

export function autoExpandedAssetKind(toolName: string): string {
  switch (toolName) {
    case "clear_region":
    case "tile_erase":
      return "clear";
    case "paint_road":
    case "tile_road":
    case "lay_path":
      return "road";
    case "fill_region":
    case "paint_tiles":
    case "tile_paint":
      return "terrain";
    case "place_npc":
    case "make_villager":
      return "npc";
    case "place_battle_blocker":
    case "place_props":
    case "tile_scatter":
      return "prop";
    case "build_house":
    case "build_village":
      return "house";
    default:
      return "structure";
  }
}

/** 상점 역할 이름 판정 — eventTools 의 같은 정규식과 의미를 맞춘다(그쪽은 비공개). */
export const SHOP_ROLE_NAME = /상점\s*주인|잡화\s*상|잡화점|가게\s*주인|상인|merchant|shopkeeper|shop\s*owner/u;

export function specNpcName(asset: SpecAsset): string {
  const style = asset.style?.trim();
  if (style) return style;
  const note = asset.note?.trim();
  return note && note.length > 0 ? note : "주민";
}

export function buildSpecPlanLabel(spec: BuildSpec): string {
  const title = spec.title?.trim();
  if (title) return title;
  const assetLabels = spec.assets
    .slice(0, 3)
    .map((asset) => asset.id.trim() || asset.kind.trim())
    .filter((label) => label.length > 0);
  const suffix = spec.assets.length > assetLabels.length ? ` 외 ${spec.assets.length - assetLabels.length}개` : "";
  return assetLabels.length > 0 ? `${assetLabels.join(", ")}${suffix}` : spec.mapId;
}
