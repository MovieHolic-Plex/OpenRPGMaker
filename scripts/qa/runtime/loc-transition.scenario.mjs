// 「구역에 들어오면/나가면」 트리거 — **출하 플레이어**(player.html) 시나리오.
//
// 이 시나리오만이 증명할 수 있는 것: 판정이 **실제 걸음 상태기**와 **실제 장소 이동**에
// 걸려 있다는 사실. 단위 테스트는 `runSceneTest`(하네스 산법)로 돌고, 편집기 play 모드는
// shim 이 아니라 실제 store 를 태우므로 출하물을 검증하지 않는다(AGENTS.md 하드 룰).
// 여기서는 `player.html` 이 `exportProjectStoreShim` 경로로 부팅한 상태에서
// `advancePlayerStepFrame` 의 칸 확정과 `transferTo` 의 착지가 트리거를 돌리는지 본다.
//
// 픽스처: scripts/qa/runtime/loc-transition-fixture.mts (최소 엔진 계약, 데모 콘텐츠 아님)
//   npx tsx scripts/qa/runtime/loc-transition-fixture.mts > /tmp/loc-transition.json
//   npm run qa:runtime -- --scenario loc-transition --project /tmp/loc-transition.json \
//     --out verify-shots/loc-transition
//
// 기하 (map_blank_start 20×15):
//   광장 loc1 = (12,6) 5×5 → x 12..16, y 6..10.  시작 (10,8) 은 밖.
//   (10,10) 의 문(playerTouch) → 같은 맵 (14,8) 로 장소 이동(광장 안, 중간 걸음 없음).
//
// 대사 글자로 사건을 구분한다: 「광장에 들어섰다.」 = enter, 「광장을 나섰다.」 = leave.
// 좌표만 보면 «트리거가 안 돌아도 통과» 하므로 visibleText 축이 본체다.

const MAP = "map_blank_start";
const ENTER_TEXT = "광장에 들어섰다.";
const LEAVE_TEXT = "광장을 나섰다.";

/** 대사창을 결정 키로 비운다. 고정 횟수로 누르면 남은 입력이 다음 사건을 삼킨다(실측 관례). */
const dismissDialogue = { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 8 };

/**
 * 타자기가 도는 중에 결정 키를 한 번 눌러 페이지를 **완성**시킨다(`consumeRemainingPage`).
 * 창은 닫히지 않고 글자만 전부 드러나므로 `visibleText` 로 어느 사건이 났는지 읽을 수 있다.
 * 고정 sleep 으로 타자기를 기다리면 부하에 따라 흔들린다 — 여기서는 상태 변화가 자극이다.
 */
const completeTypedPage = [
  { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20_000 },
  { kind: "key", key: "Enter" },
];

/** 한 칸 걸음 — 저작된 이동 루트로 실제 이동 상태기를 태운다(고정 sleep 없음). */
function step(dir, x, y) {
  return [
    { kind: "playerRoute", moves: [{ kind: "move", dir }] },
    { kind: "waitForPosition", mapId: MAP, x, y, timeoutMs: 30_000 },
  ];
}

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const locTransitionScenario = {
  id: "loc-transition",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start-outside",
      note: "새 게임 → (10,8), 광장 밖. 부팅만으로는 구역 이벤트가 돌지 않는다(기준선만 심는다).",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: MAP,
        x: 10,
        y: 8,
        playerSpriteTextureLoaded: true,
        // 대사창이 없어야 한다 — 있으면 시작 지점을 «진입» 으로 오판한 것이다.
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    {
      id: "step-toward-plaza",
      note: "(11,8) — 아직 광장 밖이다. 한 칸 접근만으로 발동하지 않는다.",
      ops: step("right", 11, 8),
      expect: { x: 11, y: 8, testidAbsent: ["dialogue-box"] },
    },
    {
      id: "enter-plaza",
      note: "(12,8) 광장 경계를 밟는 걸음 → enter 이벤트의 대사가 떠야 한다",
      ops: [
        ...step("right", 12, 8),
        ...completeTypedPage,
      ],
      expect: {
        x: 12,
        y: 8,
        testidPresent: ["dialogue-box"],
        visibleText: { "dialogue-box": ENTER_TEXT },
      },
      shot: true,
    },
    {
      id: "walk-inside-no-refire",
      note: "광장 안에서 두 칸 더 걸어도 enter 가 다시 나지 않는다 (같은 점유 집합)",
      ops: [
        dismissDialogue,
        ...step("right", 13, 8),
        ...step("down", 13, 9),
      ],
      expect: { x: 13, y: 9, testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "leave-plaza",
      note: "왼쪽으로 걸어 경계를 넘으면 leave 이벤트의 대사가 떠야 한다",
      ops: [
        ...step("up", 13, 8),
        ...step("left", 12, 8),
        // (12,8) 은 아직 안이다 — 여기서 대사가 뜨면 판정이 한 칸 앞서 있다는 뜻이다.
        ...step("left", 11, 8),
        ...completeTypedPage,
      ],
      expect: {
        x: 11,
        y: 8,
        testidPresent: ["dialogue-box"],
        visibleText: { "dialogue-box": LEAVE_TEXT },
      },
      shot: true,
    },
    {
      id: "reenter-fires-again",
      note: "나갔다 다시 들어오면 enter 가 또 난다 (일회성이 아니다)",
      ops: [
        dismissDialogue,
        ...step("right", 12, 8),
        ...completeTypedPage,
      ],
      expect: { x: 12, y: 8, visibleText: { "dialogue-box": ENTER_TEXT } },
    },
    {
      id: "walk-to-door",
      note: "광장을 나와 문(10,10) 앞까지 걷는다. 나가는 걸음에서 leave 가 한 번 난다.",
      ops: [
        dismissDialogue,
        ...step("left", 11, 8),
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20_000 },
        dismissDialogue,
        ...step("down", 11, 9),
        ...step("left", 10, 9),
      ],
      expect: { x: 10, y: 9, testidAbsent: ["dialogue-box"] },
    },
    {
      id: "teleport-into-plaza",
      note: "문을 밟아 (14,8) 로 장소 이동 — 중간 걸음이 없어도 광장 enter 가 난다",
      ops: [
        // 문은 playerTouch 라 밟는 것이 곧 발동이다(조사 키가 아니다). (10,10) 에 서는
        // 상태는 관측되지 않는다 — 착지 프레임에서 곧바로 장소 이동이 걸리므로 중간 좌표를
        // 기다리면 영원히 오지 않는다(실측: 30초 타임아웃). 도착 좌표만 기다린다.
        { kind: "playerRoute", moves: [{ kind: "move", dir: "down" }] },
        { kind: "waitForPosition", mapId: MAP, x: 14, y: 8, timeoutMs: 30_000 },
        ...completeTypedPage,
      ],
      expect: {
        mapId: MAP,
        x: 14,
        y: 8,
        testidPresent: ["dialogue-box"],
        visibleText: { "dialogue-box": ENTER_TEXT },
      },
      shot: true,
    },
  ],
};

export default locTransitionScenario;
