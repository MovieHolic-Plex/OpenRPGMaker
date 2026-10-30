// 실물 게임 — 시작 직후 「현재 목표」가 가리키는 첫 대상·다음 장소로 가는 출구가 화면에서 보이나(빛무리·화면 밖이면 가장자리 화살표).
//
//   OBJ_MAP=map_beodeul_river_2 OBJ_APPROACH='{"x":1,"y":4,"face":"up"}' OBJ_OUT=/tmp/jrpg-fix/qa/terra-after \
//   node scripts/runtime-qa.mjs --scenario whole-game-objective-route --browser firefox --netns \
//     --whole-game /tmp/jrpg-fix/after/vm2-1029-terra-jrpg/project --out /tmp/jrpg-fix/qa/terra-after
//
// 2026-10-29 vm2 jrpg flash·terra 판정자 「길 못 찾음」: terra 는 목표 「(마왕의 동굴 입구: 서쪽)」 인데 이미 맵 서쪽 끝(1,4)이었고
// 문은 26칸 남쪽(1,30), flash 는 시작 목표가 첫 단계(3칸 위 「마을 시작」)를 건너뛰고 동굴을 가리켰다.
// 비트: 첫 필드(목표·표시·화살표 기록) → 첫 대상 곁에서 조사해 다음 목표 → 다음 출구 표시·화살표. 상태는 OBJ_OUT/<비트>.json.
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const approach = JSON.parse(process.env.OBJ_APPROACH ?? '{"x":0,"y":0,"face":"up"}');
const mapId = process.env.OBJ_MAP ?? "map_blank_start";
const out = process.env.OBJ_OUT ?? "/tmp/objective-route";
const state = (name) => ({
  kind: "evalToFile", out: `${out}/${name}.json`,
  fn: `() => { const s = window.__oprnDebug?.readState?.(); const lines = document.body.innerText.split("\\n").map((l) => l.trim()).filter((l) => /\\(|목표/.test(l) && l.length < 160);
    return { map: s?.currentMapId, x: s?.x, y: s?.y, markers: s?.objectiveMarkers, arrow: s?.objectiveArrow, text: lines.slice(0, 6) }; }`,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-objective-route",
  viewport: { width: 960, height: 720 },
  beats: [
    ...openingBeats().slice(0, 1),
    {
      id: "new-game",
      note: "새 게임 — 맵이 뜰 때까지 Enter",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => Boolean(window.__oprnDebug?.readState?.().currentMapId)`, maxPresses: 20, settleMs: 3000 }],
    },
    ...toFieldBeats({ firstDialogue: false }),
    {
      id: "start-objective",
      note: "시작 자리 그대로 — 목표 줄·첫 대상 표시(화면 밖이면 가장자리 화살표)",
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }, { kind: "hold", dir: null, ms: 2500 }, state("start-objective")],
      shot: true,
    },
    {
      id: "first-step",
      note: `첫 대상 곁(${approach.x},${approach.y})에서 ${approach.face} 쪽을 조사 — 다음 목표와 그 출구 표시`,
      ops: [
        { kind: "teleport", mapId, x: approach.x, y: approach.y },
        { kind: "waitForPosition", mapId, x: approach.x, y: approach.y },
        { kind: "face", dir: approach.face },
        { kind: "action" },
        // 대사가 실제로 열린 뒤에 넘긴다 — 열리기 전에 「필드 준비」를 읽으면 Enter 없이 지나가 대사창이 열린 채 찍힌다.
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 15000 },
        { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 800 },
        { kind: "hold", dir: null, ms: 2500 },
        state("first-step"),
      ],
      shot: true,
    },
  ],
};
