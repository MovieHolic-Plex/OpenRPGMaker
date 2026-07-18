// project/materialPolicy.ts
// 시공 material 공개 계약 보조: "가방(bag)" 그룹은 라벨로 쓸 수 없다.
// 사고 클래스: place_props material:"마을 소품"/small-props → 랜덤 잡동사니 산포.

import type { TileGroupMetadata } from "./types";

/** 잔여 잡소품 가방 그룹 id 접미사 / 별칭 (harness prefix 유무 무관). */
const BAG_GROUP_ID_MARKERS = [
  "small-props",
  "small_props",
  "smallprops",
] as const;

/** 가방 그룹 display name / material 문자열 (정규화 전 비교용 소문자). */
const BAG_MATERIAL_LABELS = new Set([
  "마을 소품",
  "small-props",
  "small props",
  "smallprops",
  "잡소품",
  "잔여 소품",
]);

export function normalizeMaterialKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 그룹 id가 가방(bag) 재료인지. */
export function isBagGroupId(groupId: string | undefined | null): boolean {
  if (!groupId) return false;
  const id = groupId.toLowerCase();
  return BAG_GROUP_ID_MARKERS.some((marker) => id === marker || id.endsWith(`-${marker}`) || id.endsWith(`_${marker}`) || id.includes(`-${marker}`) || id.includes(`_${marker}`));
}

/** 그룹 메타가 가방인지 (id + 이름 + 설명 휴리스틱). */
export function isBagGroup(group: Pick<TileGroupMetadata, "id" | "name" | "description">): boolean {
  if (isBagGroupId(group.id)) return true;
  const name = normalizeMaterialKey(group.name);
  if (BAG_MATERIAL_LABELS.has(name)) return true;
  // 하네스 설명: "잔여 소품 가방"
  const desc = (group.description ?? "").toLowerCase();
  if (desc.includes("잔여 소품") && desc.includes("가방")) return true;
  if (desc.includes("bag") && (desc.includes("misc") || desc.includes("remaining"))) return true;
  return false;
}

/** material 문자열이 가방 라벨/레거시 id 인지 (시공 거절용). */
export function isBagMaterialQuery(query: string): boolean {
  const raw = query.trim();
  if (!raw) return false;
  if (isBagGroupId(raw)) return true;
  const key = normalizeMaterialKey(raw);
  if (BAG_MATERIAL_LABELS.has(key)) return true;
  // harness-…-small-props
  if (/small[-_]?props/i.test(raw)) return true;
  return false;
}

export function bagMaterialRejectMessage(query: string): string {
  return (
    `material "${query}" 은(는) 잡소품 가방(bag)입니다. ` +
    `place_props 에는 구체 라벨을 쓰세요(예: "나무 상자", "침엽수", "꽃", "표지판"). ` +
    `tile_query ask:"labels" 로 후보를 확인하세요.`
  );
}
