// quest-register-log — 「퀘스트 제안」으로 등록한 초안 퀘스트가 출하 플레이어의 임무 일지에 나타나고, 진행 값이 켜지면 완료로 바뀌는가.
//
//   node scripts/runtime-qa.mjs --scenario quest-register-log --browser firefox \
//     --whole-game <등록 후 저장한 Terra 게임 폴더(project.sqlite)> --out <dir> [-- --quest-switch spring_restored]
//
// 진행 값은 이벤트가 이미 쓰는 스위치다(L6 고양이 게임: spring_restored). 퍼즐을 손으로 풀지 않고 __oprnDebug.setSwitch 로 켠다 —
// 확인할 것은 임무 일지가 그 값을 읽는가이지 퍼즐이 아니다.
import { wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const flag = process.argv.indexOf("--quest-switch");
const SWITCH = flag >= 0 ? process.argv[flag + 1] : "spring_restored";

// 「임무」는 기록 묶음(record-menu) 안에 있다 — 메뉴를 열고 묶음을 연 뒤 고른다.
const openQuests = [
  { kind: "pressUntilJs", key: "Escape", fn: `() => Boolean(document.querySelector('[data-testid="status-menu-command-record-menu"]'))`, maxPresses: 10, settleMs: 900 },
  { kind: "click", testid: "status-menu-command-record-menu" },
  { kind: "waitFor", testid: "status-menu-group-command-quests" },
  { kind: "click", testid: "status-menu-group-command-quests" },
  { kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(document.querySelector('[data-quest-row]'))`, maxPresses: 2, settleMs: 700 },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "quest-register-log",
  viewport: { width: 1280, height: 720 },
  beats: [
    ...wholeGameOpening(),
    {
      id: "quest-log-registered",
      note: "등록한 임무가 일지에 「미시작」으로 보인다",
      ops: openQuests,
      expect: { pageAssertions: [{ id: "quest-row", fn: `() => document.querySelector('[data-quest-row="summary"]') ? true : '임무 행이 없다'` }] },
      shot: true,
    },
    {
      id: "quest-log-done",
      note: `진행 값 ${SWITCH} 를 켜면 같은 임무가 「완료」가 된다`,
      ops: [
        { kind: "key", key: "Escape", times: 3 },
        { kind: "setSwitch", switchId: SWITCH, value: true },
        ...openQuests,
      ],
      expect: { pageAssertions: [{ id: "quest-done", fn: `() => /완료/.test(document.querySelector('[data-quest-row="state"]')?.textContent ?? '') ? true : '상태 행이 완료가 아니다: ' + (document.querySelector('[data-quest-row="state"]')?.textContent ?? '')` }] },
      shot: true,
    },
  ],
};
