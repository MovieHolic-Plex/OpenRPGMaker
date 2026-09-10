// project/mapPlanningItems.ts
// 맵마다 보존되는 **사람이 읽는 기획 항목** 목록의 유일한 권위.
//
// 왜 프로젝트 데이터인가: 조수의 밑그림(BuildSpec)은 세션 상태다 — 새 대화·프로젝트 전환이
// 지나가는 `dropSession` 이 청사진을 걷고, 같은 맵에 새 스펙을 내면 이전 스펙을 대체한다.
// 그래서 "이 맵에 원래 뭘 하려고 했는지" 는 다음 작업으로 넘어가지 못했다(OPRN-OUT-019).
// 여기 있는 항목은 프로젝트 JSON 에 실려 저장·내보내기·가져오기를 통과한다.
//
// 무엇이 아닌가: **강제 기억이 아니다.** 이 목록은 프롬프트에 자동으로 실리지 않고, 수동 편집을
// 막지도 않는다. 조수 턴에 실리는 것은 사용자가 컴포저에서 명시적으로 고른 재사용(none/all/selected)
// 뿐이며, 그때도 게이트가 아니라 지침 문장으로 간다. 검증기·시공 게이트는 이 필드를 읽지 않는다.

export type MapPlanningItemStatus = "active" | "retired";
export type MapPlanningItemOrigin = "user" | "spec";

export interface MapPlanningItem {
  /** `pi_` 접두 안정 id. 대화·세션과 무관하게 프로젝트 안에서 고유하다. */
  id: string;
  /** 사람이 읽고 고치는 한 줄. 이것이 항목의 본문이다. */
  text: string;
  status: MapPlanningItemStatus;
  /** 사람이 적었는지, 조수 밑그림에서 담았는지. 표시용 출처이며 권한 차이는 없다. */
  origin: MapPlanningItemOrigin;
  /** ISO 문자열. 정렬은 배열 순서를 쓰고 이 값은 표시용이다. */
  createdAt?: string;
  updatedAt?: string;
  /** 밑그림에서 담은 항목의 원본 에셋 id — 같은 에셋을 두 번 담지 않기 위한 표식. */
  specAssetId?: string;
}

export const MAP_PLANNING_ITEM_TEXT_MAX = 400;
export const MAP_PLANNING_ITEMS_MAX = 200;
const ID_PREFIX = "pi_";

export function isMapPlanningItemStatus(value: unknown): value is MapPlanningItemStatus {
  return value === "active" || value === "retired";
}

export function isMapPlanningItemOrigin(value: unknown): value is MapPlanningItemOrigin {
  return value === "user" || value === "spec";
}

/** 표시·저장 공통 정규화: 공백 정리 + 길이 상한. 빈 본문은 항목이 될 수 없다. */
export function normalizePlanningItemText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAP_PLANNING_ITEM_TEXT_MAX);
}

export function makeMapPlanningItemId(existing: readonly MapPlanningItem[] = []): string {
  const taken = new Set(existing.map((item) => item.id));
  for (let n = 1; ; n += 1) {
    const id = `${ID_PREFIX}${n}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * 저장본/도구 입력에서 읽은 목록을 정규화한다. 잘못된 행은 조용히 버리고(빈 본문·중복 id·
 * 알 수 없는 status/origin), 항목이 하나도 남지 않으면 `undefined` 를 준다 — 그러면 호출부가
 * 필드를 지워 옛 프로젝트 JSON 이 바이트 그대로 유지된다.
 */
export function normalizeMapPlanningItems(value: unknown): MapPlanningItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: MapPlanningItem[] = [];
  const taken = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const text = typeof row.text === "string" ? normalizePlanningItemText(row.text) : "";
    if (!id || !text || taken.has(id)) continue;
    if (out.length >= MAP_PLANNING_ITEMS_MAX) break;
    taken.add(id);
    const item: MapPlanningItem = {
      id,
      text,
      status: isMapPlanningItemStatus(row.status) ? row.status : "active",
      origin: isMapPlanningItemOrigin(row.origin) ? row.origin : "user",
    };
    if (typeof row.createdAt === "string" && row.createdAt) item.createdAt = row.createdAt;
    if (typeof row.updatedAt === "string" && row.updatedAt) item.updatedAt = row.updatedAt;
    if (typeof row.specAssetId === "string" && row.specAssetId) item.specAssetId = row.specAssetId;
    out.push(item);
  }
  return out.length > 0 ? out : undefined;
}

export function activePlanningItems(items: readonly MapPlanningItem[] | undefined): MapPlanningItem[] {
  return (items ?? []).filter((item) => item.status === "active");
}

/**
 * 재사용 선택. `none` 이 기본이다 — 아무것도 고르지 않으면 조수 턴에 아무 문장도 실리지 않는다.
 * `selected` 는 항목 id 집합을 함께 들고 다닌다.
 */
export type PlanningReuseMode = "none" | "all" | "selected";

export interface PlanningReuseChoice {
  readonly mode: PlanningReuseMode;
  readonly selectedIds: readonly string[];
}

export const NO_PLANNING_REUSE: PlanningReuseChoice = { mode: "none", selectedIds: [] };

/** 선택을 실제 항목으로 환원한다. 은퇴·삭제된 id 는 결과에서 사라진다(조용한 부활 금지). */
export function resolvePlanningReuse(
  items: readonly MapPlanningItem[] | undefined,
  choice: PlanningReuseChoice,
): MapPlanningItem[] {
  if (choice.mode === "none") return [];
  const active = activePlanningItems(items);
  if (choice.mode === "all") return active;
  const wanted = new Set(choice.selectedIds);
  return active.filter((item) => wanted.has(item.id));
}

export const PLANNING_REUSE_BLOCK_LABEL = "[보존 기획]";

/**
 * 재사용으로 고른 항목을 사용자 발화 뒤에 붙는 **지침 블록**으로 만든다. 없으면 빈 문자열이라
 * 아무 것도 붙지 않는다. 문구가 게이트가 아니라 지침임을 본문에서 명시한다 — 이 블록은
 * 검증기·승인 정책을 통과하지 않고, 조수가 이것을 이유로 사용자의 새 요청을 거절하면 안 된다.
 */
export function formatPlanningReuseBlock(items: readonly MapPlanningItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((item, index) => `${index + 1}. ${item.text}`);
  return [
    `${PLANNING_REUSE_BLOCK_LABEL} 사용자가 이 맵에 보존해 둔 기획 항목 ${items.length}개를 이번 작업에 참고하도록 골랐다.`,
    "이 항목들은 지침이며 차단 규칙이 아니다. 새 요청과 충돌하면 새 요청을 따르고 어긋난 항목을 말해라.",
    ...lines,
  ].join("\n");
}

/**
 * 밑그림 에셋 하나를 사람이 읽는 기획 한 줄로 만든다. 좌표를 남기는 이유: 나중에 「원래
 * 광장은 남기고 싶었다」를 판단할 때 그 자리가 어디였는지가 문장의 절반이다.
 */
export function planningTextFromSpecAsset(asset: {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly style?: string;
  readonly note?: string;
}): string {
  const label = asset.note?.trim() || asset.style?.trim() || asset.kind;
  return normalizePlanningItemText(`${label} — ${asset.kind} (${asset.x},${asset.y}) ${asset.w}×${asset.h}`);
}

/** 재사용 선택을 한 줄로 — 컴포저 칩과 채팅 기록이 같은 문장을 쓴다. */
export function describePlanningReuse(count: number, mode: PlanningReuseMode): string {
  if (mode === "none" || count === 0) return "보존 기획 사용 안 함";
  return mode === "all" ? `보존 기획 전체 ${count}개 사용` : `보존 기획 ${count}개 선택 사용`;
}
