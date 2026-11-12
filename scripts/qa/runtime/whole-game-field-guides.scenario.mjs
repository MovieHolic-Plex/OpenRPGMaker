// 실물 게임 — 필드 안내(곁 화살표 · 대상 빛무리 · 머리 위 ▼ · 목표 글의 「어디」 꼬리)가 켜진/꺼진 화면을 같은 자리에서 찍는다.
//
//   GUIDE_SPOTS='[{"id":"chief","mapId":"map_…","x":5,"y":6,"face":"up","talk":true},{"id":"village","mapId":"map_…","x":11,"y":18}]' GUIDE_OUT=/tmp/guides/before \
//   node scripts/runtime-qa.mjs --scenario whole-game-field-guides --browser firefox --netns --whole-game <project 폴더> --out /tmp/guides/before
//
// 같은 저장본을 system.fieldGuides 만 바꾼 사본과 나란히 돌려 전/후를 본다(조수 v2 는 "off" 로 출하한다 — openwiki/assistant-v2.md 「필드 안내는 끈 채로 출하한다」).
// 비트: 첫 필드 → 자리마다(순간 이동, talk 면 그쪽을 조사해 대사를 끝까지 넘긴 뒤) 한 장. 상태는 GUIDE_OUT/<비트>.json(목표 창 글 · 표시 · 화살표).
import { fieldReady } from "./wholeGameBattleCommon.mjs";
import { openingBeats, toFieldBeats } from "./wholeGameStoryCommon.mjs";

const spots = JSON.parse(process.env.GUIDE_SPOTS ?? "[]");
const out = process.env.GUIDE_OUT ?? "/tmp/field-guides";
const state = (name) => ({
  kind: "evalToFile", out: `${out}/${name}.json`,
  fn: `() => { const s = window.__oprnDebug?.readState?.();
    const chip = document.querySelector(".zone-feedback-objective");
    return { map: s?.currentMapId, x: s?.x, y: s?.y, markers: s?.objectiveMarkers, arrow: s?.objectiveArrow, examineMarkers: s?.examineMarkers, objective: chip && !chip.hidden ? chip.textContent.trim() : null }; }`,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "whole-game-field-guides",
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
      id: "start",
      note: "시작 자리 그대로 — 목표 창 · 곁 화살표 · 머리 위 표식",
      // 첫 조작 뒤 가운데 목표 카드(2.8초)가 걷힌 화면을 찍는다.
      ops: [{ kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 30, settleMs: 700 }, { kind: "hold", dir: null, ms: 4500 }, state("start")],
      shot: true,
    },
    ...spots.map((spot) => ({
      id: spot.id,
      note: `${spot.mapId} (${spot.x},${spot.y})${spot.talk ? ` 에서 ${spot.face} 쪽을 조사한 뒤` : ""}`,
      ops: [
        { kind: "teleport", mapId: spot.mapId, x: spot.x, y: spot.y },
        { kind: "waitForPosition", mapId: spot.mapId, x: spot.x, y: spot.y },
        ...(spot.face ? [{ kind: "face", dir: spot.face }] : []),
        ...(spot.talk ? [
          { kind: "action" },
          { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.99, timeoutMs: 15000 },
          { kind: "pressUntilJs", key: "Enter", fn: fieldReady, maxPresses: 40, settleMs: 800 },
        ] : []),
        { kind: "hold", dir: null, ms: 4500 },
        state(spot.id),
      ],
      shot: true,
    })),
  ],
};
