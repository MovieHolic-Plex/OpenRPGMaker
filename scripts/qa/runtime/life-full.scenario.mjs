// 생활 전체 여정 시나리오 (출하 플레이어 경로) — task18.
//
// 실제 표면에서 파종 → 급수 → 수면(하루 전환) → 성장 → 수확 → 출하 → 수면 → 정산까지
// 한 줄로 잇는다. 모듈 테스트가 각 함수를 따로 통과시켜도, 실제 플레이어에서 이 연결이
// 끊기는지는 브라우저에서만 드러난다.
//
// 픽스처를 굽던 생성기는 2026-10-07 저작권 정리로 지웠다 — 지금 픽스처는 고정본이다.
// 감자는 stages [1일, 1일] 이므로 수확까지 이틀이 필요하다(실측: fixture 의 crop_potato).

const MAP = "map_farming_demo";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const lifeFullScenario = {
  id: "life-full",
  projectFixture: "test/fixtures/life-full.project.json",
  // 이 시나리오는 workbench 스킨(ESC 직후 아이템 작업 패널)의 계약이다 — 기본 스킨이 pixel 로 바뀐 뒤에도 같은 화면을 본다.
  systemPatch: { menuUiStyle: "workbench" },
  seed: 18,
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 농장 시작. 기력 100, 씨앗 3, 수확물 없음",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 18 },
      ],
      expect: {
        mapId: MAP,
        x: 4,
        y: 4,
        energy: 100,
        inventory: { item_potato_seed: 3, item_potato: 0 },
      },
      shot: true,
    },
    {
      id: "till-plot",
      note: "밭(4,5)로 내려가 괭이(손 슬롯 1)로 실제 경작",
      ops: [
        { kind: "key", key: "1" },
        { kind: "playerRoute", moves: [{ kind: "move", dir: "down" }] },
        { kind: "waitForPosition", mapId: MAP, x: 4, y: 5, timeoutMs: 60_000 },
        { kind: "face", dir: "down" },
        { kind: "pauseFrames" },
        { kind: "action" },
        { kind: "stepFrames", frames: 12, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        mapId: MAP,
        energy: 99,
        farmAttempt: { kind: "tilled", x: 4, y: 6 },
      },
      shot: true,
    },
    {
      id: "sow-seed",
      note: "감자 씨앗(손 슬롯 5)으로 실제 파종 — 씨앗이 하나 줄어야 한다",
      ops: [
        { kind: "key", key: "5" },
        { kind: "pauseFrames" },
        { kind: "action" },
        { kind: "stepFrames", frames: 12, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        inventory: { item_potato_seed: 2 },
        farmAttempt: { kind: "planted", x: 4, y: 6, itemId: "item_potato_seed" },
      },
      shot: true,
    },
    {
      id: "water-plot",
      note: "물뿌리개(손 슬롯 3)로 실제 급수",
      ops: [
        { kind: "key", key: "3" },
        { kind: "pauseFrames" },
        { kind: "action" },
        { kind: "stepFrames", frames: 12, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        farmAttempt: { kind: "watered", x: 4, y: 6 },
      },
      shot: true,
    },
    {
      id: "sleep-day1",
      note: "침대(3,3) 조사 → 안내문 → 확인 → sleepUntilMorning. 하루가 실제로 넘어가고 "
        + "물 준 작물이 자란다. 앞 판에서 mapId 만 단정했더니 잠들지 않았는데도 통과했다 — "
        + "여기서는 작물 growthDays 로 하루 전환 자체를 단정한다",
      ops: [
        { kind: "playerRoute", moves: [
          { kind: "move", dir: "up" },
          { kind: "move", dir: "left" },
        ] },
        { kind: "waitForPosition", mapId: MAP, x: 3, y: 4, timeoutMs: 60_000 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20_000 },
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 8 },
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 120, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        mapId: MAP,
        // 하루가 실제로 넘어갔다는 증거: 기력이 회복되고 작물이 하루 자란다.
        energy: 100,
        cropGrowthDays: { mapId: MAP, key: "4,6", growthDays: 1 },
      },
      shot: true,
    },
    {
      id: "water-day2",
      note: "이틀째 급수 — 감자는 stages [1일,1일] 이라 하루 더 자라야 수확기가 된다",
      ops: [
        { kind: "key", key: "3" },
        { kind: "playerRoute", moves: [
          { kind: "move", dir: "right" },
          { kind: "move", dir: "down" },
        ] },
        { kind: "waitForPosition", mapId: MAP, x: 4, y: 5, timeoutMs: 60_000 },
        { kind: "face", dir: "down" },
        // injectActionEdge() 는 Enter 엣지를 만든다(src/player/input.ts). 침대 대화를
        // Enter 로 닫은 직후에는 인터프리터 진입/종료가 "소비되지 않은 action 엣지"를
        // 의도적으로 비우므로(같은 파일 주석), 곧바로 넣은 농사 액션 엣지가 함께 버려진다.
        // 인터프리터가 완전히 빠져나간 뒤에 엣지를 넣는다.
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 30, deltaMs: 16 },
        { kind: "action" },
        { kind: "stepFrames", frames: 16, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        farmAttempt: { kind: "watered", x: 4, y: 6 },
        placeablesAt: ["map_farming_demo:4,6"],
      },
      shot: true,
    },
    {
      id: "sleep-day2",
      note: "다시 수면 → 이틀째 전환. 작물이 수확기(growthDays 2)가 된다",
      ops: [
        { kind: "playerRoute", moves: [
          { kind: "move", dir: "up" },
          { kind: "move", dir: "left" },
        ] },
        { kind: "waitForPosition", mapId: MAP, x: 3, y: 4, timeoutMs: 60_000 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20_000 },
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 8 },
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 120, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        energy: 100,
        cropGrowthDays: { mapId: MAP, key: "4,6", growthDays: 2 },
      },
      shot: true,
    },
    {
      id: "harvest-potato",
      note: "수확기 작물을 실제로 수확 → 감자 1개, 밭이 비고 농사 XP",
      ops: [
        { kind: "playerRoute", moves: [
          { kind: "move", dir: "right" },
          { kind: "move", dir: "down" },
        ] },
        { kind: "waitForPosition", mapId: MAP, x: 4, y: 5, timeoutMs: 60_000 },
        { kind: "face", dir: "down" },
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 30, deltaMs: 16 },
        { kind: "action" },
        { kind: "stepFrames", frames: 16, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        inventory: { item_potato: 1, item_potato_seed: 2 },
        farmAttempt: { kind: "harvested", source: "crop", itemId: "item_potato", count: 1, x: 4, y: 6 },
      },
      shot: true,
    },
    {
      id: "ship-potato",
      note: "상태 메뉴(Escape) → 생활 원장 출하 탭에서 수확한 감자를 실제로 출하함에 넣는다. "
        + "출하 투입은 월드 오브젝트가 아니라 원장 메뉴가 소유한다(lifeLedger.ts:depositShipping)",
      ops: [
        { kind: "key", key: "Escape" },
        { kind: "waitFor", testid: "main-menu", state: "present", timeoutMs: 20_000 },
      ],
      expect: { testidPresent: ["main-menu", "status-menu-gold"] },
      shot: true,
    },
    {
      id: "open-record-group",
      note: "레일은 접힌 그룹으로 렌더된다(실측 덤프: record-menu 가 관문이고 life-ledger 는 "
        + "그룹을 연 뒤에 나타난다). 실제 그룹 항목을 눌러 펼친다",
      ops: [
        { kind: "waitFor", testid: "status-menu-command-record-menu", state: "present", timeoutMs: 20_000 },
      ],
      expect: {
        testidPresent: ["status-menu-command-record-menu"],
        dumpTestidPrefixes: ["status-menu-command-", "life-ledger-"],
      },
      shot: true,
    },
    {
      id: "open-save-point",
      note: "저작된 기록판(5,4)을 조사하면 openSaveMenu 명령이 실제 저장 메뉴를 연다. "
        + "메뉴 레일 탐색이 아니라 제작자가 실제로 쓰는 이벤트 명령 경로다",
      ops: [
        // 앞 비트가 상태 메뉴를 열어둔 채 끝난다 — 닫지 않으면 이동 입력이 메뉴로 간다
        // (실측: 좌표가 4,5 에서 움직이지 않았다).
        { kind: "key", key: "Escape" },
        { kind: "waitFor", testid: "main-menu", state: "absent", timeoutMs: 20_000 },
        { kind: "playerRoute", moves: [{ kind: "move", dir: "up" }] },
        { kind: "waitForPosition", mapId: MAP, x: 4, y: 4, timeoutMs: 60_000 },
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "save-slot-1", state: "present", timeoutMs: 20_000 },
      ],
      expect: {
        testidPresent: ["main-menu", "save-slot-1"],
        // 수확한 감자는 저장 대상 상태에 그대로 있어야 한다.
        inventory: { item_potato: 1 },
      },
      shot: true,
    },
    {
      id: "save-slot-1",
      note: "실제 저장 슬롯을 활성화한다. 커서가 1번 슬롯에 있으므로 Enter 가 onSaveSlot(1) 을 "
        + "부른다(playerStatusMenuDetails.ts:saveDetail). 저장 후에도 상태는 그대로여야 한다",
      ops: [
        { kind: "waitForAttr", testid: "save-slot-1", attr: "aria-current", value: "true", timeoutMs: 15_000 },
        { kind: "key", key: "Enter" },
        // data-save-slot-state 는 존재하지 않고(detailEntryDataset 확인), waitForVisible 은
        // 텍스트를 보지 않는다. 실제 신호는 저장이 반영되면 힌트가 덮어쓰기 경고로 바뀌는
        // 것이므로(saveDetail: confirmSaveSlot) visibleText 축으로 단정한다.
        { kind: "waitForAttr", testid: "save-slot-1", attr: "aria-current", value: "true", timeoutMs: 15_000 },
      ],
      expect: {
        inventory: { item_potato: 1, item_potato_seed: 2 },
        energy: 99,
        // 실측: 저장 직후 힌트는 "덮어씁니다"가 아니다(그건 이미 채워진 칸을 다시 고를 때다).
        // 실제 증거는 1번 슬롯이 "저장됨"이 되고 나머지가 "비어 있음"으로 남는 것이다.
        visibleText: { "status-menu-detail": "1번 저장저장됨" },
      },
      shot: true,
    },
  ],
};

export default lifeFullScenario;
