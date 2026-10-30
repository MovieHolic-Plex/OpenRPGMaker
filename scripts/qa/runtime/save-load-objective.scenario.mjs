// 저장 → 걷기 → 불러오기 뒤 「현재 목표」가 저장 시점 그대로인지(2026-10-29 vm2 deepseek 방탈출 판정 공격 A6).
//
//   node scripts/runtime-qa.mjs --scenario save-load-objective --project <deepseek escape project.json> --netns
//
// 그 판: 금고를 열어 열쇠를 얻고 1번 칸에 저장 → 걸어 이동 → 불러오기 하자 스위치·열쇠는 돌아왔는데 목표 줄이
// 시작 목표(「책상 위 낡은 일지를 읽어 네 자리 암호를 찾자」)로 되돌아갔다. 진행은 실제 이벤트로 만든다: 일지 스위치만 켠 뒤
// 번호 쪽지(4,6)를 조사하면 그 페이지가 다음 목표(「철제 금고 다이얼에 0447을 넣어 열자」)를 건다. 저장·불러오기는 ESC 메뉴 키로.
// 각 단계의 목표 기록(m2Runtime.ui 의 objectiveChip)과 화면 목표 줄 글을 OUT 폴더의 JSON 으로 남긴다.

const OUT = process.env.QA_OBJ_OUT ?? "/tmp/save-load-objective";
const noBox = "() => !document.querySelector(\".dialogue-overlay .dialogue-box, [data-testid='runtime-choices']\")";
const hasObjective = "() => (window.__oprnHooksScene?.getSession?.()?.m2Runtime?.ui ?? []).some((e) => e.surface === 'objectiveChip') && !document.querySelector(\".dialogue-overlay .dialogue-box, [data-testid='runtime-choices']\")";
const noteRead = "() => window.__oprnHooksScene?.getSession?.()?.switches?.sw_kxtktod_kc2vfq3 === true && !document.querySelector(\".dialogue-overlay .dialogue-box, [data-testid='runtime-choices']\")";
const read = `() => {
  const s = window.__oprnHooksScene?.getSession?.();
  const ui = (s?.m2Runtime?.ui ?? []).filter((e) => e.surface === "objectiveChip").map((e) => e.message);
  const line = document.querySelector(".zone-feedback-objective");
  return { pos: s ? [s.currentMapId, s.x, s.y] : null, objectives: ui, shown: line && !line.hidden ? line.textContent.replace(/\\s+/g, " ").trim() : null,
    switches: Object.keys(s?.switches ?? {}).filter((k) => s.switches[k]).sort(), inventory: s?.inventory ?? {} };
}`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const saveLoadObjectiveScenario = {
  id: "save-load-objective",
  beats: [
    { id: "start", note: "새 게임 → 시작 컷신 넘기기", ops: [
      // 타이틀: 첫 Enter 는 「PRESS START」 → 메뉴, 둘째 Enter 가 새 게임.
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      // 시작 컷신(대사 셋)을 넘기면 시작 목표가 걸린다.
      { kind: "pressUntilJs", key: "Enter", fn: hasObjective, maxPresses: 80, settleMs: 700 },
      { kind: "evalToFile", fn: read, out: `${OUT}/1-start.json` },
    ], shot: true },
    { id: "progress", note: "일지를 읽은 것으로 두고 번호 쪽지를 실제로 조사 — 다음 목표가 걸린다", ops: [
      { kind: "setSwitch", switchId: "sw_kxtktod_km7aoxj" },
      { kind: "setSwitch", switchId: "sw_kxtktod_taken_1" },
      { kind: "teleport", mapId: "map_blank_start", x: 4, y: 5 },
      { kind: "face", dir: "down" },
      { kind: "pressUntilJs", key: "Enter", fn: noteRead, maxPresses: 30, settleMs: 600 },
      { kind: "evalToFile", fn: read, out: `${OUT}/2-before-save.json` },
    ], shot: true },
    { id: "save", note: "ESC → 저장 → 1번 칸", ops: [
      { kind: "key", key: "Escape" }, { kind: "click", testid: "status-menu-command-save" }, { kind: "click", testid: "save-slot-1" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => /저장했습니다/.test(document.body.textContent ?? '')", maxPresses: 2, settleMs: 700 },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='main-menu']\")", maxPresses: 4, settleMs: 400 },
    ], shot: true },
    { id: "walk", note: "저장 뒤 걸어서 자리 옮기기", ops: [
      { kind: "teleport", mapId: "map_blank_start", x: 6, y: 6 },
      { kind: "evalToFile", fn: read, out: `${OUT}/3-after-walk.json` },
    ] },
    { id: "load", note: "ESC → 불러오기 → 1번 칸", ops: [
      { kind: "key", key: "Escape" }, { kind: "click", testid: "status-menu-command-load" }, { kind: "click", testid: "load-slot-1" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='main-menu']\")", maxPresses: 3, settleMs: 1500 },
      { kind: "pressUntilJs", key: "Enter", fn: noBox, maxPresses: 20 },
      { kind: "evalToFile", fn: read, out: `${OUT}/4-after-load.json` },
    ], shot: true },
  ],
};
