// rt-new-game-after-title-return — 게임 오버/런 종료로 타이틀에 **다시** 들어와 Enter 를 누르면
// 새 게임이어야 한다(죽은 판의 오토세이브를 이으면 실패). 버그가 살아 있는 동안 이 시나리오는 실패한다.
//
// 왜 재현 스크립트(to-scenario.mjs)가 아니라 손으로 쓴 시나리오인가:
//   F1 의 재현 토막(main1/preset-adventure-jrpg__first-run actions.jsonl 359-364)은 게임 오버 세이브
//   (line 357)에서 부팅한다. 그런데 결함의 원인은 **페이지 상태** — 타이틀 커서가 「이어하기」로 내려간
//   채 남는 것 — 이고, 그 커서를 내린 입력(같은 세션 line 314 ArrowDown)은 앵커보다 앞에 있다.
//   세이브에는 커서가 실리지 않으므로 앵커 재생으로는 그 상태에 도달할 수 없다. 실제로 to-scenario 로
//   구운 판은 고치기 전에도 통과했다(거짓 통과 — 버그가 살아 있는데 초록). 그래서 같은 사용자 경로를
//   직접 적는다: 전이 오토세이브를 만든 뒤 타이틀 → 「이어하기」 → 다시 타이틀.
//
// 실행: npm run qa:runtime -- --scenario rt-new-game-after-title-return --checkpoint-set rt-new-game-after-title-return --checkpoint all

/**
 * 조건이 설 때까지 클릭을 반복한다. 메뉴가 페이드로 열리는 동안의 클릭은 무시될 수 있어
 * 한 번만 누르면 조용히 지나간다(실측) — 조건을 먼저 보고, 아니면 누른다.
 */
function clickUntil(testid, readyTestid) {
  return {
    kind: "pressUntilJs",
    // fn 이 클릭을 하고, 실행기는 fn 이 false 인 동안 key 를 누른다 — Shift 는 런타임 메뉴 키가
    // 아니라(조기 반환) 커서·명령을 건드리지 않는 무해한 입력이다. Enter 를 쓰면 클릭과 겸쳐
    // 확인 카드가 두 번 확정된다.
    key: "Shift",
    fn: `() => { if (document.querySelector("[data-testid='${readyTestid}']")) return true; const b = document.querySelector("[data-testid='${testid}']"); if (!b) return false; b.click(); return false; }`,
    maxPresses: 12,
    settleMs: 300,
  };
}

/** 상태 메뉴 → 「시스템 ▸」 → 「타이틀로」 → 확인 카드 → 타이틀 화면. */
const backToTitle = [
  // 메뉴는 페이드로 열리고, 전이·복귀 직후에는 입력이 잠깐 잠겨 있을 수 있다 — 열릴 때까지 Esc 를 눌러 본다.
  {
    kind: "pressUntilJs",
    key: "Escape",
    fn: "() => Boolean(document.querySelector(\"[data-testid='status-menu-command-rail']\"))",
    maxPresses: 40,
    settleMs: 500,
  },
  clickUntil("status-menu-command-system-menu", "status-menu-group-command-to-title"),
  clickUntil("status-menu-group-command-to-title", "status-menu-confirm-to-title"),
  clickUntil("status-menu-confirm-to-title", "title-screen"),
];

const beats =
[
  {
    id: "rt-new-game-after-title-return-repro",
    note: "타이틀에 다시 들어온 뒤 Enter 는 새 게임이어야 한다 — 이전 판에서 「이어하기」로 내려 둔 커서가 남으면 죽은 판의 오토세이브(숲길·90G)로 돌아간다",
    ops: [
      // ① 숲길로 나가 전이 오토세이브를 만든다(타이틀에 「이어하기」가 생긴다).
      { kind: "move", dir: "right", steps: 3 },
      { kind: "waitForMap", mapId: "map_segment_route" },
      // ② 타이틀에서 「이어하기」로 내려 복귀 — 기록 세션과 같은 선택.
      ...backToTitle,
      { kind: "key", key: "ArrowDown" },
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      { kind: "waitForRuntime" },
      // ③ 다시 타이틀. 커서가 「이어하기」에 남아 있으면 Enter 가 새 게임이 아니다.
      ...backToTitle,
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "title-screen", state: "absent" },
      // 부팅 중에는 앞 런의 runtime-state-json 미러가 잠시 남아 있다(waitForRuntime 만으로는 옛 맵을 읽는다 — 실측).
      // 새 게임이면 도착지는 시작 맵이다. 이 대기가 곧 단정이다 — 이어하기면 숲길이라 여기서 시간 초과로 실패한다.
      { kind: "waitForMap", mapId: "map_blank_start" },
    ],
    expect: {
      mapId: "map_blank_start",
      gold: 0,
      note: "타이틀 재진입 뒤 Enter 는 새 게임이어야 한다 — 죽은 판의 오토세이브(숲길·90G)로 돌아가면 실패",
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-new-game-after-title-return",
  projectGenerator: { game: "preset-adventure-jrpg" },
  checkpointSet: "rt-new-game-after-title-return",
  viewport: { width: 1280, height: 720 },
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { gate: beats },
};
