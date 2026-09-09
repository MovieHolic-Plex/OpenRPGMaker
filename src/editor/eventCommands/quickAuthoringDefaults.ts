/**
 * 「빠른 저작」 탭 1 기본값.
 *
 * 계획: `.omo/plans/event-editor-quick-authoring-adversarial-review.md`
 * - 상점 명령 자체는 빈 진열로 시작한다. 없는 잡화 ID를 기본값으로 심지 않는다.
 *   실제 품목은 상품 추가·잡화점 프리셋·빈 이벤트 상점 서식이 프로젝트 DB에서 고른다.
 * - 이동 경로는 첫 화면부터 궤적이다. 「이동 명령 없음」 빈 카피가 아니다.
 * - 말하기 무대는 빈 본문이어도 샘플 대사를 보여 준다. `...` 만 남기지 않는다.
 */
import type { ItemId, MoveRoute } from "@/project/types";

/** 잡화점 프리셋 — 회복약·마력약·해독초. 상점 편집 폼의 프리셋 버튼과 같은 목록이다. */
export const GENERAL_STORE_PRESET_ITEM_IDS: readonly ItemId[] = [
  "item_potion",
  "item_ether",
  "item_antidote",
];

/** 새 이동 경로 명령의 기본 궤적 — 오른쪽 한 걸음. 격자에 노드가 최소 하나 생긴다. */
export function defaultMoveRoute(): MoveRoute {
  return { moves: [{ kind: "move", dir: "right" }], repeat: false };
}

/** 말하기 무대 샘플 대사. 본문이 비어 있을 때 창 안에 이 문장이 보인다. */
export const SPEAK_SAMPLE_SPEAKER = "마을 사람";
export const SPEAK_SAMPLE_BODY = "여기가 작은나무 마을이야.\n무슨 일로 왔니?";
