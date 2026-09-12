// ai/constructionDeclaration.ts
// 의도 선언의 시공 규모 파트 — 선언자가 문장에서 옮긴 수량(크기어·집·주민·새 맵 이름)의 타입과,
// 그 수량을 권장 맵 크기로 환산하는 코드 계산을 한 곳에 둔다.
//
// 왜 여기 있나 (2026-09-11 진단): 「마을을 만들어」에서 맵 크기를 결정하는 주체가 없었다. 의도 선언은
// needsPlan 한 비트만 내고 수량을 버렸고, 플래너는 새 맵 w×h를 창작했으며(workPlan 지시는
// 「건설 지시는 목표 맵과 정확한 수량을」이 전부), 도구 계층(parseVillageRequest)은 width/height를
// 필수로 두어 같은 숫자가 두 번 발명됐다. 이 모듈이 유일한 환산기다 — 소비처(의도 노트·플래너
// 페이로드)는 이 결과를 "코드가 아는 사실"로 흘려보내고, 계층마다 같은 숫자를 쓴다.
//
// 경계: 문장을 읽지 않는다 — 선언자가 옮긴 값만 정합화한다. 크기어(큰/작은)만 선언 계층이 소유하고,
// 지형어(「강촌」→강)는 기존대로 DB 「세계 → 생성 규칙」(@/project/worldGenRules)이 소유한다.
// 슬롯·여백 계수는 village 시공기 실측(16×16에 집 1채+길이 빡빡 — src/editor/tools/authorVillageSupport.ts)과 같다.

import { isRecord } from "@/ai/session/unknownValue";
import { MAX_TOOL_MAP_DIMENSION } from "@/project/mapSizeLimits";

/** 사용자 발화(아기자기·작은 / 보통 / 큰·넓은 / 아주 큰·광활)를 선언자가 옮긴 등급. */
export type ConstructionScale = "small" | "medium" | "large" | "vast";

const CONSTRUCTION_SCALES: readonly ConstructionScale[] = ["small", "medium", "large", "vast"];

export interface ConstructionDeclaration {
  /** 크기어. houseCount가 같이 선언되면 수량이 이긴다 — 크기어는 수량이 없을 때의 기본일 뿐이다. */
  readonly scale?: ConstructionScale;
  /** 집 수. 플래너 항목 수량과 author_village의 houseCount로 흘러간다. */
  readonly houseCount?: number;
  /** 마을 주민(인구) 목표. 맵 크기 계산에는 안 들어간다 — 통행 가능 칸에 놓인다. */
  readonly npcCount?: number;
  /** 새로 만들 맵 이름(「큰 강호 장터 마을」) — 신축 표지. 기존 맵 수정이면 생략. */
  readonly targetName?: string;
}

export interface EstimatedVillageSize {
  readonly width: number;
  readonly height: number;
  /** 크기 계산의 기준이 된 집 수(선언 수량 or 크기어 기본 or 무선언 기본). */
  readonly houseCount: number;
  /** 어느 입력이 크기를 정했는가 — 결과·감사가 "코드가 계산했다"고 말할 근거. */
  readonly source: "scale" | "houseCount" | "default";
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** 집 수 상한 — author_village(1~32)와 같다. 선언이 넘어도 도구 계층에서 잘리므로 여기서 정합. */
const MAX_DECLARED_HOUSES = 32;
/** 수량·크기어 둘 다 없을 때의 기본 집 수. */
const DEFAULT_HOUSES = 12;
const SCALE_DEFAULT_HOUSES: Record<ConstructionScale, number> = { small: 4, medium: 8, large: 16, vast: 24 };
/** 마을은 가로로 넓다 — 집 열:행 = 6:4. 한 열 몰아넣기(1×N)는 같은 실측의 함정이다. */
const ASPECT = 1.5;
/** 집 슬롯 한 채(집 8×6 + 여백 2)와 광장·길·숲 여유. */
const HOUSE_SLOT_W = 10;
const HOUSE_SLOT_H = 12;
const COMMON_MARGIN_W = 14;
const COMMON_MARGIN_H = 4;
/** 새 맵 최소(파서 하한과 같다) — 실계산은 24 이하로 안 내려가지만 계수 변경에 대한 가드. */
const MIN_SIZE = 20;

/** 선언 JSON의 construction 필드. 모르는 값은 버린다 — 전체 선언을 실패로 만들지 않는다(관대한 경계). */
export function parseConstructionDeclaration(raw: unknown): ConstructionDeclaration | undefined {
  if (!isRecord(raw)) return undefined;
  const construction: { scale?: ConstructionScale; houseCount?: number; npcCount?: number; targetName?: string } = {};
  if (typeof raw.scale === "string" && (CONSTRUCTION_SCALES as readonly string[]).includes(raw.scale)) {
    construction.scale = raw.scale as ConstructionScale;
  }
  const houseCount = positiveInt(raw.houseCount);
  if (houseCount !== undefined) construction.houseCount = Math.min(houseCount, MAX_DECLARED_HOUSES);
  const npcCount = positiveInt(raw.npcCount);
  if (npcCount !== undefined) construction.npcCount = npcCount;
  if (typeof raw.targetName === "string" && raw.targetName.trim()) construction.targetName = raw.targetName.trim().slice(0, 60);
  return Object.keys(construction).length > 0 ? construction : undefined;
}

/**
 * 선언된 시공 규모 → 권장 맵 크기(마을 한 판). 코드가 아는 사실 — 호출자는 이 숫자를 그대로 쓴다.
 * 집 수=선언 수량(없으면 크기어 기본, 그것도 없으면 기본) → 열=√(수×1.5) 6:4, 슬롯 10×12+여백,
 * 20~256 클램프. 선언에 construction이 없으면 기본 12채 — 모델이 수량을 몰라도 진행한다(원큐 원칙).
 */
export function estimateVillageSize(input: ConstructionDeclaration | null | undefined = {}): EstimatedVillageSize {
  const declared = positiveInt(input?.houseCount);
  const scale = input?.scale;
  const houseCount = Math.min(declared ?? (scale ? SCALE_DEFAULT_HOUSES[scale] : DEFAULT_HOUSES), MAX_DECLARED_HOUSES);
  const cols = Math.max(1, Math.ceil(Math.sqrt(houseCount * ASPECT)));
  const rows = Math.max(1, Math.ceil(houseCount / cols));
  const width = cols * HOUSE_SLOT_W + COMMON_MARGIN_W;
  const height = rows * HOUSE_SLOT_H + COMMON_MARGIN_H;
  return {
    width: Math.min(MAX_TOOL_MAP_DIMENSION, Math.max(MIN_SIZE, width)),
    height: Math.min(MAX_TOOL_MAP_DIMENSION, Math.max(MIN_SIZE, height)),
    houseCount,
    source: declared !== undefined ? "houseCount" : scale ? "scale" : "default",
  };
}
