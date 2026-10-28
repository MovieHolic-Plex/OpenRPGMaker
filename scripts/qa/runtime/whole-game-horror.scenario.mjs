// 실물 게임 공포 런타임 QA — 「폐병원」(horror, 2026-10-28 standin), 컴파일된 출하 플레이어.
//
//   node scripts/runtime-qa.mjs --scenario whole-game-horror --browser firefox --netns \
//     --whole-game ~/z-project/assistant-whole-game/suite/runs/2026-10-28-standin/standin/horror/project --out /tmp/bq/horror
//
// 맵 하나(50×50, 손전등 at:player 반경 4). 비상구(27,47)는 잠겨 대사 두 줄. 추격자(28,27): 금고를 열면 켜지는 sw_0001 페이지, chase 시야 6·맵 전체 추격·접촉 시 killPlayer.
// 순서: 첫 필드(어둠·손전등) → 잠긴 비상구 대사 → 추격자 시야 안으로 → 잡힘 → 게임 오버 → 「다시 도망친다」(체크포인트) →
// 다시 잡힘 → 「타이틀로」 → 타이틀 「불러오기」 목록.
// 이 판에는 숨을 곳(interaction hiding)이 없다 — 숨기 비트는 없다(빌더 쪽 몫).
import { fieldReady, wholeGameOpening } from "./wholeGameBattleCommon.mjs";

const MAP = "map_blank_start";
const gameOverReady = [
  { kind: "waitFor", testid: "game-over-screen", state: "present", timeoutMs: 60000 },
  { kind: "waitForVisible", testid: "game-over-screen", descendant: ".game-over-choice", minAlpha: 0.99, timeoutMs: 30000 },
];

// 추격자는 집(28,27)에서 아래를 보고 서서 사각형(28..34, 27..30)을 돈다. 시야는 바라보는 쪽이다 — 집 북쪽에 세우면 등 뒤라
// 못 본다(첫 판 실측). 왼쪽 변(x=28)을 위로 올라올 때 북쪽 (28,25)를 본다. 손전등 반경 4 안(3칸)까지 들어오면 찍는다.
const chaserSees = [
  { kind: "setSwitch", switchId: "sw_0001" },
  { kind: "teleport", mapId: MAP, x: 28, y: 25 },
  { kind: "waitForPosition", mapId: MAP, x: 28, y: 25 },
  {
    kind: "pressUntilJs",
    key: "Control",
    settleMs: 100,
    maxPresses: 400,
    fn: `() => { const s = window.__oprnDebug.readState(); const id = Object.keys(s.horror?.pursuits ?? {})[0]; const p = id && s.horror.pursuits[id]; const at = id && s.eventLocations?.[id]; return !!document.querySelector('[data-testid=game-over-screen]') || (!!p?.active && !!at && Math.abs(at.x - s.x) + Math.abs(at.y - s.y) <= 3); }`,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-horror",
  viewport: { width: 960, height: 720 },
  beats: [
    ...wholeGameOpening(),
    {
      id: "locked-door",
      note: "잠긴 비상구(27,47) 위 칸에서 아래를 보고 조사 → 잠김 대사",
      ops: [
        { kind: "teleport", mapId: MAP, x: 27, y: 46 },
        { kind: "waitForPosition", mapId: MAP, x: 27, y: 46 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        { kind: "face", dir: "down" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15000 },
        { kind: "waitForText", testid: "dialogue-box", text: "자물쇠", timeoutMs: 15000 },
      ],
      shot: true,
    },
    {
      id: "chaser-sees",
      note: "대사를 닫고 sw_0001(금고 퍼즐 끝)을 켠 뒤 (28,25)에서 순찰 추격자가 보고 쫓아와 3칸 안",
      ops: [
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 10 },
        ...chaserSees,
      ],
      shot: true,
    },
    {
      id: "caught",
      note: "잡힘 → 게임 오버(공포 연출) 선택지까지",
      ops: [...gameOverReady],
      shot: true,
    },
    {
      id: "retry",
      note: "「다시 도망친다」 → 체크포인트에서 다시",
      ops: [
        { kind: "click", testid: "checkpoint-retry" },
        { kind: "waitFor", testid: "game-over-screen", state: "absent", timeoutMs: 30000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 20 },
      ],
      shot: true,
    },
    {
      id: "caught-again",
      note: "다시 추격자 시야로 → 게임 오버",
      ops: [
        ...chaserSees,
        ...gameOverReady,
      ],
      shot: true,
    },
    {
      id: "to-title",
      note: "「타이틀로 돌아가기」 → 타이틀",
      ops: [
        { kind: "click", testid: "return-title" },
        { kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 60000 },
      ],
      shot: true,
    },
    {
      id: "title-load",
      note: "타이틀 「불러오기」 목록",
      ops: [
        { kind: "click", testid: "title-load-game", timeoutMs: 30000 },
        // 불러오기 창: 저장 칸 목록(체크포인트는 저장 칸이 아니다 — 게임 오버의 「다시 도망친다」 전용).
        { kind: "waitForBodyText", text: "1번 저장", timeoutMs: 15000 },
      ],
      shot: true,
    },
  ],
};
