/**
 * 「빠른 저작」 탭 1 기본값.
 *
 * 계획: `.omo/plans/event-editor-quick-authoring-adversarial-review.md`
 * - 상점은 첫 화면부터 진열이다. 「빈 상점」 + DB 전체 아이콘 홍수가 아니다.
 * - 이동 경로는 첫 화면부터 궤적이다. 「이동 명령 없음」 빈 카피가 아니다.
 * - 말하기 무대는 빈 본문이어도 샘플 대사를 보여 준다. `...` 만 남기지 않는다.
 */
import type { ItemId, MoveRoute, Project } from "@/project/types";

/** 잡화점 프리셋 — 회복약·마력약·해독초. 상점 편집 폼의 프리셋 버튼과 같은 목록이다. */
export const GENERAL_STORE_PRESET_ITEM_IDS: readonly ItemId[] = [
  "item_potion",
  "item_ether",
  "item_antidote",
];

/**
 * 새 상점 명령의 기본 진열. 프로젝트 DB에 잡화점 품목이 있으면 그것을, 없으면
 * 첫 아이템 하나라도 깐다. 판매 목록이 0개인 상점을 첫 화면으로 보여 주지 않는다.
 */
export function defaultShopItemIds(project: Project): readonly ItemId[] {
  const catalog = project.database.items;
  const preset = GENERAL_STORE_PRESET_ITEM_IDS.filter((id) => catalog.some((item) => item.id === id));
  if (preset.length > 0) return preset;
  const first = catalog[0]?.id;
  return first ? [first] : [];
}

/** 새 이동 경로 명령의 기본 궤적 — 오른쪽 한 걸음. 격자에 노드가 최소 하나 생긴다. */
export function defaultMoveRoute(): MoveRoute {
  return { moves: [{ kind: "move", dir: "right" }], repeat: false };
}

/** 말하기 무대 샘플 대사. 본문이 비어 있을 때 창 안에 이 문장이 보인다. */
export const SPEAK_SAMPLE_SPEAKER = "마을 사람";
export const SPEAK_SAMPLE_BODY = "여기가 작은나무 마을이야.\n무슨 일로 왔니?";
