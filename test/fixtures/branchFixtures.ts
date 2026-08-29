// test/fixtures/branchFixtures.ts
//
// **분기(자식 명령 배열)를 가진 커맨드 픽스처** — 커밋 프로브의 분기 보존 하드 계약이 쓴다.
//
// 왜 필요한가 (실측된 최악의 실패 모드):
//   choices 의 readOptionsFromDom 이 `branch: []` 를 반환하도록 바꿨더니
//   폼 표면 스냅샷 게이트 + choicesCommandBody(3건) + eventEditorStagedState(14건) +
//   storyboardBranches(11건)가 **전부 초록**이었다. 선택지 안에 사용자가 넣은 명령이
//   통째로 사라지는데 아무도 안 잡는다. 기존 픽스처가 전부 `branch: []` 라서 "비어 있는 것"과
//   "비워진 것"을 구분할 수 없었던 게 원인이다.
//
// 그래서 여기 픽스처는 모든 분기 슬롯에 **고유 마커 명령**을 넣는다. 마커는 문자열이므로
// 커밋된 커맨드를 JSON 으로 훑어 존재 여부를 즉시 확인할 수 있고, 어느 슬롯이 사라졌는지도
// 마커 이름으로 특정된다.
//
// 분기 슬롯 목록은 추측이 아니라 src/project/types/events.ts 의 Command 유니온에서
// `Command[]` 타입 필드를 전수 조사해 얻었다 — 8개 kind / 15개 슬롯.
// 런타임 순회 헬퍼 src/editor/tools/commandTraversal.ts:4-8 의 NestedBranchKind 와 일치한다.
import type { Command } from "@/project/types";

/** 분기 안에 넣는 마커 명령. 태그가 곧 슬롯 이름이다. */
export function branchMark(tag: string): Command {
  return { kind: "text", body: `__BRANCH_MARK_${tag}__` };
}

/**
 * 슬롯당 마커 2개를 넣는다 — 1개면 "길이 1 → 길이 1" 인 잘못된 치환을 못 잡고,
 * 배열 절단(마지막 원소만 잃는 부분 소실)도 감지되지 않는다.
 */
function marks(tag: string): Command[] {
  return [branchMark(`${tag}_1`), branchMark(`${tag}_2`)];
}

/** kind → 분기가 채워진 커맨드. 키는 진단 라벨로도 쓰인다. */
export const BRANCH_FIXTURES: Readonly<Record<string, Command>> = {
  // fork: then(필수) / else(옵셔널)
  fork: {
    kind: "fork",
    condition: { kind: "switch", switchId: "sw1", value: true },
    then: marks("FORK_THEN"),
    else: marks("FORK_ELSE"),
  },
  // choices: options[].branch(필수) / cancelBranch(옵셔널)
  // 옵션을 2개 두는 이유 — 옵션 배열 인덱스가 뒤바뀌는 결선 사고(1번 분기가 2번으로 붙음)를
  // 마커 태그로 구분하려면 서로 다른 마커를 가진 옵션이 최소 2개 필요하다.
  choices: {
    kind: "choices",
    prompt: "분기 보존 확인",
    options: [
      { text: "A", branch: marks("CHOICE_A") },
      { text: "B", branch: marks("CHOICE_B") },
    ],
    cancelBehavior: "branch",
    cancelBranch: marks("CHOICE_CANCEL"),
  },
  // loop: body(필수). breakLoop 을 함께 두어 실제 저작 형태에 가깝게 만든다.
  loop: {
    kind: "loop",
    body: [...marks("LOOP_BODY"), { kind: "breakLoop" }],
  },
  // battleProcessing: victory / defeat / escape (전부 옵셔널)
  battleProcessing: {
    kind: "battleProcessing",
    troopId: "troop1",
    canEscape: true,
    canLose: true,
    victoryBranch: marks("BATTLE_WIN"),
    defeatBranch: marks("BATTLE_LOSE"),
    escapeBranch: marks("BATTLE_ESCAPE"),
  },
  // promoteActor: success / failure (옵셔널)
  promoteActor: {
    kind: "promoteActor",
    actorId: "actor1",
    toClassId: "class1",
    successBranch: marks("PROMOTE_OK"),
    failureBranch: marks("PROMOTE_FAIL"),
  },
  // evolveMonster: success / failure (옵셔널)
  evolveMonster: {
    kind: "evolveMonster",
    instanceId: "monster_1",
    toSpeciesId: "species1",
    successBranch: marks("EVOLVE_OK"),
    failureBranch: marks("EVOLVE_FAIL"),
  },
  // shop: transactionBranch / failedTransactionBranch (옵셔널)
  shop: {
    kind: "shop",
    itemIds: ["item1"],
    transactionBranch: marks("SHOP_OK"),
    failedTransactionBranch: marks("SHOP_FAIL"),
  },
  // inn: notEnoughBranch (옵셔널)
  inn: {
    kind: "inn",
    price: 10,
    notEnoughBranch: marks("INN_POOR"),
  },
} as const;

/**
 * 타입에 선언된 분기 슬롯 수(events.ts 의 Command 유니온 전수 조사 결과).
 *   choices: options[].branch, cancelBranch = 2
 *   fork: then, else = 2
 *   loop: body = 1
 *   battleProcessing: victory/defeat/escape = 3
 *   promoteActor: success/failure = 2
 *   evolveMonster: success/failure = 2
 *   shop: transaction/failedTransaction = 2
 *   inn: notEnoughBranch = 1
 */
export const DECLARED_BRANCH_SLOTS = 15;

/**
 * 픽스처가 실제로 만들어내는 분기 배열 수. choices 에 옵션을 2개 두므로
 * options[].branch 가 배열 2개로 실체화되어 선언 슬롯 15 보다 하나 많다.
 * 픽스처가 슬롯을 빠뜨리면 계약이 그 슬롯을 아예 안 본다 — 그래서 숫자로 못박고 대조한다.
 */
export const EXPECTED_BRANCH_ARRAYS = 16;

/** 배열마다 마커 2개. 1개면 배열 절단(마지막 원소 소실)을 감지하지 못한다. */
export const EXPECTED_BRANCH_MARKERS = EXPECTED_BRANCH_ARRAYS * 2;
