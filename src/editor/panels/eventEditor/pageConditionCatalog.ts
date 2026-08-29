// 페이지 조건 종류 카탈로그 — 칩 팔레트의 분류·라벨·기본값을 한곳에 모은다.
//
// 예전에는 같은 목록이 세 군데에 흩어져 있었다: `pageConditions.ts` 의 12행 하드코딩,
// `pageAdvancedConditions.ts` 의 `ADVANCED_CONDITION_OPTIONS`, 그리고 `pageConditionModel.ts` 의
// `defaultSimpleCondition`/`defaultAdvancedCondition`. 종류를 하나 추가하려면 세 곳을 고쳐야 했고,
// 실제로 소지금·전투 결과·탐험은 12행 쪽에 빠져 「고급 조건」에서만 편집할 수 있었다.
import { store } from "@/project/store";
import type { EventPageCondition } from "@/project/types";

/**
 * 팔레트 칩으로 노출하는 조건 종류.
 *
 * `all`/`any`/`not` 은 중첩 편집기가 없어 제외한다 — 이미 데이터에 있으면 목록에
 * 읽기 전용 요약 행으로 나타나고 삭제만 할 수 있다.
 */
export type PageConditionChipKind = Exclude<EventPageCondition["kind"], "all" | "any" | "not">;

export const PAGE_CONDITION_LABELS: Record<PageConditionChipKind, string> = {
  switch: "스위치",
  variable: "변수",
  selfSwitch: "이 이벤트 기억",
  item: "아이템",
  actor: "주인공",
  gold: "소지금",
  timer: "타이머",
  timePhase: "시간대",
  season: "계절",
  npcActivity: "활동",
  friendshipAtLeast: "호감도",
  battleResult: "전투 결과",
  run: "탐험",
};

export type PageConditionCategory = {
  readonly slug: string;
  readonly title: string;
  readonly kinds: readonly PageConditionChipKind[];
};

/**
 * 칩 4줄. 13종을 의미로 묶어 "내가 찾는 조건이 어느 줄에 있는가"를 학습 없이 짚게 한다.
 *
 * 줄 수를 늘리지 않는 것이 목표다 — 팔레트는 상시 노출이므로 줄이 늘면 그대로 밀도가 된다.
 */
export const PAGE_CONDITION_CATEGORIES: readonly PageConditionCategory[] = [
  { slug: "progress", title: "진행 상태", kinds: ["switch", "variable", "selfSwitch"] },
  { slug: "holding", title: "소지", kinds: ["item", "actor", "gold"] },
  { slug: "time", title: "시간", kinds: ["timer", "timePhase", "season"] },
  { slug: "situation", title: "관계·상황", kinds: ["friendshipAtLeast", "npcActivity", "battleResult", "run"] },
];

/** 카탈로그가 노출하는 종류 전부. 누락되면 그 종류는 추가할 방법이 아예 없어진다. */
export const PAGE_CONDITION_CHIP_KINDS: readonly PageConditionChipKind[] =
  PAGE_CONDITION_CATEGORIES.flatMap((category) => category.kinds);

export function pageConditionLabel(kind: EventPageCondition["kind"]): string {
  switch (kind) {
    case "all":
      return "모두 만족";
    case "any":
      return "하나 이상 만족";
    case "not":
      return "아닐 때";
    default:
      return PAGE_CONDITION_LABELS[kind];
  }
}

/**
 * 칩을 누를 때 심는 조건.
 *
 * `existingCount` 는 같은 종류가 이미 몇 개 있는지다. 두 번째 스위치가 첫 번째와 같은 스위치를
 * 가리키면 늘 같은 값인 중복 조건이 되고, 두 번째 타이머가 timer1 이면 앞 조건과 같은 타이머를
 * 두 번 재는 셈이 된다. RM 의 «스위치 2칸 / 타이머 2칸» 기본 배분을 여기서 재현한다.
 */
export function defaultPageCondition(
  kind: PageConditionChipKind,
  existingCount = 0,
): EventPageCondition {
  const project = store.getCurrent();
  switch (kind) {
    case "switch":
      return {
        kind: "switch",
        switchId: project.switches[existingCount]?.id ?? project.switches[0]?.id ?? "",
        value: true,
      };
    case "variable":
      return {
        kind: "variable",
        variableId: project.variables[existingCount]?.id ?? project.variables[0]?.id ?? "",
        op: ">=",
        value: 0,
      };
    case "selfSwitch":
      return { kind: "selfSwitch", key: "A", value: true };
    // 빈 itemId 는 참조 검증(page condition: itemId가 존재하지 않습니다)에 바로 걸린다.
    case "item":
      return { kind: "item", itemId: project.database.items[0]?.id ?? "", present: true };
    case "actor":
      return { kind: "actor", actorId: project.database.actors[0]?.id ?? "", present: true };
    case "gold":
      return { kind: "gold", op: ">=", amount: 0 };
    case "timer":
      return { kind: "timer", timerId: existingCount >= 1 ? "timer2" : "timer1", seconds: 0 };
    case "timePhase":
      return { kind: "timePhase", phase: "day" };
    case "season":
      return { kind: "season", season: "spring" };
    case "npcActivity":
      return { kind: "npcActivity", activity: "work" };
    case "friendshipAtLeast":
      return { kind: "friendshipAtLeast", value: 100 };
    case "battleResult":
      return { kind: "battleResult", result: "victory" };
    case "run":
      return { kind: "run", query: "active", value: true };
  }
}
